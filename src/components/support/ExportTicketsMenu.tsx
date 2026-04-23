import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Download, ChevronDown, Building2, Calendar, List, Lock } from "lucide-react";
import { toast } from "sonner";
import { toCsv, downloadCsv, csvDate, safeFilename, type CsvColumn } from "@/lib/exportCsv";
import { isTicketClosed } from "@/lib/ticketStatus";
import type { SupportTicket, SupportClient } from "@/hooks/useSupportTickets";

// ─── Columnas por default para el export ──────────────────────────────────

const DEFAULT_COLUMNS: CsvColumn<SupportTicket & { client_name?: string }>[] = [
  { key: "ticket_id",       header: "ID Caso",            get: t => t.ticket_id },
  { key: "consec_global",   header: "Consec. Global",     get: t => t.consecutivo_global ?? "" },
  { key: "consec_cliente",  header: "Consec. Cliente",    get: t => t.consecutivo_cliente ?? "" },
  { key: "client_id",       header: "Cliente ID",         get: t => t.client_id },
  { key: "client_name",     header: "Cliente",            get: t => (t as any).client_name ?? "" },
  { key: "asunto",          header: "Asunto",             get: t => t.asunto },
  { key: "tipo",            header: "Tipo",               get: t => t.tipo },
  { key: "prioridad",       header: "Prioridad",          get: t => t.prioridad },
  { key: "prioridad_int",   header: "Prioridad Interna",  get: t => t.prioridad_interna ?? "" },
  { key: "estado",          header: "Estado",             get: t => t.estado },
  { key: "responsable",     header: "Responsable",        get: t => t.responsable ?? "" },
  { key: "fuente",          header: "Origen",             get: t => t.fuente ?? "interno" },
  { key: "is_conf",         header: "Confidencial",       get: t => t.is_confidential ? "SI" : "NO" },
  { key: "descripcion",     header: "Descripción",        get: t => t.is_confidential ? "[CIFRADO]" : (t.descripcion || t.notas || "") },
  { key: "producto",        header: "Producto",           get: t => t.producto ?? "" },
  { key: "ubicacion",       header: "Ubicación Error",    get: t => t.ubicacion_error ?? "" },
  { key: "orden",           header: "Orden Atención",     get: t => t.orden_atencion ?? 0 },
  { key: "dias_ant",        header: "Días Antigüedad",    get: t => t.dias_antiguedad ?? 0 },
  { key: "sp",              header: "Story Points",       get: t => t.story_points ?? "" },
  { key: "bv",              header: "Business Value",     get: t => t.business_value ?? "" },
  { key: "ef",              header: "Effort",             get: t => t.effort ?? "" },
  { key: "t_cons",          header: "Min. Consumidos",    get: t => t.tiempo_consumido_minutos ?? 0 },
  { key: "t_cob",           header: "Min. Cobrados",      get: t => t.tiempo_cobrado_minutos ?? 0 },
  { key: "fecha_reg",       header: "Fecha Registro",     get: t => csvDate(t.fecha_registro) },
  { key: "fecha_ent",       header: "Fecha Entrega",      get: t => csvDate(t.fecha_entrega) },
  { key: "fecha_cierre",    header: "Fecha Cierre Est.",  get: t => csvDate(t.fecha_estimada_cierre) },
  { key: "created_at",      header: "Creado",             get: t => csvDate(t.created_at) },
  { key: "updated_at",      header: "Actualizado",        get: t => csvDate(t.updated_at) },
];

// ─── Helper export ────────────────────────────────────────────────────────

function doExport(
  tickets: SupportTicket[],
  clients: SupportClient[],
  filename: string,
  label: string,
) {
  if (tickets.length === 0) {
    toast.warning(`Sin casos para exportar: ${label}`);
    return;
  }
  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  const enriched = tickets.map(t => ({ ...t, client_name: clientMap.get(t.client_id) || t.client_id }));
  const csv = toCsv(enriched, DEFAULT_COLUMNS);
  const today = new Date().toISOString().slice(0, 10);
  downloadCsv(`${filename}_${today}`, csv);
  toast.success(`✓ ${label}: ${tickets.length} casos exportados`);
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  tickets: SupportTicket[];
  clients: SupportClient[];
  /** Cliente actualmente seleccionado (para "Export del cliente actual") */
  currentClientId?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
}

// ─── Componente principal ─────────────────────────────────────────────────

