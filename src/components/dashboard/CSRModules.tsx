import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupportMinutas } from "@/components/support/SupportMinutas";
import type { SupportTicket } from "@/hooks/useSupportTickets";
import {
  Plus, Trash2, Loader2, CalendarClock, Building2, Sparkles, ListChecks,
  Briefcase, ArrowRight, Flag, Target, Flame, AlertOctagon, Milestone, CalendarX,
  List, CalendarDays, FileText, ChevronLeft, ChevronRight, CheckSquare, Users,
  ExternalLink, Handshake, Search,
} from "lucide-react";
import { Confidential } from "@/components/common/Confidential";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import {
  useCsrTasks, useUpsertCsrTask, useToggleCsrTask, useDeleteCsrTask,
  useCsrBlockers, useUpsertCsrBlocker, useUpdateBlockerStatus,
  useCsrMilestones, useCsrQuotes, useCsrCommercialSignals, useCsrAssistant, type CsrPlan,
} from "@/hooks/useCsrWorkspace";

// Tipografía de marca SYSDE (display).
const MONT = { fontFamily: "'Montserrat', system-ui, sans-serif" } as const;

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
  "Prospecto": "bg-primary/15 text-primary border-primary/30",
  "Propuesta en curso": "bg-info/15 text-info border-info/30",
  "Ganado": "bg-success/15 text-success border-success/30",
  "Reintentar": "bg-warning/15 text-warning border-warning/30",
};

