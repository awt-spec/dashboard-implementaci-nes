/**
 * ClientSupportView — vista de soporte ENFOCADA en un cliente específico.
 *
 * Reemplaza la estructura "Bandeja + Explorar" cuando el operador entra al
 * perfil de un cliente. La bandeja es vista de triage cross-cliente; aquí
 * el operador ya está dentro de un cliente y necesita ver:
 *   1. KPIs específicos del cliente (activos, vencidos, reincidencias, cerrados)
 *   2. Casos activos agrupados por ESTADO del flujo (no por prioridad cross-cliente)
 *   3. Insights del cliente (Reincidencias scoped)
 *   4. Histórico colapsable (cerrados recientes)
 *
 * Feedback COO 30/04: "que sea diferente a la bandeja, adaptado al cliente,
 * y refleje lo necesario en la cancha".
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, Clock, CheckCheck, RotateCcw, Search, Plus,
  Inbox, PlayCircle, Eye, Truck, Archive, ChevronDown, ChevronRight,
  Folder, Flame, type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAllSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";
import { useTicketsSLAStatus } from "@/hooks/useSupportTickets";
import { ReopensInsightsPanel } from "./ReopensInsightsPanel";
import { TicketDetailSheet } from "./TicketDetailSheet";
import { ReopenBadge } from "./ReopenBadge";

// ─── Estados agrupados por fase del flujo ──────────────────────────────────
const STATE_GROUPS: Array<{
  key: string;
  label: string;
  states: string[];
  Icon: LucideIcon;
  tone: string;
  bg: string;
  border: string;
}> = [
  { key: "pendiente",   label: "Pendientes",      states: ["PENDIENTE"],                Icon: Inbox,        tone: "text-warning",     bg: "bg-warning/5",     border: "border-warning/30" },
  { key: "atencion",    label: "En atención",     states: ["EN ATENCIÓN"],              Icon: PlayCircle,   tone: "text-info",        bg: "bg-info/5",        border: "border-info/30" },
  { key: "comercial",   label: "Flujo comercial", states: ["VALORACIÓN","COTIZADA","APROBADA"], Icon: Folder,    tone: "text-violet-500",  bg: "bg-violet-500/5",  border: "border-violet-500/30" },
  { key: "entregada",   label: "Entregadas",      states: ["ENTREGADA"],                Icon: Truck,        tone: "text-success",     bg: "bg-success/5",     border: "border-success/30" },
  { key: "revision",    label: "Revisión cliente",states: ["POR CERRAR"],               Icon: Eye,          tone: "text-info",        bg: "bg-info/5",        border: "border-info/30" },
  { key: "onhold",      label: "On hold",         states: ["ON HOLD"],                  Icon: Clock,        tone: "text-warning",     bg: "bg-warning/5",     border: "border-warning/30" },
];

const CLOSED_STATES = ["CERRADA", "ANULADA"];

// ─── Helpers de prioridad para color ───────────────────────────────────────
function priorityTone(prio?: string | null): { bg: string; text: string; Icon: LucideIcon } {
  if (!prio) return { bg: "bg-muted/40", text: "text-muted-foreground", Icon: Clock };
  if (/critica/i.test(prio)) return { bg: "bg-destructive/15", text: "text-destructive", Icon: Flame };
  if (prio === "Alta")       return { bg: "bg-warning/15",     text: "text-warning",     Icon: AlertTriangle };
  if (prio === "Media")      return { bg: "bg-info/10",        text: "text-info",        Icon: Clock };
  return { bg: "bg-muted/40", text: "text-muted-foreground", Icon: Clock };
}

// ─── KPI mini-card ─────────────────────────────────────────────────────────
function KpiCard({
  label, value, accent, hint, Icon, onClick,
}: {
  label: string;
  value: number | string;
  accent: string;
  hint?: string;
  Icon: LucideIcon;
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-3 flex flex-col gap-1 text-left",
        onClick && "hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", accent)} />
      </div>
      <span className={cn("text-2xl font-bold tabular-nums leading-none", accent)}>{value}</span>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </Comp>
  );
}

// ─── Ticket row (compacta, NO triage style) ────────────────────────────────
function TicketRow({ t, onClick, slaInfo }: {
  t: SupportTicket;
  onClick: () => void;
  slaInfo?: { status?: string; days_elapsed?: number; deadline_days?: number; sla_source?: string };
}) {
  const prio = priorityTone(t.prioridad);
  const isOverdue = slaInfo?.status === "overdue";
  const isWarning = slaInfo?.status === "warning";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-colors",
        "hover:bg-muted/40 hover:border-primary/30",
        isOverdue ? "border-destructive/30 bg-destructive/[0.03]" : "border-border/50 bg-card",
      )}
    >
      <code className="font-mono text-[11px] font-bold text-muted-foreground shrink-0 w-20 truncate">
        {t.ticket_id}
      </code>
      <Badge variant="outline" className={cn(prio.bg, prio.text, "text-[10px] h-4.5 px-1.5 shrink-0 border-current/30")}>
        <prio.Icon className="h-2.5 w-2.5 mr-0.5" />
        {t.prioridad || "—"}
      </Badge>
      <span className="flex-1 truncate text-sm">{t.asunto || "(sin asunto)"}</span>
      <ReopenBadge count={t.reopen_count ?? 0} size="sm" />
      {isOverdue && (
        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/40 shrink-0">
          +{slaInfo?.days_elapsed}d
        </Badge>
      )}
      {isWarning && !isOverdue && (
        <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/40 shrink-0">
          {slaInfo?.deadline_days! - slaInfo?.days_elapsed!}d
        </Badge>
      )}
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
        {formatDistanceToNow(new Date(t.created_at), { locale: es })}
      </span>
    </button>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────
interface Props {
  clientId: string;
  clientName?: string;
  onNewTicket: () => void;
}

export function ClientSupportView({ clientId, clientName, onNewTicket }: Props) {
  const { data: allTickets = [], isLoading } = useAllSupportTickets();
  const { byId: slaByTicket } = useTicketsSLAStatus();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filtro al cliente
  const clientTickets = useMemo(
    () => allTickets.filter(t => t.client_id === clientId),
    [allTickets, clientId],
  );

  // Aplicar search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientTickets;
    return clientTickets.filter(t =>
      (t.ticket_id || "").toLowerCase().includes(q) ||
      (t.asunto || "").toLowerCase().includes(q) ||
      (t.responsable || "").toLowerCase().includes(q),
    );
  }, [clientTickets, search]);

  // Particionar por estado activo / cerrado
  const activeTickets = useMemo(
    () => filtered.filter(t => !CLOSED_STATES.includes(t.estado)),
    [filtered],
  );
  const closedTickets = useMemo(
    () => filtered.filter(t => CLOSED_STATES.includes(t.estado))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 50),
    [filtered],
  );

  // Tickets seleccionados (para el sheet)
  const selectedTicket = useMemo(
    () => selectedTicketId ? clientTickets.find(t => t.id === selectedTicketId) ?? null : null,
    [clientTickets, selectedTicketId],
  );

  // KPIs
  const kpis = useMemo(() => {
    const total = clientTickets.length;
    const activos = clientTickets.filter(t => !CLOSED_STATES.includes(t.estado)).length;
    const vencidos = clientTickets.filter(t => slaByTicket.get(t.id)?.status === "overdue").length;
    const reincidencias = clientTickets.reduce((sum, t) => sum + (t.reopen_count ?? 0), 0);
    const cerradosRecientes = clientTickets.filter(t =>
      CLOSED_STATES.includes(t.estado) &&
      Date.now() - new Date(t.updated_at).getTime() < 30 * 86400000,
    ).length;
    return { total, activos, vencidos, reincidencias, cerradosRecientes };
  }, [clientTickets, slaByTicket]);

  // Agrupar tickets activos por estado
  const grouped = useMemo(() => {
    return STATE_GROUPS.map(g => ({
      ...g,
      items: activeTickets.filter(t => g.states.includes(t.estado)),
    })).filter(g => g.items.length > 0);
  }, [activeTickets]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* ═══ KPIs del cliente ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard
          label="Casos activos"
          value={kpis.activos}
          accent={kpis.activos > 0 ? "text-foreground" : "text-muted-foreground"}
          hint={`de ${kpis.total} totales`}
          Icon={Inbox}
        />
        <KpiCard
          label="Vencidos SLA"
          value={kpis.vencidos}
          accent={kpis.vencidos > 0 ? "text-destructive" : "text-success"}
          hint={kpis.vencidos > 0 ? "requieren atención" : "todo en plazo"}
          Icon={AlertTriangle}
        />
        <KpiCard
          label="Reincidencias"
          value={kpis.reincidencias}
          accent={kpis.reincidencias > 5 ? "text-warning" : "text-foreground"}
          hint="histórico del cliente"
          Icon={RotateCcw}
        />
        <KpiCard
          label="Cerrados 30d"
          value={kpis.cerradosRecientes}
          accent="text-success"
          hint="último mes"
          Icon={CheckCheck}
        />
      </div>

      {/* ═══ Header: search + nuevo caso ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, asunto o responsable…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <Button onClick={onNewTicket} size="sm" className="gap-1.5 h-9">
          <Plus className="h-3.5 w-3.5" /> Nuevo caso
        </Button>
      </div>

      {/* ═══ Casos activos agrupados por estado del flujo ═══ */}
      {activeTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCheck className="h-10 w-10 text-success/60 mx-auto mb-3" />
            <p className="text-sm font-semibold">Sin casos activos</p>
            <p className="text-xs text-muted-foreground mt-1">
              {clientName ? `${clientName} no tiene casos abiertos en este momento.` : "Sin casos abiertos en este momento."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(g => {
            const collapsed = collapsedGroups.has(g.key);
            return (
              <div key={g.key} className={cn("rounded-lg border", g.border, g.bg)}>
                <button
                  onClick={() => toggleGroup(g.key)}
                  className="w-full flex items-center gap-2 px-3 py-2"
                >
                  {collapsed
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  <g.Icon className={cn("h-3.5 w-3.5", g.tone)} />
                  <span className={cn("text-xs font-bold uppercase tracking-wider", g.tone)}>{g.label}</span>
                  <Badge variant="outline" className="text-[10px] tabular-nums h-4 px-1 ml-auto">
                    {g.items.length}
                  </Badge>
                </button>
                {!collapsed && (
                  <div className="px-2 pb-2 space-y-1">
                    {g.items
                      .sort((a, b) => {
                        // Ordenar dentro del grupo: vencidos primero, luego por antigüedad
                        const aOver = slaByTicket.get(a.id)?.status === "overdue" ? 1 : 0;
                        const bOver = slaByTicket.get(b.id)?.status === "overdue" ? 1 : 0;
                        if (aOver !== bOver) return bOver - aOver;
                        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                      })
                      .map(t => (
                        <TicketRow
                          key={t.id}
                          t={t}
                          onClick={() => setSelectedTicketId(t.id)}
                          slaInfo={slaByTicket.get(t.id)}
                        />
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Insights: Reincidencias scoped al cliente ═══ */}
      <ReopensInsightsPanel clientId={clientId} clientName={clientName} />

      {/* ═══ Histórico colapsable ═══ */}
      {closedTickets.length > 0 && (
        <Card>
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            {showHistory
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Archive className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Histórico (cerrados recientes)</span>
            <Badge variant="outline" className="text-[10px] tabular-nums ml-auto">
              {closedTickets.length}
            </Badge>
          </button>
          {showHistory && (
            <CardContent className="pt-0 pb-3 space-y-1">
              {closedTickets.map(t => (
                <TicketRow
                  key={t.id}
                  t={t}
                  onClick={() => setSelectedTicketId(t.id)}
                />
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Detail sheet del ticket seleccionado */}
      {selectedTicket && (
        <TicketDetailSheet
          ticket={selectedTicket}
          open={!!selectedTicketId}
          onOpenChange={(o) => { if (!o) setSelectedTicketId(null); }}
          canEditInternal={true}
        />
      )}
    </motion.div>
  );
}
