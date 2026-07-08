import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllSupportTickets, useSupportClients, useUpdateSupportTicket, type SupportTicket } from "@/hooks/useSupportTickets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  LifeBuoy, Inbox, ArrowUpRight, CalendarClock, Loader2, PlayCircle,
  ExternalLink, Building2, AlertTriangle, CheckCircle2, Users, Search,
  Plus, Clock, Star, ListChecks, AlertOctagon, Milestone, Briefcase, Sparkles,
} from "lucide-react";
import { TicketDetailSheet } from "@/components/support/TicketDetailSheet";
import { NewTicketForm } from "@/components/support/NewTicketForm";
import {
  PendientesModule, ObstaculosModule, HitosModule, ComercialModule, AgendaModule, IAAssistantModule,
} from "./CSRModules";

const ESCALATION_TARGETS = [
  { key: "María Fernanda", label: "María Fernanda", sub: "Apoyo / negocio" },
  { key: "EW", label: "EW", sub: "Escalamiento técnico" },
];
const TARGET_KEYS = ESCALATION_TARGETS.map((t) => t.key);
const CLOSED = new Set(["CERRADA", "ANULADA", "ENTREGADA", "APROBADA"]);

type Tab = "atender" | "mios" | "escalados" | "todos";
type WorkView = "bandeja" | "agenda" | "pendientes" | "obstaculos" | "hitos" | "comercial" | "ia";
const WORKSPACE: { key: WorkView; label: string; Icon: any }[] = [
  { key: "bandeja", label: "Bandeja", Icon: Inbox },
  { key: "agenda", label: "Agenda", Icon: CalendarClock },
  { key: "pendientes", label: "Pendientes", Icon: ListChecks },
  { key: "obstaculos", label: "Obstáculos", Icon: AlertOctagon },
  { key: "hitos", label: "Hitos", Icon: Milestone },
  { key: "comercial", label: "Comercial", Icon: Briefcase },
  { key: "ia", label: "Asistente IA", Icon: Sparkles },
];

function prioTone(p?: string) {
  if (/crit/i.test(p || "")) return "bg-destructive/15 text-destructive border-destructive/30";
  if (/alta/i.test(p || "")) return "bg-warning/15 text-warning border-warning/30";
  return "bg-muted text-muted-foreground";
}
function ageTone(d: number) {
  if (d >= 7) return "text-destructive";
  if (d >= 3) return "text-warning";
  return "text-muted-foreground";
}