const SIGNAL_TONE: Record<string, string> = {
  hot: "bg-primary/15 text-primary border-primary/30",
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
        <h3 className="text-sm font-bold flex items-center gap-2" style={MONT}><Briefcase className="h-4 w-4 text-primary" /> Cotizaciones</h3>
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
          <h3 className="text-sm font-bold flex items-center gap-2" style={MONT}><Target className="h-4 w-4 text-primary" /> Mapeo de prospectos</h3>
          {oportunidades > 0 && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{oportunidades} oportunidad{oportunidades === 1 ? "" : "es"}</Badge>}
        </div>
        <p className="text-[11px] text-muted-foreground">Señales reales por cliente: consumo de la bolsa, hitos por facturar, suscripción vencida, falta de contrato y cotizaciones sin cierre.</p>
        {prospects.length === 0 ? (
          <EmptyState icon={<Target className="h-5 w-5" />} title="Sin señales comerciales" hint="El mapeo se arma con la actividad y los datos de contrato/facturación de tus clientes." />
        ) : (
          <div className="space-y-1.5">
            {prospects.slice(0, 30).map((p) => (
              <Card key={p.id} className={p.hot ? "border-primary/40" : ""}>
                <CardContent className="p-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.hot && <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">oportunidad</Badge>}
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

// ═══ Agenda · Lista / Calendario / Minutas ═════════════════════════════════
interface AgendaSession {
  id: string; client_id: string; title: string; date: string; summary: string;
  cases_referenced: string[]; action_items: string[]; agreements: string[]; attendees: string[];
}
interface AgendaEvent {
  key: string; kind: "sesión" | "entrega"; date: Date; title: string;
  client_id: string; session?: AgendaSession; ticket?: SupportTicket;
}
function safeDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function AgendaModule({
  tickets = [], allTickets = [], clientName, clients = [], onOpenCase,
}: {
  tickets?: any[]; allTickets?: SupportTicket[]; clientName: (id?: string | null) => string;
  clients?: { id: string; name: string }[]; onOpenCase?: (t: SupportTicket) => void;
}) {
  const [view, setView] = useState<"lista" | "calendario" | "minutas">("lista");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [detail, setDetail] = useState<AgendaSession | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ["csr-agenda-sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("support_minutes")
        .select("id, client_id, title, date, summary, cases_referenced, action_items, agreements, attendees")
        .order("date", { ascending: false }).limit(200);
      return (data || []) as unknown as AgendaSession[];
    },
  });

  const events = useMemo<AgendaEvent[]>(() => {
    const ev: AgendaEvent[] = [];
    for (const s of sessions) {
      const d = safeDate(s.date);
      if (d) ev.push({ key: `s-${s.id}`, kind: "sesión", date: d, title: s.title || "Sesión de soporte", client_id: s.client_id, session: s });
    }
    for (const t of tickets) {
      const d = safeDate(t.fecha_entrega);
      if (d) ev.push({ key: `t-${t.id}`, kind: "entrega", date: d, title: `${t.ticket_id} · ${t.asunto}`, client_id: t.client_id, ticket: t });
    }
    return ev.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sessions, tickets]);

  const openEvent = (e: AgendaEvent) => {
    if (e.kind === "sesión" && e.session) setDetail(e.session);
    else if (e.kind === "entrega" && e.ticket && onOpenCase) onOpenCase(e.ticket);
  };

  const VIEWS = [
    { key: "lista" as const, label: "Lista", Icon: List },
    { key: "calendario" as const, label: "Calendario", Icon: CalendarDays },
    { key: "minutas" as const, label: "Minutas", Icon: FileText },
  ];

  return (
    <div className="space-y-3">
      {/* Selector de vista */}
      <div className="flex items-center gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`h-8 px-3 rounded-full border text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${view === v.key ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-accent/50"}`}
          >
            <v.Icon className="h-3.5 w-3.5" /> {v.label}
          </button>
        ))}
      </div>

      {view === "lista" && <AgendaLista events={events} clientName={clientName} onOpen={openEvent} />}
      {view === "calendario" && <AgendaCalendario events={events} cursor={cursor} setCursor={setCursor} clientName={clientName} onOpen={openEvent} />}
      {view === "minutas" && <MinutasView sessions={sessions} clientName={clientName} clients={clients} allTickets={allTickets} onDetail={setDetail} />}

      <MinutaDetailDialog minuta={detail} onOpenChange={(o) => !o && setDetail(null)} clientName={clientName} allTickets={allTickets} onOpenCase={(t) => { setDetail(null); onOpenCase?.(t); }} />
    </div>
  );
}

const KIND_TONE: Record<string, string> = {
  "sesión": "bg-info/10 text-info border-info/30",
  "entrega": "bg-warning/10 text-warning border-warning/30",
};

function AgendaLista({ events, clientName, onOpen }: { events: AgendaEvent[]; clientName: (id?: string | null) => string; onOpen: (e: AgendaEvent) => void }) {
  const now = Date.now();
  const proximas = events.filter((e) => e.date.getTime() >= now).sort((a, b) => a.date.getTime() - b.date.getTime());
  const pasadas = events.filter((e) => e.date.getTime() < now);
  if (events.length === 0) return <EmptyState icon={<CalendarX className="h-5 w-5" />} title="Sin eventos en la agenda" hint="Se listan sesiones periódicas y fechas de entrega de tus casos." />;
  const Row = (e: AgendaEvent) => (
    <button key={e.key} onClick={() => onOpen(e)} className="w-full text-left">
      <Card className="hover:border-primary/40 transition-colors"><CardContent className="p-2.5 flex items-center gap-3">
        <div className="w-12 shrink-0 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">{format(e.date, "MMM", { locale: es })}</p>
          <p className="text-lg font-black leading-none tabular-nums">{format(e.date, "d")}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[9px] ${KIND_TONE[e.kind]}`}>{e.kind}</Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{clientName(e.client_id)}</span>
            {e.kind === "sesión" && !!e.session?.cases_referenced?.length && <span className="text-[10px] text-muted-foreground">· {e.session.cases_referenced.length} casos</span>}
          </div>
          <p className="text-sm font-medium truncate mt-0.5">{e.title}</p>
        </div>
        {e.kind === "sesión" ? <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </CardContent></Card>
    </button>
  );
  return (
    <div className="space-y-4">
      {proximas.length > 0 && (
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground" style={MONT}>Próximas ({proximas.length})</h4>
          {proximas.map(Row)}
        </section>
      )}
      {pasadas.length > 0 && (
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground" style={MONT}>Pasadas ({pasadas.length})</h4>
          {pasadas.slice(0, 40).map(Row)}
        </section>
      )}
    </div>
  );
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
function AgendaCalendario({ events, cursor, setCursor, clientName, onOpen }: {
  events: AgendaEvent[]; cursor: Date; setCursor: (d: Date) => void;
  clientName: (id?: string | null) => string; onOpen: (e: AgendaEvent) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  });
  const byDay = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>();
    for (const e of events) {
      const k = format(e.date, "yyyy-MM-dd");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [events]);
  const today = new Date();
  return (
    <Card><CardContent className="p-3">
      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCursor(addMonths(cursor, -1))} className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-sm font-bold capitalize" style={MONT}>{format(cursor, "MMMM yyyy", { locale: es })}</p>
        <button onClick={() => setCursor(addMonths(cursor, 1))} className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
      </div>
      {/* Encabezado de días */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => <div key={d} className="text-[10px] font-semibold uppercase text-muted-foreground text-center">{d}</div>)}
      </div>
      {/* Celdas */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = format(d, "yyyy-MM-dd");
          const evs = byDay.get(k) || [];
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          return (
            <div key={k} className={`min-h-[64px] rounded-md border p-1 ${inMonth ? "border-border/60" : "border-transparent opacity-40"} ${isToday ? "bg-primary/[0.06] border-primary/40" : ""}`}>
              <p className={`text-[10px] font-semibold tabular-nums ${isToday ? "text-primary" : "text-muted-foreground"}`}>{format(d, "d")}</p>
              <div className="space-y-0.5 mt-0.5">
                {evs.slice(0, 2).map((e) => (
                  <button key={e.key} onClick={() => onOpen(e)} title={`${clientName(e.client_id)} · ${e.title}`}
                    className={`w-full truncate text-left text-[9px] px-1 py-0.5 rounded border ${KIND_TONE[e.kind]}`}>
                    {e.kind === "sesión" ? "◉" : "▸"} {e.title}
                  </button>
                ))}
                {evs.length > 2 && <p className="text-[9px] text-muted-foreground pl-1">+{evs.length - 2}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

// ── Minutas · lista total + segmentación (búsqueda, cliente, período) ────────
type Period = "todas" | "mes" | "trim" | "anio";
const PERIODS: { key: Period; label: string }[] = [
  { key: "todas", label: "Todo el tiempo" },
  { key: "mes", label: "Este mes" },
  { key: "trim", label: "Últimos 3 meses" },
  { key: "anio", label: "Este año" },
];
function inPeriod(d: Date | null, p: Period): boolean {
  if (p === "todas") return true;
  if (!d) return false;
  const now = new Date();
  if (p === "anio") return d.getFullYear() === now.getFullYear();
  if (p === "mes") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (p === "trim") return d.getTime() >= addMonths(now, -3).getTime();
  return true;
}

function MinutasView({ sessions, clientName, clients = [], allTickets = [], onDetail }: {
  sessions: AgendaSession[]; clientName: (id?: string | null) => string;
  clients?: { id: string; name: string }[]; allTickets?: SupportTicket[];
  onDetail: (m: AgendaSession) => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [client, setClient] = useState("all");
  const [period, setPeriod] = useState<Period>("todas");
  const [createOpen, setCreateOpen] = useState(false);

  // Clientes que efectivamente tienen minutas (para el segmentador).
  const clientOpts = useMemo(() => {
    const ids = new Set(sessions.map((s) => s.client_id));
    return clients.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions, clients]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (client !== "all" && s.client_id !== client) return false;
      if (!inPeriod(safeDate(s.date), period)) return false;
      if (term) {
        const hay = [s.title, s.summary, clientName(s.client_id)].some((f) => (f || "").toLowerCase().includes(term));
        if (!hay) return false;
      }
      return true;
    });
  }, [sessions, search, client, period, clientName]);

  const closeCreate = (o: boolean) => {
    setCreateOpen(o);
    if (!o) qc.invalidateQueries({ queryKey: ["csr-agenda-sessions"] });
  };

  return (
    <div className="space-y-3">
      {/* Encabezado + crear */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2" style={MONT}>
          <FileText className="h-4 w-4 text-primary" /> Minutas
          <span className="text-[11px] font-normal text-muted-foreground tabular-nums">{filtered.length}/{sessions.length}</span>
        </h3>
        <Button size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Nueva minuta
        </Button>
      </div>

      {/* Segmentación */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, contenido o cliente…" className="h-8 pl-8 text-xs" />
        </div>
        <Select value={client} onValueChange={setClient}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clientOpts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Segmentación rápida por cliente (chips con conteo) */}
      {clientOpts.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setClient("all")} className={`h-6 px-2.5 rounded-full border text-[10px] font-semibold ${client === "all" ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-accent/50"}`}>Todos</button>
          {clientOpts.slice(0, 8).map((c) => {
            const n = sessions.filter((s) => s.client_id === c.id).length;
            return (
              <button key={c.id} onClick={() => setClient(c.id)} className={`h-6 px-2.5 rounded-full border text-[10px] font-semibold inline-flex items-center gap-1 ${client === c.id ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-accent/50"}`}>
                {c.name} <span className="opacity-70 tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title={sessions.length === 0 ? "Sin minutas registradas" : "Ninguna minuta coincide con el filtro"} hint={sessions.length === 0 ? "Creá la primera con «Nueva minuta»." : "Ajustá la búsqueda, el cliente o el período."} />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((m) => {
            const d = safeDate(m.date);
            return (
              <button key={m.id} onClick={() => onDetail(m)} className="w-full text-left">
                <Card className="hover:border-primary/40 transition-colors"><CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{m.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{clientName(m.client_id)}</span>
                        {d && <span className="flex items-center gap-1"><CalendarClock className="h-2.5 w-2.5" />{format(d, "d MMM yyyy", { locale: es })}</span>}
                      </div>
                      {m.summary && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{m.summary}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {m.cases_referenced?.length > 0 && <Badge variant="outline" className="text-[9px] gap-0.5"><FileText className="h-2.5 w-2.5" />{m.cases_referenced.length}</Badge>}
                      {m.agreements?.length > 0 && <Badge variant="outline" className="text-[9px] gap-0.5 text-success border-success/30"><Handshake className="h-2.5 w-2.5" />{m.agreements.length}</Badge>}
                      {m.action_items?.length > 0 && <Badge variant="outline" className="text-[9px] gap-0.5 text-warning border-warning/30"><CheckSquare className="h-2.5 w-2.5" />{m.action_items.length}</Badge>}
                    </div>
                  </div>
                </CardContent></Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Creación / gestión completa (reutiliza el gestor existente) */}
      <Dialog open={createOpen} onOpenChange={closeCreate}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={MONT} className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Gestión de minutas</DialogTitle></DialogHeader>
          <SupportMinutas
            tickets={allTickets as any}
            allTickets={allTickets as any}
            clientName="Soporte General"
            clientId="all"
            availableClients={clients}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

// Detalle de una sesión/minuta: qué se hizo, acuerdos, pendientes, casos.
function MinutaDetailDialog({ minuta, onOpenChange, clientName, allTickets = [], onOpenCase }: {
  minuta: AgendaSession | null; onOpenChange: (o: boolean) => void;
  clientName: (id?: string | null) => string; allTickets?: SupportTicket[]; onOpenCase?: (t: SupportTicket) => void;
}) {
  const findCase = (code: string) => allTickets.find((t) => t.ticket_id === code || t.id === code);
  const d = minuta ? safeDate(minuta.date) : null;
  const nCasos = minuta?.cases_referenced?.length || 0;
  const nAcuerdos = minuta?.agreements?.length || 0;
  const nPend = minuta?.action_items?.length || 0;
  return (
    <Dialog open={!!minuta} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto p-0 gap-0">
        {minuta && (
          <>
            {/* Cabecera con banda de marca */}
            <DialogHeader className="p-5 pb-4 border-b border-border bg-gradient-to-br from-primary/[0.07] to-transparent space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-tight" style={MONT}>{minuta.title}</DialogTitle>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap mt-1">
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{clientName(minuta.client_id)}</span>
                    {d && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{format(d, "EEEE d 'de' MMMM, yyyy", { locale: es })}</span>}
                  </div>
                </div>
              </div>
              {/* Resumen de la sesión en cifras */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatPill icon={<FileText className="h-3 w-3" />} n={nCasos} label="casos" />
                <StatPill icon={<Handshake className="h-3 w-3" />} n={nAcuerdos} label="acuerdos" />
                <StatPill icon={<CheckSquare className="h-3 w-3" />} n={nPend} label="pendientes" />
              </div>
              {minuta.attendees?.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {minuta.attendees.slice(0, 5).map((a, i) => (
                      <div key={i} title={a} className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-bold text-foreground/70">{initials(a)}</div>
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">{minuta.attendees.join(", ")}</span>
                </div>
              )}
            </DialogHeader>

            <div className="p-5 space-y-3.5">
              {minuta.summary && (
                <section className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5" style={MONT}><FileText className="h-3.5 w-3.5" /> Qué se hizo</h4>
                  <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{minuta.summary}</p>
                </section>
              )}

              {nAcuerdos > 0 && (
                <section className="rounded-lg border border-success/25 bg-success/[0.05] p-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-success mb-1.5 flex items-center gap-1.5" style={MONT}><Handshake className="h-3.5 w-3.5" /> Acuerdos</h4>
                  <ul className="space-y-1.5">{minuta.agreements.map((a, i) => (
                    <li key={i} className="text-[12.5px] flex items-start gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success mt-1.5 shrink-0" />{a}</li>
                  ))}</ul>
                </section>
              )}

              {nPend > 0 && (
                <section className="rounded-lg border border-warning/25 bg-warning/[0.05] p-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-warning mb-1.5 flex items-center gap-1.5" style={MONT}><CheckSquare className="h-3.5 w-3.5" /> Pendientes</h4>
                  <ul className="space-y-1.5">{minuta.action_items.map((a, i) => (
                    <li key={i} className="text-[12.5px] flex items-start gap-2"><CheckSquare className="h-3.5 w-3.5 text-warning/70 mt-0.5 shrink-0" />{a}</li>
                  ))}</ul>
                </section>
              )}

              {nCasos > 0 && (
                <section>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5" style={MONT}>Casos tratados</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {minuta.cases_referenced.map((c) => {
                      const tk = findCase(c);
                      return tk && onOpenCase ? (
                        <button key={c} onClick={() => onOpenCase(tk)} title={tk.asunto} className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                          {c} <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : (
                        <Badge key={c} variant="outline" className="text-[11px] font-mono py-1">{c}</Badge>
                      );
                    })}
                  </div>
                  {onOpenCase && <p className="text-[10px] text-muted-foreground mt-1.5">Tocá un caso para abrir su detalle.</p>}
                </section>
              )}

              {!minuta.summary && nAcuerdos === 0 && nPend === 0 && nCasos === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Esta minuta no tiene detalle registrado.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatPill({ icon, n, label }: { icon: React.ReactNode; n: number; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border ${n > 0 ? "bg-card border-border text-foreground" : "bg-muted/40 border-transparent text-muted-foreground"}`}>
      <span className={n > 0 ? "text-primary" : ""}>{icon}</span>
      <span className="tabular-nums">{n}</span> {label}
    </span>
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
