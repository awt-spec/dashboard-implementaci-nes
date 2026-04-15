import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, X, Flame, Clock, Shield, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SupportTicket } from "@/hooks/useSupportTickets";

const prioridadOrder = ["Critica, Impacto Negocio", "Alta", "Media", "Baja"];
const estadoOrder = ["EN ATENCIÓN", "PENDIENTE", "ENTREGADA", "POR CERRAR", "COTIZADA", "APROBADA", "VALORACIÓN", "ON HOLD"];

function prioLabel(p: string) {
  return p === "Critica, Impacto Negocio" ? "Crítica" : p;
}

function prioIcon(p: string) {
  if (p === "Critica, Impacto Negocio") return <Flame className="h-3.5 w-3.5" />;
  if (p === "Alta") return <Zap className="h-3.5 w-3.5" />;
  if (p === "Media") return <Shield className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
}

// Rich color system: priority sets base, aging modulates
function caseColor(prioridad: string, dias: number) {
  const palettes: Record<string, { bg: string[]; text: string[]; border: string[]; glow: string }> = {
    "Critica, Impacto Negocio": {
      bg: ["#fca5a5", "#f87171", "#ef4444", "#dc2626", "#991b1b"],
      text: ["#7f1d1d", "#7f1d1d", "#fff", "#fff", "#fff"],
      border: ["#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626"],
      glow: "rgba(239,68,68,0.5)",
    },
    "Alta": {
      bg: ["#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c"],
      text: ["#7c2d12", "#7c2d12", "#fff", "#fff", "#fff"],
      border: ["#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c"],
      glow: "rgba(249,115,22,0.4)",
    },
    "Media": {
      bg: ["#fde68a", "#fcd34d", "#f59e0b", "#d97706", "#b45309"],
      text: ["#78350f", "#78350f", "#78350f", "#fff", "#fff"],
      border: ["#fef3c7", "#fde68a", "#fcd34d", "#f59e0b", "#d97706"],
      glow: "rgba(245,158,11,0.3)",
    },
    "Baja": {
      bg: ["#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155"],
      text: ["#1e293b", "#1e293b", "#fff", "#fff", "#fff"],
      border: ["#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569"],
      glow: "rgba(100,116,139,0.2)",
    },
  };
  const p = palettes[prioridad] || palettes["Baja"];
  let idx = 0;
  if (dias > 365) idx = 4;
  else if (dias > 180) idx = 3;
  else if (dias > 90) idx = 2;
  else if (dias > 30) idx = 1;
  return { bg: p.bg[idx], text: p.text[idx], border: p.border[idx], glow: p.glow };
}

