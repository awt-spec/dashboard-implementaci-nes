import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Database, Flame, Inbox,
  Loader2, RefreshCw, Sparkles, Target, TrendingDown, Users, Zap,
  ArrowRight, DollarSign, type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useAllScrumWorkItems, useUpdateWorkItemScrum, type ScrumWorkItem } from "@/hooks/useTeamScrum";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useWorkTimeEntries, useActiveTeamMembers, useRecentActivity,
  useLatestWeeklyPlan, useGenerateSVAStrategy,
  useClientsWithoutFinancials, useClientsWithoutActiveSprint,
} from "@/hooks/useSVAStrategy";
import { isTicketClosed, isTaskClosed } from "@/lib/ticketStatus";
import { ClientFinancialsWizard } from "./ClientFinancialsWizard";
import { QuickSprintInitializer } from "./QuickSprintInitializer";

// ---------------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------------

function MetricTile({
  label, value, hint, tone = "neutral", Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  Icon: LucideIcon;
}) {
  const toneStyles = {
    neutral: "text-foreground",
    good:    "text-success",
    warn:    "text-warning",
    bad:     "text-destructive",
  }[tone];
  return (
    <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={`text-2xl font-bold tabular-nums leading-none ${toneStyles}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StrategyScore({
  Icon, label, value, sublabel, tone,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  tone: "good" | "warn" | "bad";
}) {
  const tones = {
    good: { bg: "bg-success/10", text: "text-success", border: "border-success/30" },
    warn: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30" },
    bad:  { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
  }[tone];
  return (
    <div className={`p-3 rounded-lg border bg-background ${tones.border}`}>
      <div className="flex items-center gap-1.5">
        <div className={`h-6 w-6 rounded ${tones.bg} flex items-center justify-center ${tones.text} shrink-0`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1.5 text-xl font-bold tabular-nums leading-none ${tones.text}`}>{value}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{sublabel}</p>}
    </div>
  );
}

function EstimateRow({ item, onSave }: {
  item: ScrumWorkItem;
  onSave: (updates: { story_points?: number; business_value?: number; effort?: number }) => void;
}) {
  const [sp, setSp] = useState("");
  const [bv, setBv] = useState("");
  const [ef, setEf] = useState("");
  const wsjf = useMemo(() => {
    const b = parseFloat(bv); const e = parseFloat(ef);
    if (isNaN(b) || isNaN(e) || e <= 0) return null;
    return Math.round((b / e) * 100) / 100;
  }, [bv, ef]);

  const save = () => {
    const u: any = {};
    const spN = parseFloat(sp); if (!isNaN(spN) && spN > 0) u.story_points = spN;
    const bvN = parseFloat(bv); if (!isNaN(bvN) && bvN > 0) u.business_value = bvN;
    const efN = parseFloat(ef); if (!isNaN(efN) && efN > 0) u.effort = efN;
    if (Object.keys(u).length === 0) return;
    onSave(u);
    setSp(""); setBv(""); setEf("");
  };

  return (
    <div className="flex items-center gap-2 text-xs p-2 rounded bg-warning/5 border border-warning/20">
      <Badge variant="outline" className="text-[10px] shrink-0">{item.source === "task" ? "T" : "C"}</Badge>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.title}</p>
        {item.client_name && <p className="text-muted-foreground text-[10px] truncate">{item.client_name}</p>}
      </div>
      <Input placeholder="SP"     type="number" min="1" max="13" value={sp} onChange={e => setSp(e.target.value)} className="h-7 w-14 text-center text-[11px] tabular-nums" />
      <Input placeholder="Valor"  type="number" min="1" max="13" value={bv} onChange={e => setBv(e.target.value)} className="h-7 w-16 text-center text-[11px] tabular-nums" />
      <Input placeholder="Effort" type="number" min="1" max="13" value={ef} onChange={e => setEf(e.target.value)} className="h-7 w-16 text-center text-[11px] tabular-nums" />
      {wsjf !== null && (
        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] tabular-nums shrink-0">WSJF {wsjf}</Badge>
      )}
      <Button size="sm" variant="outline" onClick={save} disabled={!sp && !bv && !ef} className="h-7 text-[11px] px-2 shrink-0">
        Guardar
      </Button>
    </div>
  );
}

function EmptyInline({ Icon, text }: { Icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2 py-6 justify-center text-xs text-muted-foreground">
      <Icon className="h-4 w-4" /> {text}
    </div>
  );
}

// ─── Mapeos de columnas (tasks vs tickets usan nombres distintos) ───────────

