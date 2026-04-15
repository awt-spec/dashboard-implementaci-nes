import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, X, Flame, Clock, Shield, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SupportTicket } from "@/hooks/useSupportTickets";

const prioridadOrder = ["Critica, Impacto Negocio", "Alta", "Media", "Baja"];
const estadoOrder = ["EN ATENCIÓN", "PENDIENTE", "ENTREGADA", "POR CERRAR", "COTIZADA", "APROBADA", "VALORACIÓN", "ON HOLD"];

function prioLabel(p: string) {
  return p === "Critica, Impacto Negocio" ? "Crítica" : p;
}

function prioIcon(p: string) {
  if (p === "Critica, Impacto Negocio") return <Flame className="h-3 w-3" />;
  if (p === "Alta") return <Zap className="h-3 w-3" />;
  if (p === "Media") return <Shield className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

// Gradient-based heat: priority sets hue, aging sets lightness/saturation
function caseHeatGradient(prioridad: string, dias: number): string {
  const configs: Record<string, { h: number; s: number }> = {
    "Critica, Impacto Negocio": { h: 0, s: 85 },
    "Alta": { h: 25, s: 80 },
    "Media": { h: 45, s: 75 },
    "Baja": { h: 210, s: 30 },
  };
  const { h, s } = configs[prioridad] || { h: 210, s: 30 };
  // Aging drives luminance: newer=lighter, older=darker
  let l = 65;
  if (dias > 365) l = 30;
  else if (dias > 180) l = 38;
  else if (dias > 90) l = 46;
  else if (dias > 30) l = 55;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function caseGlow(prioridad: string, dias: number): string {
  if (prioridad === "Critica, Impacto Negocio" && dias > 90)
    return "0 0 12px rgba(239,68,68,0.6), 0 0 4px rgba(239,68,68,0.3)";
  if (prioridad === "Alta" && dias > 180)
    return "0 0 8px rgba(249,115,22,0.4)";
  return "none";
}

function agingEmoji(dias: number) {
  if (dias > 365) return "🔥";
  if (dias > 180) return "🟠";
  if (dias > 90) return "🟡";
  if (dias > 30) return "🟢";
  return "⚪";
}

// Size based on aging — older = bigger visual weight
function cellSize(dias: number): number {
  if (dias > 365) return 48;
  if (dias > 180) return 42;
  if (dias > 90) return 38;
  return 34;
}

interface Props {
  tickets: SupportTicket[];
  clientName: string;
}

export function SupportClientHeatmap({ tickets, clientName }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"prioridad" | "estado">("prioridad");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeTickets = useMemo(() =>
    tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado))
      .sort((a, b) => b.dias_antiguedad - a.dias_antiguedad),
    [tickets]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SupportTicket[]>();
    const order = groupBy === "prioridad" ? prioridadOrder : estadoOrder;
    order.forEach(k => map.set(k, []));
    activeTickets.forEach(t => {
      const key = groupBy === "prioridad" ? t.prioridad : t.estado;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    for (const [k, v] of map) if (v.length === 0) map.delete(k);
    return map;
  }, [activeTickets, groupBy]);

  const summary = useMemo(() => {
    const byPrio: Record<string, number> = {};
    let maxDias = 0;
    let avgDias = 0;
    activeTickets.forEach(t => {
      byPrio[t.prioridad] = (byPrio[t.prioridad] || 0) + 1;
      if (t.dias_antiguedad > maxDias) maxDias = t.dias_antiguedad;
      avgDias += t.dias_antiguedad;
    });
    avgDias = activeTickets.length > 0 ? Math.round(avgDias / activeTickets.length) : 0;
    return { byPrio, total: activeTickets.length, maxDias, avgDias };
  }, [activeTickets]);

  if (activeTickets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
          No hay casos activos para {clientName}
        </CardContent>
      </Card>
    );
  }

  const expandedTicket = expandedId ? activeTickets.find(x => x.id === expandedId) : null;

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 p-3 text-center">
          <div className="text-2xl font-black tracking-tight">{summary.total}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Casos Activos</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/10 to-card p-3 text-center">
          <div className="text-2xl font-black tracking-tight text-red-400">{summary.byPrio["Critica, Impacto Negocio"] || 0}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Críticas</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-card p-3 text-center">
          <div className="text-2xl font-black tracking-tight text-orange-400">{summary.maxDias}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Máx. Días</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 p-3 text-center">
          <div className="text-2xl font-black tracking-tight">{summary.avgDias}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Promedio Días</div>
        </motion.div>
      </div>

      {/* Heatmap Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-card via-muted/20 to-card">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              Mapa de Calor — {clientName}
            </CardTitle>
            <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5">
              {(["prioridad", "estado"] as const).map(g => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`text-[10px] px-3 py-1 rounded-md font-medium transition-all ${groupBy === g ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {g === "prioridad" ? "Prioridad" : "Estado"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Cada celda = 1 caso. Tamaño y oscuridad = antigüedad. Click para detalles.
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground px-1">
            <span className="font-semibold text-foreground">Prioridad:</span>
            {prioridadOrder.map(p => (
              <span key={p} className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-[4px] inline-block shadow-sm" style={{ background: caseHeatGradient(p, 60) }} />
                {prioLabel(p)}
              </span>
            ))}
            <span className="font-semibold text-foreground ml-2">Antigüedad:</span>
            {[
              { label: "<1m", d: 15 },
              { label: "1-3m", d: 60 },
              { label: "3-6m", d: 120 },
              { label: ">6m", d: 200 },
              { label: ">1a", d: 400 },
            ].map(({ label, d }) => (
              <span key={label} className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-[4px] inline-block" style={{ background: caseHeatGradient("Media", d) }} />
                {label}
              </span>
            ))}
          </div>

          {/* Grouped grid */}
          {Array.from(grouped.entries()).map(([group, cases], gi) => (
            <motion.div key={group}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: gi * 0.06 }}
              className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  {groupBy === "prioridad" && prioIcon(group)}
                  {groupBy === "prioridad" ? prioLabel(group) : group}
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono">{cases.length}</Badge>
                <div className="flex-1 h-px bg-border/40" />
              </div>
              <div className="flex flex-wrap gap-1.5 pl-1">
                {cases.map((t, i) => {
                  const size = cellSize(t.dias_antiguedad);
                  const isHovered = hoveredId === t.id;
                  const isExpanded = expandedId === t.id;
                  return (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: gi * 0.04 + i * 0.015, type: "spring", stiffness: 300, damping: 20 }}
                      whileHover={{ scale: 1.2, zIndex: 20 }}
                      whileTap={{ scale: 0.9 }}
                      onHoverStart={() => setHoveredId(t.id)}
                      onHoverEnd={() => setHoveredId(null)}
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className={`relative rounded-lg font-mono font-black flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${isExpanded ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
                      style={{
                        width: size,
                        height: size,
                        fontSize: size > 40 ? 11 : 9,
                        background: caseHeatGradient(t.prioridad, t.dias_antiguedad),
                        boxShadow: isHovered ? caseGlow(t.prioridad, t.dias_antiguedad) : "0 1px 3px rgba(0,0,0,0.2)",
                        color: t.dias_antiguedad > 60 || t.prioridad === "Critica, Impacto Negocio" ? "white" : "rgba(0,0,0,0.8)",
                      }}
                    >
                      <span>{t.dias_antiguedad}</span>
                      {t.dias_antiguedad > 365 && (
                        <motion.span
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="absolute -top-1 -right-1 text-[10px]"
                        >🔥</motion.span>
                      )}
                      {/* Hover tooltip */}
                      <AnimatePresence>
                        {isHovered && !isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.9 }}
                            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                          >
                            <div className="bg-popover border border-border rounded-lg shadow-xl px-3 py-2 text-[10px] whitespace-nowrap text-popover-foreground">
                              <div className="font-bold text-[11px]">{t.ticket_id}</div>
                              <div className="text-muted-foreground max-w-[200px] truncate">{t.asunto}</div>
                              <div className="flex gap-2 mt-1">
                                <span>{prioLabel(t.prioridad)}</span>
                                <span>·</span>
                                <span>{t.estado}</span>
                                <span>·</span>
                                <span>{t.tipo}</span>
                              </div>
                            </div>
                            <div className="w-2 h-2 bg-popover border-b border-r border-border rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}

          {/* Expanded detail panel */}
          <AnimatePresence>
            {expandedTicket && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-4 space-y-3 mt-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-black text-sm"
                        style={{ background: caseHeatGradient(expandedTicket.prioridad, expandedTicket.dias_antiguedad), color: "white" }}>
                        {expandedTicket.dias_antiguedad}
                      </div>
                      <div>
                        <div className="font-mono font-bold text-sm">{expandedTicket.ticket_id}</div>
                        <div className="text-xs text-muted-foreground max-w-md">{expandedTicket.asunto}</div>
                      </div>
                    </div>
                    <button onClick={() => setExpandedId(null)}
                      className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Prioridad", value: prioLabel(expandedTicket.prioridad), color: caseHeatGradient(expandedTicket.prioridad, 60) },
                      { label: "Estado", value: expandedTicket.estado },
                      { label: "Antigüedad", value: `${expandedTicket.dias_antiguedad} días ${agingEmoji(expandedTicket.dias_antiguedad)}` },
                      { label: "Tipo", value: expandedTicket.tipo },
                      { label: "Producto", value: expandedTicket.producto },
                      { label: "Responsable", value: expandedTicket.responsable || "—" },
                      ...(expandedTicket.ai_classification ? [{ label: "🤖 IA Clasificación", value: expandedTicket.ai_classification }] : []),
                      ...(expandedTicket.ai_risk_level ? [{ label: "🤖 IA Riesgo", value: expandedTicket.ai_risk_level }] : []),
                    ].map((item, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</div>
                        <div className="text-xs font-semibold mt-0.5" style={item.color ? { color: item.color } : undefined}>{item.value}</div>
                      </motion.div>
                    ))}
                  </div>

                  {expandedTicket.ai_summary && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                      className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                      <div className="text-[10px] text-primary font-semibold mb-0.5">🤖 Resumen IA</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{expandedTicket.ai_summary}</p>
                    </motion.div>
                  )}

                  {expandedTicket.notas && (
                    <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2">
                      <div className="text-[10px] text-muted-foreground font-semibold mb-0.5">📝 Notas</div>
                      <p className="text-xs text-muted-foreground">{expandedTicket.notas}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
