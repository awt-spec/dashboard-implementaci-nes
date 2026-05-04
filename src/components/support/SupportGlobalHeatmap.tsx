import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup, ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Activity, Flame, Clock, Package, AlertTriangle, Building2,
  Eye, Radio, 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isTicketClosed } from "@/lib/ticketStatus";
import { cn } from "@/lib/utils";
import type { SupportTicket } from "@/hooks/useSupportTickets";

// ─── Tipos ───────────────────────────────────────────────────────────────

type Dim = "prioridad" | "estado" | "antiguedad" | "producto";

interface Cell {
  rowKey: string;
  colKey: string;
  count: number;
  tickets: SupportTicket[];
}

interface RowSummary {
  clientId: string;
  clientName: string;
  total: number;
  cells: Map<string, Cell>;
}

interface Props {
  tickets: SupportTicket[];
  clients: Array<{ id: string; name: string }>;
  onOpenTicket?: (t: SupportTicket) => void;
}

// ─── Definiciones por dimensión ──────────────────────────────────────────

interface DimColumn {
  key: string;
  label: string;
  short: string;
  color: string;        // RGB para gradiente
  match: (t: SupportTicket) => boolean;
}

function dimColumns(dim: Dim, tickets: SupportTicket[]): DimColumn[] {
  if (dim === "prioridad") {
    return [
      { key: "Critica",  label: "Crítica",  short: "Crít", color: "239, 68, 68",  match: (t) => /critica/i.test(t.prioridad || "") },
      { key: "Alta",     label: "Alta",     short: "Alta", color: "249, 115, 22", match: (t) => t.prioridad === "Alta" },
      { key: "Media",    label: "Media",    short: "Med",  color: "234, 179, 8",  match: (t) => t.prioridad === "Media" },
      { key: "Baja",     label: "Baja",     short: "Baja", color: "148, 163, 184", match: (t) => t.prioridad === "Baja" },
    ];
  }
  if (dim === "estado") {
    return [
      { key: "PENDIENTE",   label: "Pendiente",  short: "PEN", color: "249, 115, 22", match: (t) => t.estado === "PENDIENTE" },
      { key: "EN ATENCIÓN", label: "En atención", short: "EN", color: "59, 130, 246",  match: (t) => t.estado === "EN ATENCIÓN" },
      { key: "ENTREGADA",   label: "Entregada",  short: "ENT", color: "234, 179, 8",  match: (t) => t.estado === "ENTREGADA" },
      { key: "POR CERRAR",  label: "Por cerrar", short: "POR", color: "16, 185, 129", match: (t) => t.estado === "POR CERRAR" },
      { key: "ON HOLD",     label: "On hold",    short: "HLD", color: "100, 116, 139", match: (t) => t.estado === "ON HOLD" },
    ];
  }
  if (dim === "antiguedad") {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return [
      { key: "0-7",     label: "Esta semana",   short: "≤7d",   color: "16, 185, 129",  match: (t) => (now - new Date(t.created_at).getTime()) / dayMs < 7 },
      { key: "7-30",    label: "Este mes",      short: "≤30d",  color: "59, 130, 246",  match: (t) => { const d = (now - new Date(t.created_at).getTime()) / dayMs; return d >= 7 && d < 30; } },
      { key: "30-90",   label: "1-3 meses",     short: "≤90d",  color: "234, 179, 8",   match: (t) => { const d = (now - new Date(t.created_at).getTime()) / dayMs; return d >= 30 && d < 90; } },
      { key: "90-365",  label: "3-12 meses",    short: "≤1a",   color: "249, 115, 22",  match: (t) => { const d = (now - new Date(t.created_at).getTime()) / dayMs; return d >= 90 && d < 365; } },
      { key: "365+",    label: "Más de 1 año",  short: ">1a",   color: "239, 68, 68",   match: (t) => (now - new Date(t.created_at).getTime()) / dayMs >= 365 },
    ];
  }
  // producto: dinámico, top 6
  const counts = new Map<string, number>();
  tickets.forEach(t => {
    const p = t.producto || "Sin producto";
    counts.set(p, (counts.get(p) ?? 0) + 1);
  });
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);
  return top.map((p, i) => ({
    key: p,
    label: p,
    short: p.length > 8 ? p.slice(0, 8) + "…" : p,
    color: ["59, 130, 246", "16, 185, 129", "234, 179, 8", "249, 115, 22", "239, 68, 68", "168, 85, 247"][i % 6],
    match: (t) => (t.producto || "Sin producto") === p,
  }));
}