const OWNER_FIELD = { task: "owner", ticket: "responsable" } as const;
const PRIORITY_FIELD = { task: "priority", ticket: "prioridad" } as const;
const PRIORITY_OPTIONS = {
  task:   [{ v: "alta", l: "Alta" }, { v: "media", l: "Media" }, { v: "baja", l: "Baja" }],
  ticket: [
    { v: "Critica, Impacto Negocio", l: "Crítica" },
    { v: "Alta", l: "Alta" },
    { v: "Media", l: "Media" },
    { v: "Baja", l: "Baja" },
  ],
} as const;

function tierBadge(tier: string) {
  const map: Record<string, string> = {
    critico: "bg-destructive/15 text-destructive border-destructive/30",
    alto:    "bg-warning/15 text-warning border-warning/30",
    medio:   "bg-info/15 text-info border-info/30",
    bajo:    "bg-muted/40 text-muted-foreground border-border/50",
  };
  return map[tier] || map.bajo;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function SVAStrategyPanel() {
  const { data: items = [], isLoading: loadingItems } = useAllScrumWorkItems();
  const { data: hours = [], isLoading: loadingHours } = useWorkTimeEntries(14);
  const { data: members = [], isLoading: loadingMembers } = useActiveTeamMembers();
  const { data: activity = [] } = useRecentActivity(48);
  const { data: latestPlan } = useLatestWeeklyPlan();
  const generate = useGenerateSVAStrategy();
  const { data: clientsNoFin = [] } = useClientsWithoutFinancials();
  const { data: clientsNoSprint = [] } = useClientsWithoutActiveSprint();
  const updateItem = useUpdateWorkItemScrum();

  const [finWizardOpen, setFinWizardOpen] = useState(false);
  const [sprintInitOpen, setSprintInitOpen] = useState(false);

  const handleSetOwner = async (item: ScrumWorkItem, value: string) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        source: item.source,
        updates: { [OWNER_FIELD[item.source]]: value },
      });
      toast.success(`Asignado a ${value}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSetPriority = async (item: ScrumWorkItem, value: string) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        source: item.source,
        updates: { [PRIORITY_FIELD[item.source]]: value },
      });
      toast.success("Prioridad actualizada");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSetEstimation = async (item: ScrumWorkItem, updates: Partial<Pick<ScrumWorkItem, "story_points" | "business_value" | "effort">>) => {
    try {
      await updateItem.mutateAsync({ id: item.id, source: item.source, updates });
      toast.success("Estimación guardada");
    } catch (e: any) { toast.error(e.message); }
  };

  const loading = loadingItems || loadingHours || loadingMembers;

  // ──────────────────────────────────────────────────────────────────────
  // SECCIÓN 1 — Sincronización del equipo
  // ──────────────────────────────────────────────────────────────────────

  const syncIssues = useMemo(() => {
    // items unifica tasks (status="completada") y tickets (estado="CERRADA"). Cualquiera de los dos helpers
    // detecta correctamente el estado cerrado; chequeamos ambos y excluimos también scrum_status="done".
    const openItems = items.filter(i =>
      i.scrum_status !== "done" && !isTaskClosed(i.status) && !isTicketClosed(i.status)
    );

    // Sin owner
    const noOwner = openItems.filter(i => !i.owner || i.owner === "—");

    // Sin prioridad
    const noPriority = openItems.filter(i => !i.priority || i.priority === "—");

    // Sin estimación
    const noEstimate = openItems.filter(i => !i.story_points && !i.effort);

    // Duplicados potenciales (mismo cliente + mismo título muy similar)
    const byClientTitle = new Map<string, ScrumWorkItem[]>();
    openItems.forEach(i => {
      if (!i.client_id || !i.title) return;
      const key = `${i.client_id}::${i.title.toLowerCase().slice(0, 40)}`;
      if (!byClientTitle.has(key)) byClientTitle.set(key, []);
      byClientTitle.get(key)!.push(i);
    });
    const duplicates = Array.from(byClientTitle.values()).filter(arr => arr.length > 1).flat();

    // Personas sin actividad últimas 48h
    const activeUserIds = new Set(activity.map(a => a.user_id));
    const inactiveMembers = members.filter(m => m.user_id && !activeUserIds.has(m.user_id));

    // Items en sprint activo sin movimiento (usando ausencia de actividad reciente como proxy)
    const sprintStale = openItems.filter(i => {
      if (!i.sprint_id) return false;
      const owner = i.owner;
      if (!owner || owner === "—") return false;
      const member = members.find(m => m.name === owner);
      if (!member?.user_id) return false;
      return !activeUserIds.has(member.user_id);
    });

    // Rebalanceo sugerido: quién tiene >7 vs quién tiene 0-1
    const loadByOwner = new Map<string, number>();
    openItems.forEach(i => {
      if (i.owner && i.owner !== "—") {
        loadByOwner.set(i.owner, (loadByOwner.get(i.owner) || 0) + 1);
      }
    });
    const overloaded = Array.from(loadByOwner.entries()).filter(([, n]) => n > 7);
    const underloaded = members.filter(m => {
      const n = loadByOwner.get(m.name) || 0;
      return n < 2;
    });

    return {
      noOwner, noPriority, noEstimate, duplicates, inactiveMembers, sprintStale,
      overloaded, underloaded,
    };
  }, [items, activity, members]);

  const syncScore = useMemo(() => {
    const total = items.filter(i => i.scrum_status !== "done").length || 1;
    const issuesCount =
      syncIssues.noOwner.length +
      syncIssues.duplicates.length +
      syncIssues.sprintStale.length;
    const score = Math.max(0, Math.round(100 - (issuesCount / total) * 100));
    return score;
  }, [items, syncIssues]);

  // ──────────────────────────────────────────────────────────────────────
  // SECCIÓN 2 — Calidad de Datos
  // ──────────────────────────────────────────────────────────────────────

  const dataQuality = useMemo(() => {
    const open = items.filter(i => i.scrum_status !== "done");
    const total = open.length || 1;

    const withOwner     = open.filter(i => i.owner && i.owner !== "—").length;
    const withPriority  = open.filter(i => i.priority && i.priority !== "—").length;
    const withEstimate  = open.filter(i => i.story_points || i.effort).length;
    const withClient    = open.filter(i => i.client_id).length;
    const withBizValue  = open.filter(i => i.business_value).length;

    const score = Math.round(
      ((withOwner / total) * 0.25 +
        (withPriority / total) * 0.20 +
        (withEstimate / total) * 0.25 +
        (withClient / total) * 0.15 +
        (withBizValue / total) * 0.15) * 100
    );

    // Ranking por owner: % de sus items con campos completos
    const byOwner = new Map<string, { total: number; complete: number }>();
    open.forEach(i => {
      if (!i.owner || i.owner === "—") return;
      const rec = byOwner.get(i.owner) || { total: 0, complete: 0 };
      rec.total++;
      const isComplete = i.priority && i.priority !== "—" && (i.story_points || i.effort) && i.business_value;
      if (isComplete) rec.complete++;
      byOwner.set(i.owner, rec);
    });

    const ownersRank = Array.from(byOwner.entries())
      .filter(([, r]) => r.total >= 2)
      .map(([name, r]) => ({ name, total: r.total, complete: r.complete, pct: Math.round((r.complete / r.total) * 100) }))
      .sort((a, b) => a.pct - b.pct);

    return {
      score,
      total,
      withOwner, withPriority, withEstimate, withClient, withBizValue,
      pctOwner:    Math.round((withOwner / total) * 100),
      pctPriority: Math.round((withPriority / total) * 100),
      pctEstimate: Math.round((withEstimate / total) * 100),
      pctClient:   Math.round((withClient / total) * 100),
      pctBizValue: Math.round((withBizValue / total) * 100),
      ownersRank,
    };
  }, [items]);

  // ──────────────────────────────────────────────────────────────────────
  // SECCIÓN 4 — Control de Horas (matriz persona × cliente)
  // ──────────────────────────────────────────────────────────────────────

  const hoursMatrix = useMemo(() => {
    const userIdToName = new Map<string, string>();
    members.forEach(m => m.user_id && userIdToName.set(m.user_id, m.name));

    type Cell = { hours: number; billable: number };
    const matrix = new Map<string, Map<string, Cell>>(); // name → clientId → cell
    const clientNames = new Map<string, string>();
    items.forEach(i => i.client_id && i.client_name && clientNames.set(i.client_id, i.client_name));

    let totalHours = 0;
    let totalBillable = 0;
    const perPerson = new Map<string, { total: number; billable: number; byClient: number }>();

    hours.forEach(h => {
      const name = userIdToName.get(h.user_id) || "Desconocido";
      const clientId = h.client_id || "sin_cliente";
      const secs = h.duration_seconds || 0;
      const h_ = secs / 3600;
      totalHours += h_;
      if (h.is_billable) totalBillable += h_;

      if (!matrix.has(name)) matrix.set(name, new Map());
      const row = matrix.get(name)!;
      const cell = row.get(clientId) || { hours: 0, billable: 0 };
      cell.hours += h_;
      if (h.is_billable) cell.billable += h_;
      row.set(clientId, cell);

      const pp = perPerson.get(name) || { total: 0, billable: 0, byClient: 0 };
      pp.total += h_;
      if (h.is_billable) pp.billable += h_;
      perPerson.set(name, pp);
    });

    // Desviación: tickets con horas registradas >> estimación (story_points * 4h o effort * 4h)
    const deviations: Array<{ item: ScrumWorkItem; hoursLogged: number; expected: number; ratio: number }> = [];
    const hoursByItem = new Map<string, number>();
    hours.forEach(h => {
      const key = `${h.source}::${h.item_id}`;
      hoursByItem.set(key, (hoursByItem.get(key) || 0) + (h.duration_seconds || 0) / 3600);
    });
    items.forEach(i => {
      const key = `${i.source}::${i.id}`;
      const logged = hoursByItem.get(key) || 0;
      const expected = (i.story_points || i.effort || 0) * 4; // 1 SP ≈ 4h como heurística
      if (expected > 0 && logged > expected * 1.5) {
        deviations.push({ item: i, hoursLogged: logged, expected, ratio: logged / expected });
      }
    });

    // Horas "fantasma": items con actividad pero sin horas registradas
    // Aproximamos: items in_progress sin ninguna entry de time
    const ghostItems = items.filter(i => {
      if (i.scrum_status !== "in_progress") return false;
      const key = `${i.source}::${i.id}`;
      return !hoursByItem.has(key);
    });

    // Rows ordenados por total descendente
    const rows = Array.from(matrix.entries()).map(([name, row]) => ({
      name,
      cells: Array.from(row.entries()).map(([clientId, cell]) => ({
        clientId,
        clientName: clientNames.get(clientId) || (clientId === "sin_cliente" ? "Sin cliente" : clientId),
        hours: cell.hours,
        billable: cell.billable,
      })).sort((a, b) => b.hours - a.hours),
      totalHours: perPerson.get(name)?.total || 0,
      billableHours: perPerson.get(name)?.billable || 0,
      billablePct: perPerson.get(name)?.total
        ? Math.round((perPerson.get(name)!.billable / perPerson.get(name)!.total) * 100)
        : 0,
    })).sort((a, b) => b.totalHours - a.totalHours);

    return {
      rows,
      totalHours: Math.round(totalHours * 10) / 10,
      totalBillable: Math.round(totalBillable * 10) / 10,
      billablePct: totalHours > 0 ? Math.round((totalBillable / totalHours) * 100) : 0,
      deviations: deviations.sort((a, b) => b.ratio - a.ratio).slice(0, 10),
      ghostItems: ghostItems.slice(0, 20),
    };
  }, [hours, items, members]);

  // ──────────────────────────────────────────────────────────────────────
  // SECCIÓN 3 — Estrategia IA (ya está en latestPlan)
  // ──────────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    try {
      await generate.mutateAsync();
      toast.success("Plan semanal generado");
    } catch (e: any) {
      toast.error(e.message || "Error al generar el plan");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Scores resumidos (reutiliza cálculos existentes)
  const planAge = latestPlan ? Math.floor((Date.now() - new Date(latestPlan.created_at).getTime()) / 86400000) : null;
  const planFresh = planAge !== null && planAge < 7;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ─── HERO — resumen ejecutivo + CTA ──────────────────────────── */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-primary font-bold">
                <Sparkles className="h-3.5 w-3.5" /> Estrategia SVA
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Plan semanal con IA + salud del equipo + control de horas. Prioriza lo que toca esta semana.
              </p>
            </div>
            <Button size="sm" onClick={handleGenerate} disabled={generate.isPending} className="gap-1.5 shrink-0">
              {generate.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : latestPlan ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {latestPlan ? "Regenerar plan IA" : "Generar plan semanal"}
            </Button>
          </div>

          {/* 4 Scores resumen — visual rápido del estado global */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StrategyScore
              Icon={Sparkles}
              label="Plan IA"
              value={latestPlan ? (planFresh ? "Activo" : `${planAge}d atrás`) : "Sin plan"}
              tone={latestPlan ? (planFresh ? "good" : "warn") : "bad"}
              sublabel={latestPlan?.plan.weekly_focus?.length ? `${latestPlan.plan.weekly_focus.length} focos` : "clic para generar"}
            />
            <StrategyScore
              Icon={Activity}
              label="Sincronización"
              value={`${syncScore}/100`}
              tone={syncScore >= 80 ? "good" : syncScore >= 60 ? "warn" : "bad"}
              sublabel={
                syncIssues.noOwner.length + syncIssues.duplicates.length + syncIssues.sprintStale.length > 0
                  ? `${syncIssues.noOwner.length + syncIssues.duplicates.length + syncIssues.sprintStale.length} alertas`
                  : "equipo alineado"
              }
            />
            <StrategyScore
              Icon={Clock}
              label="Facturable"
              value={`${hoursMatrix.billablePct}%`}
              tone={hoursMatrix.billablePct >= 80 ? "good" : hoursMatrix.billablePct >= 60 ? "warn" : "bad"}
              sublabel={`${hoursMatrix.totalHours}h / ${hoursMatrix.totalBillable}h fact`}
            />
            <StrategyScore
              Icon={Database}
              label="Calidad datos"
              value={`${dataQuality.score}/100`}
              tone={dataQuality.score >= 80 ? "good" : dataQuality.score >= 60 ? "warn" : "bad"}
              sublabel={`${dataQuality.total} items evaluados`}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Tabs internos — orden de uso diario ──────────────────────── */}
      <Tabs defaultValue="plan" className="w-full">
        <TabsList className="h-auto bg-muted/40">
          <TabsTrigger value="plan"    className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Sparkles className="h-3.5 w-3.5" /> Plan semanal</TabsTrigger>
          <TabsTrigger value="sync"    className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Sincronización</TabsTrigger>
          <TabsTrigger value="hours"   className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Horas</TabsTrigger>
          <TabsTrigger value="quality" className="gap-1.5 text-xs"><Database className="h-3.5 w-3.5" /> Calidad</TabsTrigger>
        </TabsList>

        {/* ════════════ 1. SINCRONIZACIÓN ════════════ */}
        <TabsContent value="sync" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Salud operacional del equipo
                <Badge className={
                  syncScore >= 80 ? "ml-2 bg-success/15 text-success border-success/30" :
                  syncScore >= 60 ? "ml-2 bg-warning/15 text-warning border-warning/30" :
                                    "ml-2 bg-destructive/15 text-destructive border-destructive/30"
                }>{syncScore}/100</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MetricTile label="Sin owner"      value={syncIssues.noOwner.length}      Icon={Users}         tone={syncIssues.noOwner.length > 0 ? "bad" : "good"} hint="Items abiertos" />
                <MetricTile label="Sin prioridad"  value={syncIssues.noPriority.length}   Icon={AlertTriangle} tone={syncIssues.noPriority.length > 5 ? "warn" : "neutral"} />
                <MetricTile label="Sin estimar"    value={syncIssues.noEstimate.length}   Icon={TrendingDown}  tone={syncIssues.noEstimate.length > 10 ? "warn" : "neutral"} />
                <MetricTile label="Duplicados"     value={syncIssues.duplicates.length}   Icon={AlertTriangle} tone={syncIssues.duplicates.length > 0 ? "warn" : "good"} hint="Mismo cliente + similar" />
                <MetricTile label="Sprint detenido" value={syncIssues.sprintStale.length} Icon={Clock}         tone={syncIssues.sprintStale.length > 0 ? "warn" : "good"} hint="Sin movimiento 48h" />
                <MetricTile label="Sobrecargados"  value={syncIssues.overloaded.length}   Icon={Flame}         tone={syncIssues.overloaded.length > 0 ? "bad" : "good"} hint=">7 items" />
                <MetricTile label="Subutilizados"  value={syncIssues.underloaded.length}  Icon={Inbox}         tone="neutral" hint="<2 items" />
                <MetricTile label="Inactivos 48h"  value={syncIssues.inactiveMembers.length} Icon={Clock}      tone={syncIssues.inactiveMembers.length > 2 ? "warn" : "neutral"} />
              </div>
            </CardContent>
          </Card>

          {/* ══ Acciones correctivas de un click ══ */}
          {(clientsNoFin.length > 0 || clientsNoSprint.length > 0) && (
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning" />
                  Acciones recomendadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {clientsNoFin.length > 0 && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border/60">
                    <DollarSign className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {clientsNoFin.length} clientes de soporte sin datos de facturación
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Sin esto, la IA no puede priorizar clientes por ingresos. Los dashboards muestran $0 de revenue.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setFinWizardOpen(true)} className="shrink-0 gap-1.5">
                      Completar <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {clientsNoSprint.length > 0 && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border/60">
                    <Target className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {clientsNoSprint.length} clientes con tickets abiertos sin sprint activo
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Total: <strong>{clientsNoSprint.reduce((s, c) => s + c.open_tickets, 0)} tickets</strong> flotando sin organización scrum.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSprintInitOpen(true)} className="shrink-0 gap-1.5">
                      Inicializar <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {syncIssues.noOwner.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-destructive" />
                    Sin responsable ({syncIssues.noOwner.length})
                    <span className="ml-auto text-[11px] text-muted-foreground font-normal">asigna inline</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-[360px] overflow-auto">
                  {syncIssues.noOwner.slice(0, 20).map(i => (
                    <div key={`${i.source}-${i.id}`} className="flex items-center gap-2 text-xs p-2 rounded bg-destructive/5 border border-destructive/15">
                      <Badge variant="outline" className="text-[10px] shrink-0">{i.source === "task" ? "T" : "C"}</Badge>
                      <span className="flex-1 truncate font-medium">{i.title}</span>
                      {i.client_name && <span className="text-muted-foreground text-[11px] truncate max-w-[90px] hidden sm:inline">{i.client_name}</span>}
                      <Select onValueChange={(v) => handleSetOwner(i, v)}>
                        <SelectTrigger className="h-7 w-[130px] text-[11px] shrink-0"><SelectValue placeholder="Asignar…" /></SelectTrigger>
                        <SelectContent>
                          {members.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {syncIssues.noPriority.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Sin prioridad ({syncIssues.noPriority.length})
                    <span className="ml-auto text-[11px] text-muted-foreground font-normal">clasifica inline</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-[360px] overflow-auto">
                  {syncIssues.noPriority.slice(0, 20).map(i => (
                    <div key={`${i.source}-${i.id}`} className="flex items-center gap-2 text-xs p-2 rounded bg-warning/5 border border-warning/20">
                      <Badge variant="outline" className="text-[10px] shrink-0">{i.source === "task" ? "T" : "C"}</Badge>
                      <span className="flex-1 truncate font-medium">{i.title}</span>
                      {i.client_name && <span className="text-muted-foreground text-[11px] truncate max-w-[90px] hidden sm:inline">{i.client_name}</span>}
                      <Select onValueChange={(v) => handleSetPriority(i, v)}>
                        <SelectTrigger className="h-7 w-[100px] text-[11px] shrink-0"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS[i.source].map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {syncIssues.noEstimate.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-warning" />
                    Sin estimación ({syncIssues.noEstimate.length})
                    <span className="ml-auto text-[11px] text-muted-foreground font-normal">
                      WSJF = Business Value / Effort · valores 1-13
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-[420px] overflow-auto">
                  {syncIssues.noEstimate.slice(0, 20).map(i => (
                    <EstimateRow key={`${i.source}-${i.id}`} item={i} onSave={(u) => handleSetEstimation(i, u)} />
                  ))}
                </CardContent>
              </Card>
            )}

            {syncIssues.duplicates.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Posibles duplicados ({syncIssues.duplicates.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-[320px] overflow-auto">
                  {syncIssues.duplicates.slice(0, 15).map(i => (
                    <div key={`${i.source}-${i.id}`} className="flex items-center gap-2 text-xs p-2 rounded bg-warning/5 border border-warning/20">
                      <Badge variant="outline" className="text-[10px] shrink-0">{i.source === "task" ? "T" : "C"}</Badge>
                      <span className="flex-1 truncate">{i.title}</span>
                      <span className="text-muted-foreground text-[11px] truncate max-w-[100px]">{i.client_name}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {syncIssues.overloaded.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Flame className="h-4 w-4 text-destructive" />
                    Sobrecargados — rebalancear
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {syncIssues.overloaded.map(([name, count]) => {
                    const suggested = syncIssues.underloaded.slice(0, 2).map(m => m.name).join(", ");
                    return (
                      <div key={name} className="flex items-start gap-2 text-xs p-2 rounded bg-destructive/5 border border-destructive/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{name}</span>
                            <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">{count} items</Badge>
                          </div>
                          {suggested && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Sugerencia: mover 2-3 items a <span className="text-foreground">{suggested}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {syncIssues.inactiveMembers.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    Sin actividad en 48h ({syncIssues.inactiveMembers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {syncIssues.inactiveMembers.map(m => (
                      <Badge key={m.id} variant="outline" className="text-xs bg-warning/5 border-warning/30">
                        {m.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {syncIssues.noOwner.length === 0 && syncIssues.duplicates.length === 0 && syncIssues.overloaded.length === 0 && (
            <Card>
              <CardContent>
                <EmptyInline Icon={CheckCircle2} text="Equipo sincronizado — sin hallazgos críticos." />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════ 2. CALIDAD DE DATOS ════════════ */}
        <TabsContent value="quality" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Score de calidad de datos
                <Badge className={
                  dataQuality.score >= 80 ? "ml-2 bg-success/15 text-success border-success/30" :
                  dataQuality.score >= 60 ? "ml-2 bg-warning/15 text-warning border-warning/30" :
                                             "ml-2 bg-destructive/15 text-destructive border-destructive/30"
                }>{dataQuality.score}/100</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={dataQuality.score} className="h-2" />

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {[
                  { label: "Con owner",      pct: dataQuality.pctOwner,    weight: "25%" },
                  { label: "Con estimación", pct: dataQuality.pctEstimate, weight: "25%" },
                  { label: "Con prioridad",  pct: dataQuality.pctPriority, weight: "20%" },
                  { label: "Con valor",      pct: dataQuality.pctBizValue, weight: "15%" },
                  { label: "Con cliente",    pct: dataQuality.pctClient,   weight: "15%" },
                ].map(f => (
                  <div key={f.label} className="p-3 rounded-lg border border-border/60 bg-muted/20">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{f.label}</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className={`text-2xl font-bold tabular-nums ${f.pct >= 80 ? "text-success" : f.pct >= 60 ? "text-warning" : "text-destructive"}`}>
                        {f.pct}%
                      </span>
                      <span className="text-[11px] text-muted-foreground">peso {f.weight}</span>
                    </div>
                    <Progress value={f.pct} className="h-1 mt-2" />
                  </div>
                ))}
              </div>

              {dataQuality.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  Evaluando <strong className="text-foreground">{dataQuality.total}</strong> items abiertos.
                </p>
              )}
            </CardContent>
          </Card>

          {dataQuality.ownersRank.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Limpieza por persona
                  <span className="ml-auto text-[11px] text-muted-foreground font-normal">peor → mejor</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {dataQuality.ownersRank.slice(0, 10).map(o => (
                  <div key={o.name} className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 text-xs">
                    <span className="font-medium flex-1 truncate">{o.name}</span>
                    <span className="text-muted-foreground tabular-nums">{o.complete}/{o.total}</span>
                    <div className="w-32">
                      <Progress value={o.pct} className="h-1.5" />
                    </div>
                    <span className={`tabular-nums font-bold w-10 text-right ${
                      o.pct >= 80 ? "text-success" : o.pct >= 60 ? "text-warning" : "text-destructive"
                    }`}>{o.pct}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════ 3. PLAN SEMANAL IA ════════════ */}
        <TabsContent value="plan" className="mt-4 space-y-3">
          {!latestPlan && !generate.isPending && (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Aún no se ha generado un plan esta semana</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    La IA cruzará valor mensual de clientes, SLAs, capacidad del equipo y backlog WSJF para producir un plan accionable.
                  </p>
                </div>
                <Button size="sm" onClick={handleGenerate} disabled={generate.isPending} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Generar plan
                </Button>
              </CardContent>
            </Card>
          )}

          {generate.isPending && (
            <Card>
              <CardContent className="py-14 flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">
                  Cruzando clientes, equipo, SLAs y backlog…
                </p>
              </CardContent>
            </Card>
          )}

          {latestPlan && !generate.isPending && (
            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Resumen ejecutivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-foreground/90">{latestPlan.plan.executive_summary}</p>
                </CardContent>
              </Card>

              {latestPlan.plan.weekly_focus?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-warning" />
                      Foco de la semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {latestPlan.plan.weekly_focus.map((f, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <span className="text-foreground/90">{f}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {latestPlan.plan.client_priorities?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Clientes priorizados ({latestPlan.plan.client_priorities.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[420px] overflow-auto">
                      {latestPlan.plan.client_priorities.map((c, i) => (
                        <div key={i} className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate flex-1">{c.client_name}</span>
                            <Badge variant="outline" className={tierBadge(c.tier)}>{c.tier.toUpperCase()}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{c.reason}</p>
                          <p className="text-xs flex items-start gap-1"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" /><span className="text-foreground/90">{c.action}</span></p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {latestPlan.plan.assignments?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Asignaciones ({latestPlan.plan.assignments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[420px] overflow-auto">
                      {latestPlan.plan.assignments.map((a, i) => (
                        <div key={i} className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm flex-1 truncate">{a.member_name}</span>
                            <Badge variant="outline" className="text-[11px] tabular-nums">{a.target_hours}h</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Cliente principal: <span className="text-foreground font-medium">{a.primary_client}</span>
                          </p>
                          {a.focus_items.length > 0 && (
                            <ul className="text-[11px] space-y-0.5 mt-1">
                              {a.focus_items.slice(0, 4).map((it, j) => (
                                <li key={j} className="flex gap-1"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" /><span className="truncate">{it}</span></li>
                              ))}
                            </ul>
                          )}
                          {a.note && <p className="text-[11px] italic text-muted-foreground/80 mt-1">{a.note}</p>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {latestPlan.plan.items_to_defer?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-warning" />
                      Items a diferir / dividir / cerrar ({latestPlan.plan.items_to_defer.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 max-h-[320px] overflow-auto">
                    {latestPlan.plan.items_to_defer.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/40 text-xs">
                        <Badge variant="outline" className={
                          d.action === "cerrar" ? "text-destructive border-destructive/30" :
                          d.action === "aplazar" ? "text-warning border-warning/30" :
                          "text-muted-foreground"
                        }>{d.action}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{d.title}</p>
                          <p className="text-muted-foreground text-[11px]">{d.reason}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {latestPlan.plan.risks_this_week?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Riesgos de la semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {latestPlan.plan.risks_this_week.map((r, i) => (
                      <div key={i} className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold flex-1 truncate">{r.title}</span>
                          <Badge variant="outline" className={tierBadge(r.severity)}>{r.severity.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-success" />
                          <span>{r.mitigation}</span>
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ════════════ 4. CONTROL DE HORAS ════════════ */}
        <TabsContent value="hours" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Horas últimas 2 semanas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MetricTile label="Total horas"     value={hoursMatrix.totalHours}     Icon={Clock}       tone="neutral" />
                <MetricTile label="Facturables"     value={hoursMatrix.totalBillable}  Icon={CheckCircle2} tone="good" hint={`${hoursMatrix.billablePct}% del total`} />
                <MetricTile label="Desviaciones"    value={hoursMatrix.deviations.length} Icon={TrendingDown} tone={hoursMatrix.deviations.length > 0 ? "warn" : "good"} hint="Horas > estimación ×1.5" />
                <MetricTile label="Horas fantasma"  value={hoursMatrix.ghostItems.length} Icon={AlertTriangle} tone={hoursMatrix.ghostItems.length > 0 ? "bad" : "good"} hint="In-progress sin tracking" />
              </div>
            </CardContent>
          </Card>

          {hoursMatrix.rows.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyInline Icon={Clock} text="Sin horas registradas en los últimos 14 días." />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Persona × Cliente
                  <span className="ml-auto text-[11px] text-muted-foreground font-normal">
                    horas totales · facturables · %
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[540px] overflow-auto pr-1">
                  {hoursMatrix.rows.map(row => (
                    <div key={row.name} className="border border-border/60 rounded-lg p-3 bg-muted/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm flex-1 truncate">{row.name}</span>
                        <Badge variant="outline" className="tabular-nums text-[11px]">
                          {row.totalHours.toFixed(1)}h
                        </Badge>
                        <Badge className={
                          row.billablePct >= 80 ? "bg-success/15 text-success border-success/30 tabular-nums text-[11px]" :
                          row.billablePct >= 60 ? "bg-warning/15 text-warning border-warning/30 tabular-nums text-[11px]" :
                                                  "bg-destructive/15 text-destructive border-destructive/30 tabular-nums text-[11px]"
                        }>
                          {row.billablePct}% facturable
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                        {row.cells.map(cell => {
                          const pct = row.totalHours > 0 ? (cell.hours / row.totalHours) * 100 : 0;
                          return (
                            <div key={cell.clientId} className="flex items-center gap-2 p-1.5 rounded bg-background border border-border/40">
                              <div
                                className="w-2 h-6 rounded-sm shrink-0"
                                style={{ backgroundColor: `hsl(var(--primary) / ${Math.max(0.2, pct / 100)})` }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium truncate">{cell.clientName}</p>
                                <p className="text-[10px] text-muted-foreground tabular-nums">
                                  {cell.hours.toFixed(1)}h
                                  {cell.billable !== cell.hours && <> · fact {cell.billable.toFixed(1)}h</>}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {hoursMatrix.deviations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-warning" />
                  Desviaciones de esfuerzo
                  <span className="ml-auto text-[11px] text-muted-foreground font-normal">
                    horas registradas vs estimación (SP×4h)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {hoursMatrix.deviations.map(d => (
                  <div key={`${d.item.source}-${d.item.id}`} className="flex items-center gap-2 p-2 rounded bg-warning/5 border border-warning/20 text-xs">
                    <Badge variant="outline" className="text-[10px] shrink-0">{d.item.source === "task" ? "T" : "C"}</Badge>
                    <span className="flex-1 truncate font-medium">{d.item.title}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {d.hoursLogged.toFixed(1)}h vs {d.expected}h
                    </span>
                    <Badge className="bg-warning/15 text-warning border-warning/30 tabular-nums">
                      ×{d.ratio.toFixed(1)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {hoursMatrix.ghostItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Horas fantasma — items in-progress sin tracking ({hoursMatrix.ghostItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {hoursMatrix.ghostItems.map(i => (
                  <div key={`${i.source}-${i.id}`} className="flex items-center gap-2 p-2 rounded bg-destructive/5 border border-destructive/15 text-xs">
                    <Badge variant="outline" className="text-[10px] shrink-0">{i.source === "task" ? "T" : "C"}</Badge>
                    <span className="flex-1 truncate font-medium">{i.title}</span>
                    <span className="text-muted-foreground text-[11px] truncate max-w-[120px] shrink-0">{i.owner}</span>
                    {i.client_name && <span className="text-muted-foreground text-[11px] truncate max-w-[100px] shrink-0 hidden md:inline">{i.client_name}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs correctivos */}
      <ClientFinancialsWizard open={finWizardOpen} onOpenChange={setFinWizardOpen} />
      <QuickSprintInitializer open={sprintInitOpen} onOpenChange={setSprintInitOpen} />
    </div>
  );
}
