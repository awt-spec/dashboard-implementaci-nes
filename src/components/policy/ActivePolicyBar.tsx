/**
 * ActivePolicyBar — strip compacto que muestra las reglas activas v4.5
 * relevantes al contexto operativo. Se inyecta en Bandeja, Sprint Board, etc.
 *
 * Filosofía: "La política está en la cancha" — el operador ve sus reglas
 * mientras trabaja, no en un panel separado de Configuración.
 */
import { useState } from "react";
import { useBusinessRules } from "@/hooks/useBusinessRules";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ListChecks, FileSignature, BarChart3, CalendarClock,
  ShieldCheck, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivePolicyBarProps {
  /** Filtra qué tipos de regla mostrar. Default: muestra todas. */
  ruleTypes?: Array<"sla" | "checklist" | "signature" | "metric" | "weekly">;
  /** Compacto = solo título + count. Expandido = muestra detalle inline. */
  compact?: boolean;
  /** Texto del header (default: "Política activa") */
  title?: string;
  /** className override */
  className?: string;
}

const TYPE_META: Record<string, { label: string; Icon: typeof Clock; tone: string }> = {
  sla:        { label: "SLA",         Icon: Clock,         tone: "text-blue-500" },
  checklist:  { label: "Checklist",   Icon: ListChecks,    tone: "text-emerald-500" },
  signature:  { label: "Firma",       Icon: FileSignature, tone: "text-violet-500" },
  metric:     { label: "Métricas",    Icon: BarChart3,     tone: "text-amber-500" },
  weekly:     { label: "Cierre sem.", Icon: CalendarClock, tone: "text-rose-500" },
};

export function ActivePolicyBar({
  ruleTypes,
  compact = false,
  title = "Política activa v4.5",
  className,
}: ActivePolicyBarProps) {
  const { data: rules = [], isLoading } = useBusinessRules();
  const [expanded, setExpanded] = useState(!compact);

  const activeRules = rules.filter(r => {
    if (!r.is_active) return false;
    if (r.policy_version !== "v4.5") return false;
    if (ruleTypes && !ruleTypes.includes(r.rule_type as any)) return false;
    return true;
  });

  if (isLoading || activeRules.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-primary/20 bg-gradient-to-r from-primary/[0.04] via-card to-card overflow-hidden",
        className
      )}
    >
      {/* Header — clickable para colapsar/expandir */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-primary/[0.02] transition-colors"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary">{title}</span>

        {/* Type chips inline */}
        <div className="flex items-center gap-1 flex-wrap">
          {activeRules.map(r => {
            const m = TYPE_META[r.rule_type] || { label: r.rule_type, Icon: ListChecks, tone: "text-muted-foreground" };
            return (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/60 bg-background/50 text-[10px] font-semibold"
              >
                <m.Icon className={cn("h-2.5 w-2.5", m.tone)} />
                {m.label}
              </span>
            );
          })}
        </div>

        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
          {expanded ? "Ocultar" : "Ver detalle"}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </button>

      {/* Contenido expandido — muestra los detalles operacionales relevantes */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/40">
              {activeRules.map(r => {
                const m = TYPE_META[r.rule_type] || { label: r.rule_type, Icon: ListChecks, tone: "" };
                return (
                  <div key={r.id} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <m.Icon className={cn("h-3 w-3", m.tone)} />
                      <span className="text-[11px] font-bold">{r.name}</span>
                    </div>

                    {/* SLA: mini-tabla con plazos por prioridad */}
                    {r.rule_type === "sla" && Array.isArray(r.content?.deadlines) && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 ml-4">
                        {r.content.deadlines.slice(0, 8).map((d: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background/60 border border-border/40 text-[10px]"
                          >
                            <span className="font-semibold capitalize truncate">{d.priority || d.case_type}</span>
                            <span className="font-mono tabular-nums text-blue-500 font-bold shrink-0">
                              {d.deadline_days}d
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Checklist: lista compacta */}
                    {r.rule_type === "checklist" && Array.isArray(r.content?.items) && (
                      <ul className="ml-4 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {r.content.items.slice(0, 6).map((it: any, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10px]">
                            <span className="h-1 w-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <span className="text-muted-foreground line-clamp-1">{it.label}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Métricas: chips */}
                    {r.rule_type === "metric" && Array.isArray(r.content?.metrics) && (
                      <div className="flex flex-wrap gap-1 ml-4">
                        {r.content.metrics.slice(0, 6).map((m: any, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            {m.label || m.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Cierre semanal: descripción corta */}
                    {r.rule_type === "weekly" && r.description && (
                      <p className="text-[10px] text-muted-foreground ml-4 line-clamp-2">{r.description}</p>
                    )}
                  </div>
                );
              })}

              <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                  {activeRules.length} regla{activeRules.length === 1 ? "" : "s"} aplicada{activeRules.length === 1 ? "" : "s"}
                </span>
                <span className="text-[9px] text-muted-foreground inline-flex items-center gap-1">
                  Editar en Configuración → Política
                  <ExternalLink className="h-2.5 w-2.5" />
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Helper: dada una boleta, calcula su estado SLA según la política activa.
 * Devuelve null si no hay regla aplicable o no hay fecha de registro.
 *
 * BEST-MATCH (consistente con la Postgres function get_tickets_sla_status):
 *   1) priority + case_type ambos coinciden (más específico)
 *   2) priority solo (más estricto primero, ASC por deadline_days)
 *   3) case_type solo
 *   4) fallback a "media"
 */
export function computeSLAStatus(
  ticket: { fecha_registro?: string | null; created_at?: string; prioridad?: string; tipo?: string; estado?: string },
  rules: Array<{ rule_type: string; is_active: boolean; policy_version: string; content: any }>
): { deadlineDays: number; daysElapsed: number; status: "ok" | "warning" | "overdue" } | null {
  if (ticket.estado && ["CERRADA", "ANULADA", "ENTREGADA", "APROBADA"].includes(ticket.estado)) return null;

  const slaRule = rules.find(r => r.rule_type === "sla" && r.is_active && r.policy_version === "v4.5");
  if (!slaRule) return null;

  const deadlines: any[] = slaRule.content?.deadlines || [];
  const prio = (ticket.prioridad || "").toLowerCase();
  const tipo = (ticket.tipo || "").toLowerCase();

  const matchesPrio = (d: any) =>
    !!d.priority && prio.includes((d.priority as string).toLowerCase());
  const matchesType = (d: any) =>
    !!d.case_type && tipo.includes((d.case_type as string).toLowerCase());

  // 1) ambos coinciden — más específico
  let match: any = deadlines.find(d => matchesPrio(d) && matchesType(d));

  // 2) priority solo (orden por deadline_days ASC para preferir el más estricto)
  if (!match) {
    const candidates = deadlines.filter(matchesPrio);
    candidates.sort((a, b) => (a.deadline_days || 999) - (b.deadline_days || 999));
    match = candidates[0];
  }

  // 3) case_type solo
  if (!match) match = deadlines.find(matchesType);

  // 4) fallback "media"
  if (!match) match = deadlines.find(d => (d.priority || "").toLowerCase() === "media");

  if (!match || !match.deadline_days) return null;

  const ref = ticket.fecha_registro || ticket.created_at;
  if (!ref) return null;
  const elapsed = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  const deadline = match.deadline_days;
  const ratio = elapsed / deadline;

  return {
    deadlineDays: deadline,
    daysElapsed: elapsed,
    status: ratio >= 1 ? "overdue" : ratio >= 0.75 ? "warning" : "ok",
  };
}