// ─── Componente ──────────────────────────────────────────────────────────

export function SupportGlobalHeatmap({ tickets, clients, onOpenTicket }: Props) {
  const qc = useQueryClient();
  const [dim, setDim] = useState<Dim>("prioridad");
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  // Realtime: refresca al cambio en support_tickets
  useEffect(() => {
    const ch = supabase
      .channel("support-heatmap-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["support-tickets"] });
        qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filteredTickets = useMemo(
    () => showClosed ? tickets : tickets.filter(t => !isTicketClosed(t.estado)),
    [tickets, showClosed]
  );

  const columns = useMemo(() => dimColumns(dim, filteredTickets), [dim, filteredTickets]);

  // Computa la matriz: filas = clientes con al menos 1 ticket
  const { rows, maxCell, totalActive } = useMemo(() => {
    const byClient = new Map<string, SupportTicket[]>();
    filteredTickets.forEach(t => {
      if (!byClient.has(t.client_id)) byClient.set(t.client_id, []);
      byClient.get(t.client_id)!.push(t);
    });

    const rows: RowSummary[] = Array.from(byClient.entries()).map(([clientId, items]) => {
      const cells = new Map<string, Cell>();
      columns.forEach(col => {
        const matched = items.filter(col.match);
        cells.set(col.key, {
          rowKey: clientId,
          colKey: col.key,
          count: matched.length,
          tickets: matched,
        });
      });
      const client = clients.find(c => c.id === clientId);
      return {
        clientId,
        clientName: client?.name || clientId,
        total: items.length,
        cells,
      };
    }).sort((a, b) => b.total - a.total);

    let maxCell = 0;
    rows.forEach(r => r.cells.forEach(c => { if (c.count > maxCell) maxCell = c.count; }));
    const totalActive = filteredTickets.length;

    return { rows, maxCell, totalActive };
  }, [filteredTickets, clients, columns]);

  const colTotals = useMemo(() => {
    return columns.map(col => ({
      ...col,
      total: rows.reduce((sum, r) => sum + (r.cells.get(col.key)?.count ?? 0), 0),
    }));
  }, [columns, rows]);

  // ─── Render ────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold">Sin casos para mapear</p>
          <p className="text-[11px] text-muted-foreground">
            Cuando haya casos {showClosed ? "" : "abiertos"} aparecerán acá.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header con controles */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Mapa de calor — Soporte</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Radio className="h-2.5 w-2.5 text-success animate-pulse" /> En vivo · {totalActive} casos {showClosed ? "(incluye cerrados)" : "abiertos"} · {rows.length} clientes
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <ToggleGroup type="single" value={dim} onValueChange={(v) => v && setDim(v as Dim)} className="gap-1">
              {[
                { v: "prioridad",  Icon: Flame,         label: "Prioridad" },
                { v: "estado",     Icon: AlertTriangle, label: "Estado" },
                { v: "antiguedad", Icon: Clock,         label: "Antigüedad" },
                { v: "producto",   Icon: Package,       label: "Producto" },
              ].map(opt => (
                <ToggleGroupItem
                  key={opt.v}
                  value={opt.v}
                  className="h-7 px-2.5 text-[11px] gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <opt.Icon className="h-3 w-3" />
                  <span className="hidden md:inline">{opt.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="h-5 w-px bg-border" />

            <button
              onClick={() => setShowClosed(s => !s)}
              className={cn(
                "h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors",
                showClosed ? "bg-muted text-foreground border-border" : "text-muted-foreground border-border hover:bg-muted/40"
              )}
            >
              {showClosed ? "Ocultar cerrados" : "Incluir cerrados"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Matriz */}
      <TooltipProvider delayDuration={150}>
        <Card>
          <CardContent className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground min-w-[180px] sticky left-0 bg-card/95 backdrop-blur-sm">
                      Cliente
                    </th>
                    {colTotals.map(col => (
                      <th key={col.key} className="text-center p-3 font-semibold text-[10px] uppercase tracking-wider min-w-[80px]" style={{ color: `rgb(${col.color})` }}>
                        <div>{col.label}</div>
                        <div className="text-[9px] font-normal text-muted-foreground tabular-nums">{col.total}</div>
                      </th>
                    ))}
                    <th className="text-center p-3 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground w-16">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.clientId} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-semibold sticky left-0 bg-card/95 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[150px]">{row.clientName}</span>
                        </div>
                      </td>
                      {colTotals.map(col => {
                        const cell = row.cells.get(col.key);
                        const count = cell?.count ?? 0;
                        const intensity = maxCell > 0 ? count / maxCell : 0;
                        const cellId = `${row.clientId}|${col.key}`;
                        const isOpen = openCell === cellId;
                        const bg = count === 0
                          ? "transparent"
                          : `rgba(${col.color}, ${0.1 + intensity * 0.45})`;
                        return (
                          <td key={col.key} className="p-1 text-center border-l border-border/20">
                            {count === 0 ? (
                              <div className="text-muted-foreground/30 text-[11px]">·</div>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setOpenCell(isOpen ? null : cellId)}
                                    className={cn(
                                      "w-full h-9 rounded font-bold tabular-nums transition-all hover:scale-105 hover:ring-2 hover:ring-foreground/20",
                                      isOpen && "ring-2 ring-primary"
                                    )}
                                    style={{
                                      background: bg,
                                      color: intensity > 0.5 ? "white" : `rgb(${col.color})`,
                                    }}
                                  >
                                    {count}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[10px]">
                                  {row.clientName} · {col.label}: {count} caso{count !== 1 ? "s" : ""}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center font-bold tabular-nums">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                    <td className="p-3 text-[10px] uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/20">
                      Total {dim}
                    </td>
                    {colTotals.map(col => (
                      <td key={col.key} className="p-3 text-center tabular-nums" style={{ color: `rgb(${col.color})` }}>
                        {col.total}
                      </td>
                    ))}
                    <td className="p-3 text-center tabular-nums">{totalActive}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Drill-down de la celda activa */}
      {openCell && (() => {
        const [rowKey, colKey] = openCell.split("|");
        const row = rows.find(r => r.clientId === rowKey);
        const col = columns.find(c => c.key === colKey);
        const cell = row?.cells.get(colKey);
        if (!row || !col || !cell) return null;
        return (
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold">{row.clientName} · {col.label}</p>
                  <p className="text-[11px] text-muted-foreground">{cell.count} caso{cell.count !== 1 ? "s" : ""}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setOpenCell(null)} className="h-7 text-xs">
                  Cerrar
                </Button>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {cell.tickets.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 p-2 rounded-md border border-border bg-card hover:bg-muted/20 transition-colors"
                  >
                    <code className="text-[11px] font-mono font-bold text-muted-foreground shrink-0">{t.ticket_id}</code>
                    <Badge variant="outline" className="text-[9px] shrink-0">{t.estado}</Badge>
                    <p className="text-xs flex-1 min-w-0 truncate">{t.asunto}</p>
                    {onOpenTicket && (
                      <Button size="sm" variant="outline" onClick={() => onOpenTicket(t)} className="h-6 text-[11px] gap-1 shrink-0">
                        <Eye className="h-3 w-3" /> Ver
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
