import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus, Trash2, Loader2, CalendarClock, Building2, Sparkles, ListChecks,
  Briefcase, ArrowRight, Flag, Target, Flame, AlertOctagon, Milestone, CalendarX,
} from "lucide-react";
import { Confidential } from "@/components/common/Confidential";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import {
  useCsrTasks, useUpsertCsrTask, useToggleCsrTask, useDeleteCsrTask,
  useCsrBlockers, useUpsertCsrBlocker, useUpdateBlockerStatus,
  useCsrMilestones, useCsrQuotes, useCsrCommercialSignals, useCsrAssistant, type CsrPlan,
} from "@/hooks/useCsrWorkspace";

const PRIO_TONE: Record<string, string> = {
  alta: "bg-destructive/15 text-destructive border-destructive/30",
  media: "bg-warning/15 text-warning border-warning/30",
  baja: "bg-muted text-muted-foreground",
};

// ═══ Pendientes (to-do) ═══════════════════════════════════════════════════
export function PendientesModule() {
  const { data: tasks = [], isLoading } = useCsrTasks();
  const upsert = useUpsertCsrTask();
  const toggle = useToggleCsrTask();
  const del = useDeleteCsrTask();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"alta" | "media" | "baja">("media");
  const [due, setDue] = useState("");

  const add = () => {
    if (!title.trim()) return;
    upsert.mutate({ title: title.trim(), priority, due_date: due || null }, {
      onSuccess: () => { setTitle(""); setDue(""); setPriority("media"); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nueva tarea…" className="h-8 text-xs flex-1 min-w-[180px]" />
        <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="baja">Baja</SelectItem></SelectContent>
        </Select>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-[140px] text-xs" />
        <Button size="sm" className="h-8 gap-1.5" onClick={add} disabled={upsert.isPending}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-6" /> : tasks.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-5 w-5" />} title="Sin pendientes ✨" hint="Agregá tareas de seguimiento con clientes desde el campo de arriba." />
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <Card key={t.id} className={t.done ? "opacity-60" : ""}>
              <CardContent className="p-2.5 flex items-center gap-3">
                <Checkbox checked={t.done} onCheckedChange={(v) => toggle.mutate({ id: t.id, done: !!v })} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${t.done ? "line-through" : ""}`}>{t.title}</p>
                  {t.due_date && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><CalendarClock className="h-2.5 w-2.5" />{format(new Date(t.due_date), "d MMM", { locale: es })}</p>}
                </div>
                <Badge variant="outline" className={`text-[9px] ${PRIO_TONE[t.priority]}`}>{t.priority}</Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ Obstáculos ═══════════════════════════════════════════════════════════
const BLOCKER_STATUS: Record<string, { label: string; tone: string }> = {
  abierto: { label: "Abierto", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  en_gestion: { label: "En gestión", tone: "bg-warning/15 text-warning border-warning/30" },
  resuelto: { label: "Resuelto", tone: "bg-success/15 text-success border-success/30" },
};
export function ObstaculosModule() {
  const { data: blockers = [], isLoading } = useCsrBlockers();
  const upsert = useUpsertCsrBlocker();
  const setStatus = useUpdateBlockerStatus();
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<"alta" | "media" | "baja">("media");
  const [desc, setDesc] = useState("");

  const add = () => {
    if (!title.trim()) return;
    upsert.mutate({ title: title.trim(), severity, description: desc || null }, {
      onSuccess: () => { setTitle(""); setDesc(""); setSeverity("media"); toast.success("Obstáculo registrado"); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Obstáculo / impedimento…" className="h-8 text-xs flex-1 min-w-[180px]" />
          <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="baja">Baja</SelectItem></SelectContent>
          </Select>
          <Button size="sm" className="h-8 gap-1.5" onClick={add} disabled={upsert.isPending}><Plus className="h-3.5 w-3.5" /> Registrar</Button>
        </div>
        <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detalle (opcional)…" className="text-xs" />
      </CardContent></Card>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-6" /> : blockers.length === 0 ? (
        <EmptyState icon={<AlertOctagon className="h-5 w-5" />} title="Sin obstáculos registrados" hint="Registrá impedimentos que frenan la atención al cliente para darles seguimiento." />
      ) : (
        <div className="space-y-1.5">
          {blockers.map((b) => {
            const st = BLOCKER_STATUS[b.status];
            return (
              <Card key={b.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[9px] ${PRIO_TONE[b.severity]}`}>{b.severity}</Badge>
                        <Badge variant="outline" className={`text-[9px] ${st.tone}`}>{st.label}</Badge>
                      </div>
                      <p className="text-sm font-medium mt-1">{b.title}</p>
                      {b.description && <p className="text-[11px] text-muted-foreground mt-0.5">{b.description}</p>}
                    </div>
                    <Select value={b.status} onValueChange={(v) => setStatus.mutate({ id: b.id, status: v as any })}>
                      <SelectTrigger className="h-7 w-[120px] text-[11px] shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abierto">Abierto</SelectItem>
                        <SelectItem value="en_gestion">En gestión</SelectItem>
                        <SelectItem value="resuelto">Resuelto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ Hitos (contract_milestones) ══════════════════════════════════════════
const MILESTONE_TONE: Record<string, string> = {
  propuesto: "bg-muted text-muted-foreground", confirmado: "bg-info/15 text-info border-info/30",
  cumplido: "bg-success/15 text-success border-success/30", facturado: "bg-primary/15 text-primary border-primary/30",
};
export function HitosModule({ clientName }: { clientName: (id?: string | null) => string }) {
  const { data: hitos = [], isLoading } = useCsrMilestones();
  const { canAmounts } = useFinanceAccess();
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-6" />;
  if (hitos.length === 0) return <EmptyState icon={<Milestone className="h-5 w-5" />} title="Sin hitos registrados" hint="Los hitos de facturación aparecen al extraer un contrato desde la ficha del cliente." />;
  return (
    <div className="space-y-1.5">
      {hitos.map((h) => (
        <Card key={h.id}>
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{h.numero ? `${h.numero}. ` : ""}{h.descripcion}</p>
                {h.condicion && <p className="text-[11px] text-muted-foreground mt-0.5">{h.condicion}</p>}
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="h-2.5 w-2.5" />{clientName(h.client_id)}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className={`text-[9px] ${MILESTONE_TONE[h.status] || ""}`}>{h.status}</Badge>
                {(h.monto != null || h.porcentaje != null) && (
                  <p className="text-[11px] font-semibold tabular-nums mt-1">
                    <Confidential show={canAmounts}>{h.monto != null ? `$${Number(h.monto).toLocaleString()} ${h.moneda || ""}` : `${h.porcentaje}%`}</Confidential>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══ Comercial (quotes + prospectos) ══════════════════════════════════════
const QUOTE_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", sent: "bg-info/15 text-info border-info/30",
  approved: "bg-success/15 text-success border-success/30", rejected: "bg-destructive/15 text-destructive border-destructive/30",
};
const STAGE_TONE: Record<string, string> = {
  "Prospecto": "bg-teal-500/15 text-teal-500 border-teal-500/30",
  "Propuesta en curso": "bg-info/15 text-info border-info/30",
  "Ganado": "bg-success/15 text-success border-success/30",
  "Reintentar": "bg-warning/15 text-warning border-warning/30",
};

const SIGNAL_TONE: Record<string, string> = {
  hot: "bg-teal-500/15 text-teal-500 border-teal-500/30",
  success: "bg-success/15 text-success border-success/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  warn: "bg-warning/15 text-warning border-warning/30",
  info: "bg-info/15 text-info border-info/30",
};
function stageFromQuote(status: string | null): string {
  if (status === "approved") return "Ganado";
  if (status === "rejected") return "Reintentar";
  if (status === "sent" || status === "draft") return "Propuesta en curso";
  return "Prospecto";
}

export function ComercialModule({ clientName }: { clientName: (id?: string | null) => string; tickets?: any[]; clients?: any[] }) {
  const { data: quotes = [], isLoading } = useCsrQuotes();
  const { data: signals = [] } = useCsrCommercialSignals();
  const { canAmounts } = useFinanceAccess();

  // Mapeo de prospectos a partir de SEÑALES REALES (RPC): consumo de la bolsa
  // de horas del mes, hitos cumplidos sin facturar, suscripción vencida, falta
  // de contrato con actividad, y cotización sin cierre. Cada señal sugiere una
  // acción comercial concreta.
  const prospects = signals.map((s) => {
    const chips: { label: string; tone: string }[] = [];
    let action = ""; let hot = false;
    const pct = s.included_hours > 0 ? (s.consumed_hours_month / s.included_hours) * 100 : 0;
    if (s.included_hours > 0 && pct >= 80) { chips.push({ label: `Bolsa ${Math.round(pct)}%`, tone: "hot" }); action ||= "Ampliar la bolsa de horas"; hot = true; }
    if (s.hitos_cumplidos > 0) { chips.push({ label: `${s.hitos_cumplidos} hito${s.hitos_cumplidos === 1 ? "" : "s"} por facturar`, tone: "success" }); action ||= "Facturar hito cumplido"; hot = true; }
    if (s.sub_vencida) { chips.push({ label: "Suscripción vencida", tone: "danger" }); action ||= "Gestionar renovación / cobro"; hot = true; }
    if (!s.has_active_contract && s.open_tickets > 0) { chips.push({ label: "Sin contrato activo", tone: "warn" }); action ||= "Formalizar contrato"; hot = true; }
    if (s.last_quote_status === "sent") { chips.push({ label: "Cotización sin cierre", tone: "info" }); action ||= "Dar seguimiento a la cotización"; }
    const stage = stageFromQuote(s.last_quote_status);
    if (!action) action = stage === "Prospecto" ? "Sin cotización — proponer solución" : "Mantener relación";
    const score = (hot ? 1000 : 0) + chips.length * 100 + s.open_tickets;
    return { id: s.client_id, name: clientName(s.client_id), nTickets: s.open_tickets, stage, action, chips, hot, score };
  })
    .filter((p) => p.nTickets > 0 || p.chips.length > 0)
    .sort((a, b) => b.score - a.score);

  const oportunidades = prospects.filter((p) => p.hot).length;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Cotizaciones</h3>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-4" /> : quotes.length === 0 ? (
          <EmptyState icon={<Briefcase className="h-5 w-5" />} title="Sin cotizaciones" hint="Cuando se generen cotizaciones para tus clientes, las verás acá." />
        ) : (
          <div className="space-y-1.5">
            {quotes.map((q) => (
              <Card key={q.id}><CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{q.title || q.quote_number}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{clientName(q.client_id)}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className={`text-[9px] ${QUOTE_TONE[q.status] || ""}`}>{q.status}</Badge>
                  {q.total_amount != null && <p className="text-[11px] font-semibold tabular-nums mt-1"><Confidential show={canAmounts}>${Number(q.total_amount).toLocaleString()} {q.currency}</Confidential></p>}
                </div>
              </CardContent></Card>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2"><Target className="h-4 w-4" /> Mapeo de prospectos</h3>
          {oportunidades > 0 && <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-500 border-teal-500/30">{oportunidades} oportunidad{oportunidades === 1 ? "" : "es"}</Badge>}
        </div>
        <p className="text-[11px] text-muted-foreground">Señales reales por cliente: consumo de la bolsa, hitos por facturar, suscripción vencida, falta de contrato y cotizaciones sin cierre.</p>
        {prospects.length === 0 ? (
          <EmptyState icon={<Target className="h-5 w-5" />} title="Sin señales comerciales" hint="El mapeo se arma con la actividad y los datos de contrato/facturación de tus clientes." />
        ) : (
          <div className="space-y-1.5">
            {prospects.slice(0, 30).map((p) => (
              <Card key={p.id} className={p.hot ? "border-teal-500/40" : ""}>
                <CardContent className="p-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.hot && <Badge variant="outline" className="text-[9px] bg-teal-500/10 text-teal-500 border-teal-500/30">oportunidad</Badge>}
                    </div>
                    {p.chips.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {p.chips.map((ch, i) => <Badge key={i} variant="outline" className={`text-[9px] ${SIGNAL_TONE[ch.tone] || ""}`}>{ch.label}</Badge>)}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1"><ArrowRight className="h-3 w-3 text-primary shrink-0" />{p.action}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className={`text-[9px] ${STAGE_TONE[p.stage] || ""}`}>{p.stage}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{p.nTickets} caso{p.nTickets === 1 ? "" : "s"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ═══ Agenda / Calendario ═══════════════════════════════════════════════════
export function AgendaModule({ tickets, clientName }: { tickets: any[]; clientName: (id?: string | null) => string }) {
  const { data: sessions = [] } = useQuery({
    queryKey: ["csr-agenda-sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("support_minutes" as any).select("id, client_id, title, date").order("date", { ascending: false }).limit(20);
      return (data || []) as any[];
    },
  });
  const items = [
    ...sessions.filter((s) => s.date).map((s) => ({ kind: "sesión", date: s.date as string, title: s.title || "Sesión de soporte", client: s.client_id })),
    ...tickets.filter((t) => t.fecha_entrega).map((t) => ({ kind: "entrega", date: t.fecha_entrega as string, title: `${t.ticket_id} · ${t.asunto}`, client: t.client_id })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);

  if (items.length === 0) return <EmptyState icon={<CalendarX className="h-5 w-5" />} title="Sin eventos en la agenda" hint="Se listan sesiones periódicas y fechas de entrega de tus casos." />;
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <Card key={i}><CardContent className="p-2.5 flex items-center gap-3">
          <div className="w-14 shrink-0 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{format(new Date(it.date), "MMM", { locale: es })}</p>
            <p className="text-lg font-black leading-none tabular-nums">{format(new Date(it.date), "d")}</p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={`text-[9px] ${it.kind === "sesión" ? "bg-info/10 text-info border-info/30" : "bg-warning/10 text-warning border-warning/30"}`}>{it.kind}</Badge>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{clientName(it.client)}</span>
            </div>
            <p className="text-sm font-medium truncate mt-0.5">{it.title}</p>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

// ═══ Asistente IA ══════════════════════════════════════════════════════════
export function IAAssistantModule({ tickets }: { tickets: any[] }) {
  const assistant = useCsrAssistant();
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState<CsrPlan | null>(null);
  const run = () => {
    const payload = tickets.slice(0, 60).map((t) => ({ ticket_id: t.ticket_id, asunto: t.asunto, estado: t.estado, prioridad: t.prioridad, dias: t.dias_antiguedad }));
    assistant.mutate({ tickets: payload, question: q.trim() || undefined }, {
      onSuccess: (p) => setPlan(p),
      onError: (e: any) => toast.error(e.message),
    });
  };
  return (
    <div className="space-y-3">
      <Card><CardContent className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Copiloto del agente — prioriza tu jornada a partir de tu cola.</p>
        <div className="flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Pregunta (opcional): p.ej. ¿qué atiendo primero?" className="h-8 text-xs flex-1" />
          <Button size="sm" className="h-8 gap-1.5" onClick={run} disabled={assistant.isPending}>
            {assistant.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Analizar jornada
          </Button>
        </div>
      </CardContent></Card>

      {!plan && !assistant.isPending && (
        <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Tu copiloto está listo" hint="Tocá «Analizar jornada» y te ordeno la cola: qué atender primero, qué es urgente y próximos pasos." />
      )}

      {plan && (
        <div className="space-y-3">
          <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.05] to-transparent"><CardContent className="p-3"><p className="text-sm">{plan.resumen}</p></CardContent></Card>
          {plan.urgentes && plan.urgentes.length > 0 && (
            <Section icon={<Flame className="h-3.5 w-3.5" />} title="Urgente">
              <ul className="space-y-1">
                {plan.urgentes.map((u, i) => <li key={i} className="text-xs flex items-start gap-1.5 text-destructive"><Flame className="h-3 w-3 mt-0.5 shrink-0" />{u}</li>)}
              </ul>
            </Section>
          )}
          {plan.prioridades?.length > 0 && (
            <Section icon={<Flag className="h-3.5 w-3.5" />} title="Atender primero">
              {plan.prioridades.map((p, i) => (
                <div key={i} className="rounded-lg border p-2.5 text-xs">
                  <p className="font-mono text-[11px] text-primary">{p.ticket_id}</p>
                  <p className="text-muted-foreground mt-0.5">{p.razon}</p>
                </div>
              ))}
            </Section>
          )}
          {plan.acciones?.length > 0 && (
            <Section icon={<ListChecks className="h-3.5 w-3.5" />} title="Acciones sugeridas">
              <ul className="space-y-1">
                {plan.acciones.map((a, i) => <li key={i} className="text-xs flex items-start gap-1.5"><ArrowRight className="h-3 w-3 text-primary mt-0.5 shrink-0" />{a}</li>)}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <Card><CardContent className="py-8 flex flex-col items-center text-center gap-1.5">
      <div className="h-10 w-10 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-[11px] text-muted-foreground max-w-[280px]">{hint}</p>}
    </CardContent></Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-xs font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1.5"><span className="text-primary">{icon}</span>{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