// Dynamic sizing — older/critical = bigger presence
function cellSize(dias: number, prioridad: string): number {
  let base = 44;
  if (dias > 365) base = 60;
  else if (dias > 180) base = 54;
  else if (dias > 90) base = 50;
  else if (dias > 30) base = 46;
  if (prioridad === "Critica, Impacto Negocio") base += 4;
  return base;
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
    let maxDias = 0, totalDias = 0;
    activeTickets.forEach(t => {
      byPrio[t.prioridad] = (byPrio[t.prioridad] || 0) + 1;
      if (t.dias_antiguedad > maxDias) maxDias = t.dias_antiguedad;
      totalDias += t.dias_antiguedad;
    });
    const avgDias = activeTickets.length > 0 ? Math.round(totalDias / activeTickets.length) : 0;
    const critical = (byPrio["Critica, Impacto Negocio"] || 0) + (byPrio["Alta"] || 0);
    return { byPrio, total: activeTickets.length, maxDias, avgDias, critical };
  }, [activeTickets]);

  if (activeTickets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Activity className="h-8 w-8 mx-auto mb-3 opacity-20" />
          No hay casos activos para {clientName}
        </CardContent>
      </Card>
    );
  }

  const expandedTicket = expandedId ? activeTickets.find(x => x.id === expandedId) : null;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Casos Activos", value: summary.total, icon: Activity, color: "from-blue-500/15 to-transparent", borderColor: "border-blue-500/20", textColor: "text-blue-500" },
          { label: "Críticos + Altos", value: summary.critical, icon: AlertTriangle, color: "from-red-500/15 to-transparent", borderColor: "border-red-500/20", textColor: "text-red-500" },
          { label: "Máx. Antigüedad", value: `${summary.maxDias}d`, icon: TrendingUp, color: "from-orange-500/15 to-transparent", borderColor: "border-orange-500/20", textColor: "text-orange-500" },
          { label: "Promedio Días", value: `${summary.avgDias}d`, icon: Clock, color: "from-muted to-transparent", borderColor: "border-border", textColor: "text-foreground" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 200 }}
            className={`relative overflow-hidden rounded-xl border ${kpi.borderColor} bg-gradient-to-br ${kpi.color} p-4`}>
            <kpi.icon className={`absolute top-3 right-3 h-5 w-5 ${kpi.textColor} opacity-20`} />
            <div className={`text-2xl font-black tracking-tight ${kpi.textColor}`}>{kpi.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Main Heatmap */}
      <Card className="overflow-hidden border-border/50">
        <CardHeader className="pb-3 border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10 shadow-sm">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <span>Mapa de Calor — <span className="text-primary">{clientName}</span></span>
            </CardTitle>
            <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/30">
              {(["prioridad", "estado"] as const).map(g => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`text-[11px] px-3 py-1.5 rounded-md font-semibold transition-all duration-200 ${
                    groupBy === g
                      ? "bg-background text-foreground shadow-sm border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {g === "prioridad" ? "Por Prioridad" : "Por Estado"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Cada celda representa un caso. El <strong>color</strong> indica la prioridad, el <strong>tamaño y oscuridad</strong> reflejan la antigüedad. Haz <strong>click</strong> en una celda para ver el detalle completo.
          </p>
        </CardHeader>

        <CardContent className="pt-5 space-y-6">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] px-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-xs">Prioridad:</span>
              {prioridadOrder.map(p => {
                const c = caseColor(p, 60);
                return (
                  <span key={p} className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full shadow-sm border" style={{ background: c.bg, borderColor: c.border }} />
                    <span className="text-muted-foreground">{prioLabel(p)}</span>
                  </span>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-xs">Antigüedad:</span>
              {[
                { label: "<1m", d: 10, p: "Media" },
                { label: "1-3m", d: 60, p: "Media" },
                { label: "3-6m", d: 120, p: "Media" },
                { label: ">6m", d: 200, p: "Media" },
                { label: ">1a", d: 400, p: "Media" },
              ].map(({ label, d, p }) => {
                const c = caseColor(p, d);
                return (
                  <span key={label} className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full shadow-sm border" style={{ background: c.bg, borderColor: c.border }} />
                    <span className="text-muted-foreground">{label}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Grouped Bubbles */}
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([group, cases], gi) => (
              <motion.div key={group}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: gi * 0.08, type: "spring", stiffness: 180 }}
              >
                {/* Group Header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    {groupBy === "prioridad" && prioIcon(group)}
                    {groupBy === "prioridad" ? prioLabel(group) : group}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-mono px-2 h-5">{cases.length}</Badge>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
                </div>

                {/* Bubble Grid */}
                <div className="flex flex-wrap gap-2 items-end">
                  {cases.map((t, i) => {
                    const size = cellSize(t.dias_antiguedad, t.prioridad);
                    const color = caseColor(t.prioridad, t.dias_antiguedad);
                    const isHovered = hoveredId === t.id;
                    const isExpanded = expandedId === t.id;

                    return (
                      <motion.div key={t.id} className="relative"
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: gi * 0.05 + i * 0.02, type: "spring", stiffness: 260, damping: 18 }}>

                        <motion.button
                          whileHover={{ scale: 1.15, y: -4 }}
                          whileTap={{ scale: 0.92 }}
                          onHoverStart={() => setHoveredId(t.id)}
                          onHoverEnd={() => setHoveredId(null)}
                          onClick={() => setExpandedId(isExpanded ? null : t.id)}
                          className="relative flex items-center justify-center cursor-pointer transition-shadow duration-300"
                          style={{
                            width: size,
                            height: size,
                            borderRadius: "16px",
                            background: `linear-gradient(135deg, ${color.bg}, ${color.border})`,
                            color: color.text,
                            fontSize: size > 50 ? 14 : size > 44 ? 12 : 11,
                            fontWeight: 800,
                            fontFamily: "monospace",
                            border: `2px solid ${isExpanded ? "hsl(var(--primary))" : color.border}`,
                            boxShadow: isHovered
                              ? `0 8px 24px ${color.glow}, 0 0 0 2px ${color.border}`
                              : isExpanded
                                ? `0 0 0 3px hsl(var(--primary)), 0 4px 12px rgba(0,0,0,0.15)`
                                : `0 2px 8px rgba(0,0,0,0.1)`,
                          }}>
                          <span className="drop-shadow-sm">{t.dias_antiguedad}</span>

                          {/* Fire badge for >1 year */}
                          {t.dias_antiguedad > 365 && (
                            <motion.span
                              animate={{ scale: [1, 1.25, 1], rotate: [0, 5, -5, 0] }}
                              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                              className="absolute -top-1.5 -right-1.5 text-sm drop-shadow-md">
                              🔥
                            </motion.span>
                          )}

                          {/* AI classified indicator */}
                          {t.ai_classification && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-violet-500 border border-background shadow-sm" />
                          )}
                        </motion.button>

                        {/* Rich Tooltip */}
                        <AnimatePresence>
                          {isHovered && !isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.92 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.92 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                              <div className="bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-2xl px-3.5 py-2.5 min-w-[200px] max-w-[260px]">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color.bg }} />
                                  <span className="font-bold text-xs text-popover-foreground">{t.ticket_id}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug truncate mb-1.5">{t.asunto}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: `${color.bg}30`, color: color.bg }}>
                                    {prioLabel(t.prioridad)}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">{t.estado}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">{t.tipo}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-mono">{t.dias_antiguedad}d</span>
                                </div>
                                {t.ai_summary && (
                                  <p className="text-[9px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/40 italic line-clamp-2">🤖 {t.ai_summary}</p>
                                )}
                              </div>
                              <div className="w-2.5 h-2.5 bg-popover/95 border-b border-r border-border rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1.5" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Expanded Detail Panel */}
          <AnimatePresence mode="wait">
            {expandedTicket && (
              <motion.div
                key={expandedTicket.id}
                initial={{ opacity: 0, y: 12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 22 }}
                className="overflow-hidden">
                <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 via-card to-card p-5 shadow-lg mt-1">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <motion.div
                        initial={{ rotate: -10 }} animate={{ rotate: 0 }}
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-base shadow-md"
                        style={{
                          background: `linear-gradient(135deg, ${caseColor(expandedTicket.prioridad, expandedTicket.dias_antiguedad).bg}, ${caseColor(expandedTicket.prioridad, expandedTicket.dias_antiguedad).border})`,
                          color: caseColor(expandedTicket.prioridad, expandedTicket.dias_antiguedad).text,
                        }}>
                        {expandedTicket.dias_antiguedad}
                      </motion.div>
                      <div>
                        <div className="font-mono font-bold text-base">{expandedTicket.ticket_id}</div>
                        <div className="text-xs text-muted-foreground max-w-lg leading-relaxed">{expandedTicket.asunto}</div>
                      </div>
                    </div>
                    <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                      onClick={() => setExpandedId(null)}
                      className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </motion.button>
                  </div>

                  {/* Detail Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {[
                      { label: "Prioridad", value: prioLabel(expandedTicket.prioridad), accent: caseColor(expandedTicket.prioridad, 60).bg },
                      { label: "Estado", value: expandedTicket.estado },
                      { label: "Antigüedad", value: `${expandedTicket.dias_antiguedad} días` },
                      { label: "Tipo", value: expandedTicket.tipo },
                      { label: "Producto", value: expandedTicket.producto },
                      { label: "Responsable", value: expandedTicket.responsable || "Sin asignar" },
                      ...(expandedTicket.fecha_registro ? [{ label: "Registro", value: new Date(expandedTicket.fecha_registro).toLocaleDateString("es") }] : []),
                      ...(expandedTicket.ai_classification ? [{ label: "🤖 Clasificación", value: expandedTicket.ai_classification }] : []),
                      ...(expandedTicket.ai_risk_level ? [{ label: "🤖 Riesgo", value: expandedTicket.ai_risk_level }] : []),
                    ].map((item, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-xl bg-background/60 border border-border/30 px-3 py-2.5 backdrop-blur-sm">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">{item.label}</div>
                        <div className="text-xs font-semibold mt-1 truncate" style={item.accent ? { color: item.accent } : undefined}>
                          {item.value}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* AI Summary */}
                  {expandedTicket.ai_summary && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                      className="mt-3 rounded-xl bg-violet-500/5 border border-violet-500/20 px-4 py-3">
                      <div className="text-[10px] text-violet-400 font-bold uppercase tracking-wider mb-1">🤖 Resumen Inteligente</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{expandedTicket.ai_summary}</p>
                    </motion.div>
                  )}

                  {/* Notes */}
                  {expandedTicket.notas && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                      className="mt-2 rounded-xl bg-muted/20 border border-border/30 px-4 py-3">
                      <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">📝 Notas</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{expandedTicket.notas}</p>
                    </motion.div>
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
