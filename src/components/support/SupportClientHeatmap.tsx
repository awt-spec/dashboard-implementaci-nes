import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import type { SupportTicket } from "@/hooks/useSupportTickets";

const prioridadOrder = ["Critica, Impacto Negocio", "Alta", "Media", "Baja"];
const estadoOrder = ["EN ATENCIÓN", "PENDIENTE", "ENTREGADA", "POR CERRAR", "COTIZADA", "APROBADA", "VALORACIÓN", "ON HOLD"];

// Color functions for cells
function prioBg(prio: string): string {
  if (prio === "Critica, Impacto Negocio") return "rgba(239,68,68,0.7)";
  if (prio === "Alta") return "rgba(249,115,22,0.5)";
  if (prio === "Media") return "rgba(234,179,8,0.35)";
  return "rgba(148,163,184,0.2)";
}

function estadoBg(estado: string): string {
  if (estado === "EN ATENCIÓN") return "rgba(59,130,246,0.3)";
  if (estado === "PENDIENTE") return "rgba(249,115,22,0.3)";
  if (estado === "ENTREGADA") return "rgba(234,179,8,0.3)";
  if (estado === "POR CERRAR") return "rgba(34,197,94,0.25)";
  return "rgba(148,163,184,0.15)";
}

function agingColor(dias: number): string {
  if (dias > 365) return "rgba(239,68,68,0.6)";
  if (dias > 180) return "rgba(249,115,22,0.4)";
  if (dias > 90) return "rgba(234,179,8,0.3)";
  return "rgba(34,197,94,0.2)";
}

interface Props {
  tickets: SupportTicket[];
  clientName: string;
}

export function SupportClientHeatmap({ tickets, clientName }: Props) {
  const activeTickets = useMemo(() =>
    tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado))
      .sort((a, b) => b.dias_antiguedad - a.dias_antiguedad),
    [tickets]
  );

  // Matrix: ticket × (prioridad, estado, días, tipo)
  const estadosPresent = useMemo(() => {
    const set = new Set<string>();
    activeTickets.forEach(t => set.add(t.estado));
    return estadoOrder.filter(e => set.has(e));
  }, [activeTickets]);

  // Summary row
  const summary = useMemo(() => {
    const byPrio: Record<string, number> = {};
    const byEstado: Record<string, number> = {};
    activeTickets.forEach(t => {
      byPrio[t.prioridad] = (byPrio[t.prioridad] || 0) + 1;
      byEstado[t.estado] = (byEstado[t.estado] || 0) + 1;
    });
    return { byPrio, byEstado, total: activeTickets.length };
  }, [activeTickets]);

  if (activeTickets.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No hay casos activos para {clientName}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium">{clientName}</span>
        <Badge variant="outline" className="text-xs">{summary.total} activos</Badge>
        {prioridadOrder.map(p => summary.byPrio[p] ? (
          <Badge key={p} variant="outline" className="text-[10px]" style={{ background: prioBg(p), borderColor: "transparent" }}>
            {p === "Critica, Impacto Negocio" ? "Crítica" : p}: {summary.byPrio[p]}
          </Badge>
        ) : null)}
      </div>

      {/* Case-level heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Mapa de Calor por Caso — {clientName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-1.5 font-medium text-muted-foreground border-b border-border min-w-[80px]">Ticket</th>
                  <th className="text-left p-1.5 font-medium text-muted-foreground border-b border-border min-w-[200px]">Asunto</th>
                  <th className="text-center p-1.5 font-medium text-muted-foreground border-b border-border w-16">Tipo</th>
                  <th className="text-center p-1.5 font-medium border-b border-border w-20" style={{ color: "rgb(239,68,68)" }}>Prioridad</th>
                  <th className="text-center p-1.5 font-medium border-b border-border w-24" style={{ color: "rgb(59,130,246)" }}>Estado</th>
                  <th className="text-center p-1.5 font-medium border-b border-border w-16" style={{ color: "rgb(249,115,22)" }}>Días</th>
                  <th className="text-center p-1.5 font-medium text-muted-foreground border-b border-border w-16">Producto</th>
                  <th className="text-center p-1.5 font-medium text-muted-foreground border-b border-border w-20">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {activeTickets.map(t => (
                  <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-1.5 font-mono font-bold border-b border-border/20 whitespace-nowrap">{t.ticket_id}</td>
                    <td className="p-1.5 border-b border-border/20 max-w-[250px] truncate" title={t.asunto}>{t.asunto}</td>
                    <td className="p-1.5 text-center border-b border-border/20 whitespace-nowrap">{t.tipo}</td>
                    <td className="p-1.5 text-center font-bold border-b border-border/20 rounded-sm" style={{ background: prioBg(t.prioridad), color: t.prioridad === "Critica, Impacto Negocio" ? "white" : undefined }}>
                      {t.prioridad === "Critica, Impacto Negocio" ? "Crítica" : t.prioridad}
                    </td>
                    <td className="p-1.5 text-center border-b border-border/20 rounded-sm" style={{ background: estadoBg(t.estado) }}>
                      {t.estado}
                    </td>
                    <td className="p-1.5 text-center font-mono font-bold border-b border-border/20 rounded-sm" style={{ background: agingColor(t.dias_antiguedad), color: t.dias_antiguedad > 365 ? "white" : undefined }}>
                      {t.dias_antiguedad}
                    </td>
                    <td className="p-1.5 text-center text-muted-foreground border-b border-border/20 whitespace-nowrap">{t.producto}</td>
                    <td className="p-1.5 text-center text-muted-foreground border-b border-border/20 whitespace-nowrap">{t.responsable || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