export function ExportTicketsMenu({
  tickets, clients, currentClientId, label = "Exportar CSV",
  variant = "outline", size = "sm",
}: Props) {
  const currentClient = useMemo(
    () => clients.find(c => c.id === currentClientId),
    [clients, currentClientId]
  );

  // Métricas
  const stats = useMemo(() => {
    const now = new Date();
    const last30d = new Date(now.getTime() - 30 * 86400000);
    const last7d  = new Date(now.getTime() - 7 * 86400000);
    const open = tickets.filter(t => !isTicketClosed(t.estado));
    const closed = tickets.filter(t => isTicketClosed(t.estado));
    const critical = tickets.filter(t => /critica/i.test(t.prioridad || ""));
    const conf = tickets.filter(t => t.is_confidential);
    const last30 = tickets.filter(t => t.created_at && new Date(t.created_at) >= last30d);
    const last7  = tickets.filter(t => t.created_at && new Date(t.created_at) >= last7d);
    const currentClientTickets = currentClientId ? tickets.filter(t => t.client_id === currentClientId) : [];

    // Agrupa por cliente
    const byClient = new Map<string, SupportTicket[]>();
    tickets.forEach(t => {
      if (!byClient.has(t.client_id)) byClient.set(t.client_id, []);
      byClient.get(t.client_id)!.push(t);
    });

    return {
      total: tickets.length,
      open: open.length,
      closed: closed.length,
      critical: critical.length,
      conf: conf.length,
      last30: last30.length,
      last7: last7.length,
      currentClientTickets,
      byClient,
    };
  }, [tickets, currentClientId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Exportar casos a CSV</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* General */}
        <DropdownMenuItem
          onClick={() => doExport(tickets, clients, "casos_sva_general", "Export general")}
          className="gap-2 text-xs"
        >
          <List className="h-3.5 w-3.5" />
          <span className="flex-1">Todos los casos</span>
          <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{stats.total}</Badge>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => doExport(tickets.filter(t => !isTicketClosed(t.estado)), clients, "casos_sva_abiertos", "Export abiertos")}
          className="gap-2 text-xs"
        >
          <span className="pl-5 flex-1">Solo abiertos</span>
          <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{stats.open}</Badge>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => doExport(tickets.filter(t => /critica/i.test(t.prioridad || "")), clients, "casos_sva_criticos", "Export críticos")}
          className="gap-2 text-xs"
          disabled={stats.critical === 0}
        >
          <span className="pl-5 flex-1">Solo críticos</span>
          <Badge variant="outline" className="text-[10px] h-4 tabular-nums bg-destructive/10 text-destructive border-destructive/30">{stats.critical}</Badge>
        </DropdownMenuItem>

        {stats.conf > 0 && (
          <DropdownMenuItem
            onClick={() => doExport(tickets.filter(t => t.is_confidential), clients, "casos_sva_confidenciales", "Export confidenciales")}
            className="gap-2 text-xs"
          >
            <Lock className="h-3 w-3 ml-0.5" />
            <span className="flex-1">Confidenciales (sin desifrar)</span>
            <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{stats.conf}</Badge>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">Por período</DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => {
            const cutoff = new Date(Date.now() - 7 * 86400000);
            doExport(tickets.filter(t => t.created_at && new Date(t.created_at) >= cutoff), clients, "casos_sva_7d", "Export últimos 7 días");
          }}
          className="gap-2 text-xs"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="flex-1">Últimos 7 días</span>
          <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{stats.last7}</Badge>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            const cutoff = new Date(Date.now() - 30 * 86400000);
            doExport(tickets.filter(t => t.created_at && new Date(t.created_at) >= cutoff), clients, "casos_sva_30d", "Export últimos 30 días");
          }}
          className="gap-2 text-xs"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="flex-1">Últimos 30 días</span>
          <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{stats.last30}</Badge>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">Por cliente</DropdownMenuLabel>

        {/* Cliente actualmente seleccionado (shortcut) */}
        {currentClient && stats.currentClientTickets.length > 0 && (
          <DropdownMenuItem
            onClick={() => doExport(
              stats.currentClientTickets,
              clients,
              `casos_${safeFilename(currentClient.name)}`,
              `Export ${currentClient.name}`
            )}
            className="gap-2 text-xs bg-primary/5"
          >
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="flex-1 font-semibold">{currentClient.name} <span className="text-muted-foreground font-normal">(actual)</span></span>
            <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{stats.currentClientTickets.length}</Badge>
          </DropdownMenuItem>
        )}

        {/* Submenu con todos los clientes */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            <span className="flex-1">Seleccionar cliente…</span>
            <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{stats.byClient.size}</Badge>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-h-[360px] overflow-auto w-60">
              {Array.from(stats.byClient.entries())
                .map(([id, items]) => ({ id, items, name: clients.find(c => c.id === id)?.name || id }))
                .sort((a, b) => b.items.length - a.items.length)
                .map(({ id, items, name }) => (
                  <DropdownMenuItem
                    key={id}
                    onClick={() => doExport(items, clients, `casos_${safeFilename(name)}`, `Export ${name}`)}
                    className="gap-2 text-xs"
                  >
                    <span className="flex-1 truncate">{name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{items.length}</Badge>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