export function CSRDashboard() {
  const { profile } = useAuth();
  const agentName = profile?.full_name || "Agente";
  const { data: tickets = [], isLoading } = useAllSupportTickets();
  const { data: clients = [] } = useSupportClients();
  const update = useUpdateSupportTicket();

  const clientName = useMemo(() => {
    const m = new Map(clients.map((c: any) => [c.id, c.name]));
    return (id?: string | null) => (id ? m.get(id) ?? id : "—");
  }, [clients]);

  const { data: sessions = [] } = useQuery({
    queryKey: ["csr-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_minutes" as any)
        .select("id, client_id, title, date")
        .order("date", { ascending: false })
        .limit(6);
      return (data || []) as any[];
    },
  });

  // CSAT agregado (satisfacción capturada).
  const { data: csat } = useQuery({
    queryKey: ["csr-csat"],
    queryFn: async () => {
      const { data } = await supabase.from("support_ticket_feedback" as any).select("rating").limit(1000);
      const arr = (data || []).map((r: any) => r.rating).filter((n: any) => typeof n === "number");
      const avg = arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : null;
      return { avg, n: arr.length };
    },
  });

  const open = useMemo(() => tickets.filter((t) => !CLOSED.has(t.estado)), [tickets]);
  const porAtender = useMemo(() => open.filter((t) => /pendiente/i.test(t.estado) || !t.responsable), [open]);
  const escalados = useMemo(() => open.filter((t) => t.responsable && TARGET_KEYS.includes(t.responsable)), [open]);
  const mios = useMemo(() => open.filter((t) => t.responsable === agentName), [open, agentName]);

  const [view, setView] = useState<WorkView>("bandeja");
  const [tab, setTab] = useState<Tab>("atender");
  const [search, setSearch] = useState("");
  const [prio, setPrio] = useState("all");
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const [escalate, setEscalate] = useState<SupportTicket | null>(null);
  const [target, setTarget] = useState<string>(ESCALATION_TARGETS[0].key);
  const [motivo, setMotivo] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const base = tab === "atender" ? porAtender : tab === "mios" ? mios : tab === "escalados" ? escalados : open;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return base.filter((t) => {
      if (prio !== "all" && !(t.prioridad || "").toLowerCase().includes(prio)) return false;
      if (term) {
        const hay = [t.ticket_id, t.asunto, clientName(t.client_id)].some((f) => (f || "").toLowerCase().includes(term));
        if (!hay) return false;
      }
      return true;
    });
  }, [base, search, prio, clientName]);

  const atender = (t: SupportTicket) => {
    update.mutate(
      { id: t.id, updates: { responsable: agentName, estado: "EN ATENCIÓN" } },
      { onSuccess: () => toast.success(`Tomaste ${t.ticket_id}`), onError: (e: any) => toast.error(e.message) },
    );
  };

  const doEscalate = async () => {
    if (!escalate) return;
    try {
      await update.mutateAsync({ id: escalate.id, updates: { responsable: target } });
      await supabase.from("support_ticket_notes" as any).insert({
        ticket_id: escalate.id,
        content: `[ESCALADO → ${target}] ${motivo.trim() || "Sin detalle"}`,
        author_name: agentName,
        visibility: "interna",
      } as any);
      toast.success(`Caso escalado a ${target}`);
      setEscalate(null); setMotivo("");
    } catch (e: any) {
      toast.error(e.message || "No se pudo escalar");
    }
  };

  const KPIS = [
    { label: "Casos abiertos", value: open.length, Icon: Inbox, tone: "text-primary" },
    { label: "Por atender", value: porAtender.length, Icon: AlertTriangle, tone: "text-warning" },
    { label: "Mis casos", value: mios.length, Icon: CheckCircle2, tone: "text-success" },
    { label: "Escalados", value: escalados.length, Icon: ArrowUpRight, tone: "text-info" },
  ];
  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "atender", label: "Por atender", count: porAtender.length },
    { key: "mios", label: "Mis casos", count: mios.length },
    { key: "escalados", label: "Escalados", count: escalados.length },
    { key: "todos", label: "Todos", count: open.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-teal-500/15 text-teal-500 flex items-center justify-center shrink-0">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold leading-tight truncate">Centro de Atención</h1>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">Agente de soporte · {agentName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {csat?.avg != null && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-warning/10 text-warning border-warning/30" title={`${csat.n} respuestas`}>
                <Star className="h-3 w-3 fill-warning" /> CSAT {csat.avg.toFixed(1)}
              </Badge>
            )}
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setNewOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nuevo caso
            </Button>
            <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-500 border-teal-500/30 hidden sm:inline-flex">CSR</Badge>
          </div>
        </div>
      </header>

      {/* Barra de módulos del workspace */}
      <div className="border-b border-border bg-card/40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center gap-1 overflow-x-auto">
          {WORKSPACE.map((w) => (
            <button
              key={w.key}
              onClick={() => setView(w.key)}
              className={`h-11 px-3 inline-flex items-center gap-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${view === w.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <w.Icon className="h-3.5 w-3.5" /> {w.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {view === "agenda" && <AgendaModule tickets={open} clientName={clientName} />}
        {view === "pendientes" && <PendientesModule />}
        {view === "obstaculos" && <ObstaculosModule />}
        {view === "hitos" && <HitosModule clientName={clientName} />}
        {view === "comercial" && <ComercialModule clientName={clientName} tickets={tickets} clients={clients} />}
        {view === "ia" && <IAAssistantModule tickets={open} />}

        {view === "bandeja" && <>
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {KPIS.map((k) => (
            <Card key={k.label} className="cursor-default">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <k.Icon className={`h-3.5 w-3.5 ${k.tone}`} />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{k.label}</p>
                </div>
                <p className="text-2xl font-black tabular-nums">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 space-y-3">
            {/* Tabs de cola */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {TABS.map((tb) => (
                <button
                  key={tb.key}
                  onClick={() => setTab(tb.key)}
                  className={`h-8 px-3 rounded-full border text-xs font-semibold transition-colors flex items-center gap-1.5 ${tab === tb.key ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-accent/50"}`}
                >
                  {tb.label}
                  <span className="tabular-nums text-[10px] opacity-70">{tb.count}</span>
                </button>
              ))}
            </div>

            {/* Buscar + filtro */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ID, asunto o cliente…" className="h-8 pl-8 text-xs" />
              </div>
              <Select value={prio} onValueChange={setPrio}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda prioridad</SelectItem>
                  <SelectItem value="crit">Crítica</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <Card><CardContent className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sin casos en esta vista.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {filtered.slice(0, 50).map((t) => {
                  const isEsc = t.responsable && TARGET_KEYS.includes(t.responsable);
                  const age = t.dias_antiguedad ?? 0;
                  return (
                    <Card key={t.id} className={isEsc ? "border-info/40" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <button className="min-w-0 text-left flex-1" onClick={() => setDetail(t)}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-mono text-muted-foreground">{t.ticket_id}</span>
                              <Badge variant="outline" className={`text-[9px] ${prioTone(t.prioridad)}`}>{t.prioridad}</Badge>
                              <Badge variant="outline" className="text-[9px]">{t.estado}</Badge>
                              <span className={`text-[10px] flex items-center gap-0.5 ${ageTone(age)}`}><Clock className="h-2.5 w-2.5" />{age}d</span>
                              {isEsc && <Badge variant="outline" className="text-[9px] bg-info/10 text-info border-info/30 gap-0.5"><ArrowUpRight className="h-2.5 w-2.5" />{t.responsable}</Badge>}
                            </div>
                            <p className="text-sm font-medium mt-0.5 truncate">{t.asunto}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="h-3 w-3" /> {clientName(t.client_id)}</p>
                          </button>
                          <div className="flex flex-col gap-1 shrink-0">
                            {t.responsable !== agentName && !isEsc && (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => atender(t)} disabled={update.isPending}>
                                <PlayCircle className="h-3 w-3" /> Atender
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => setEscalate(t)}>
                              <ArrowUpRight className="h-3 w-3" /> Escalar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => setDetail(t)}>
                              <ExternalLink className="h-3 w-3" /> Abrir
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {filtered.length > 50 && <p className="text-[11px] text-muted-foreground text-center py-1">Mostrando 50 de {filtered.length}. Usá el buscador para acotar.</p>}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="space-y-2">
              <h2 className="text-sm font-bold flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Sesiones periódicas</h2>
              {sessions.length === 0 ? (
                <Card><CardContent className="py-5 text-center text-[11px] text-muted-foreground">Sin sesiones registradas.</CardContent></Card>
              ) : (
                <div className="space-y-1.5">
                  {sessions.map((s) => (
                    <Card key={s.id}>
                      <CardContent className="p-2.5">
                        <p className="text-xs font-medium truncate">{s.title || "Sesión de soporte"}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{clientName(s.client_id)}</span>
                          {s.date && <span className="flex items-center gap-1"><CalendarClock className="h-2.5 w-2.5" />{format(new Date(s.date), "d MMM yyyy", { locale: es })}</span>}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold flex items-center gap-2"><Users className="h-4 w-4" /> Escalación</h2>
              <Card><CardContent className="p-3 space-y-2">
                {ESCALATION_TARGETS.map((tg) => (
                  <div key={tg.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">{tg.label}</p>
                      <p className="text-[10px] text-muted-foreground">{tg.sub}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] tabular-nums">{open.filter((t) => t.responsable === tg.key).length}</Badge>
                  </div>
                ))}
              </CardContent></Card>
            </section>
          </aside>
        </div>
        </>}
      </main>

      <TicketDetailSheet ticket={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} canEditInternal />
      <NewTicketForm open={newOpen} onOpenChange={setNewOpen} mode="admin" />

      <Dialog open={!!escalate} onOpenChange={(o) => !o && setEscalate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4" /> Escalar caso {escalate?.ticket_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground truncate">{escalate?.asunto}</p>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><Users className="h-3 w-3" /> Escalar a</p>
              <div className="grid grid-cols-2 gap-2">
                {ESCALATION_TARGETS.map((tg) => (
                  <button
                    key={tg.key}
                    onClick={() => setTarget(tg.key)}
                    className={`rounded-lg border p-2.5 text-left transition-colors ${target === tg.key ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"}`}
                  >
                    <p className="text-sm font-semibold">{tg.label}</p>
                    <p className="text-[10px] text-muted-foreground">{tg.sub}</p>
                  </button>
                ))}
              </div>
            </div>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la escalación…" className="text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalate(null)}>Cancelar</Button>
            <Button onClick={doEscalate} disabled={update.isPending} className="gap-1.5">
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
              Escalar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CSRDashboard;
