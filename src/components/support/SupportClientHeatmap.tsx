import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SupportTicket } from "@/hooks/useSupportTickets";

const prioridadOrder = ["Critica, Impacto Negocio", "Alta", "Media", "Baja"];
const estadoOrder = ["EN ATENCIÓN", "PENDIENTE", "ENTREGADA", "POR CERRAR", "COTIZADA", "APROBADA", "VALORACIÓN", "ON HOLD"];

function prioLabel(p: string) {
  return p === "Critica, Impacto Negocio" ? "Crítica" : p;
}

// Heatmap cell color: blends priority severity with aging intensity
function caseHeatColor(prioridad: string, dias: number): string {
  // Base hue by priority
  const hues: Record<string, [number, number, number]> = {
    "Critica, Impacto Negocio": [239, 68, 68],
    "Alta": [249, 115, 22],
    "Media": [234, 179, 8],
    "Baja": [148, 163, 184],
  };
  const [r, g, b] = hues[prioridad] || [148, 163, 184];
  // Aging drives alpha: 0-30d → 0.3, 30-90 → 0.5, 90-180 → 0.7, 180+ → 0.9
  let alpha = 0.3;
  if (dias > 180) alpha = 0.9;
  else if (dias > 90) alpha = 0.7;
  else if (dias > 30) alpha = 0.5;
  return `rgba(${r},${g},${b},${alpha})`;
}

function agingLabel(dias: number) {
  if (dias > 365) return "🔴 >1 año";
  if (dias > 180) return "🟠 >6 meses";
  if (dias > 90) return "🟡 >3 meses";
  if (dias > 30) return "🟢 >1 mes";
  return "⚪ <1 mes";
}

interface Props {
  tickets: SupportTicket[];
  clientName: string;
}

export function SupportClientHeatmap({ tickets, clientName }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"prioridad" | "estado">("prioridad");

  const activeTickets = useMemo(() =>
    tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado))
      .sort((a, b) => b.dias_antiguedad - a.dias_antiguedad),
    [tickets]
  );

  // Group tickets
  const grouped = useMemo(() => {
    const map = new Map<string, SupportTicket[]>();
    const order = groupBy === "prioridad" ? prioridadOrder : estadoOrder;
    order.forEach(k => map.set(k, []));
    activeTickets.forEach(t => {
      const key = groupBy === "prioridad" ? t.prioridad : t.estado;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    // Remove empty groups
    for (const [k, v] of map) if (v.length === 0) map.delete(k);
    return map;
  }, [activeTickets, groupBy]);

  const summary = useMemo(() => {
    const byPrio: Record<string, number> = {};
    activeTickets.forEach(t => {
      byPrio[t.prioridad] = (byPrio[t.prioridad] || 0) + 1;
    });
    return { byPrio, total: activeTickets.length };
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
      {/* Summary + Controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold">{clientName}</span>
          <Badge variant="outline" className="text-xs">{summary.total} activos</Badge>
          {prioridadOrder.map(p => summary.byPrio[p] ? (
            <Badge key={p} variant="outline" className="text-[10px]" style={{ background: caseHeatColor(p, 100), borderColor: "transparent", color: p === "Critica, Impacto Negocio" ? "white" : undefined }}>
              {prioLabel(p)}: {summary.byPrio[p]}
            </Badge>
          ) : null)}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setGroupBy("prioridad")} className={`text-[10px] px-2 py-1 rounded border ${groupBy === "prioridad" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground border-border"}`}>
            Por Prioridad
          </button>
          <button onClick={() => setGroupBy("estado")} className={`text-[10px] px-2 py-1 rounded border ${groupBy === "estado" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground border-border"}`}>
            Por Estado
          </button>
        </div>
      </div>

      {/* Visual Heatmap Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Mapa de Calor por Caso — {clientName}
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Cada celda = 1 caso. Color = prioridad. Intensidad = antigüedad. Click para detalles.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="font-medium">Leyenda:</span>
            {prioridadOrder.map(p => (
              <span key={p} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: caseHeatColor(p, 100) }} />
                {prioLabel(p)}
              </span>
            ))}
            <span className="ml-2">| Intensidad:</span>
            <span>Claro = reciente</span>
            <span>Oscuro = antiguo</span>
          </div>

          {/* Grouped grid */}
          {Array.from(grouped.entries()).map(([group, cases]) => (
            <div key={group} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{groupBy === "prioridad" ? prioLabel(group) : group}</span>
                <Badge variant="secondary" className="text-[10px]">{cases.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {cases.map(t => (
                  <motion.button
                    key={t.id}
                    layout
                    whileHover={{ scale: 1.15, zIndex: 10 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className={`relative w-9 h-9 rounded-md text-[8px] font-mono font-bold flex items-center justify-center cursor-pointer border transition-all ${expandedId === t.id ? "ring-2 ring-primary border-primary" : "border-transparent"}`}
                    style={{
                      background: caseHeatColor(t.prioridad, t.dias_antiguedad),
                      color: t.dias_antiguedad > 90 || t.prioridad === "Critica, Impacto Negocio" ? "white" : undefined,
                    }}
                    title={`${t.ticket_id} — ${t.asunto} (${t.dias_antiguedad}d)`}
                  >
                    {t.dias_antiguedad}
                  </motion.button>
                ))}
              </div>
            </div>
          ))}

          {/* Expanded detail */}
          <AnimatePresence>
            {expandedId && (() => {
              const t = activeTickets.find(x => x.id === expandedId);
              if (!t) return null;
              return (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-lg border border-border bg-card p-3 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-sm">{t.ticket_id}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span className="text-xs">{t.asunto}</span>
                    </div>
                    <button onClick={() => setExpandedId(null)} className="text-muted-foreground hover:text-foreground">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div><span className="text-muted-foreground">Prioridad:</span> <span className="font-medium">{prioLabel(t.prioridad)}</span></div>
                    <div><span className="text-muted-foreground">Estado:</span> <span className="font-medium">{t.estado}</span></div>
                    <div><span className="text-muted-foreground">Días:</span> <span className="font-bold">{t.dias_antiguedad}</span> <span className="text-[10px]">{agingLabel(t.dias_antiguedad)}</span></div>
                    <div><span className="text-muted-foreground">Tipo:</span> <span>{t.tipo}</span></div>
                    <div><span className="text-muted-foreground">Producto:</span> <span>{t.producto}</span></div>
                    <div><span className="text-muted-foreground">Responsable:</span> <span>{t.responsable || "—"}</span></div>
                    {t.ai_classification && <div><span className="text-muted-foreground">IA Clasificación:</span> <span>{t.ai_classification}</span></div>}
                    {t.ai_risk_level && <div><span className="text-muted-foreground">IA Riesgo:</span> <span>{t.ai_risk_level}</span></div>}
                  </div>
                  {t.ai_summary && <p className="text-[11px] text-muted-foreground italic border-t border-border/30 pt-1">{t.ai_summary}</p>}
                  {t.notas && <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-1">📝 {t.notas}</p>}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
