import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Headset, AlertTriangle, Clock, CheckCircle2, Activity, Send,
  MessageSquare, TrendingUp, Flame, Loader2, Search, ChevronRight,
  Calendar, FileText, Ticket, Sparkles, Bug, HelpCircle, Settings2,
  Zap, GraduationCap, ArrowLeft, ArrowRight, X, CheckCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { type Client } from "@/data/projectData";
import { useSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SharedMinutasPanel } from "./SharedMinutasPanel";

interface Props {
  client: Client;
}

// Buckets
const OPEN_STATES = ["EN ATENCIÓN", "PENDIENTE", "ON HOLD", "POR CERRAR", "VALORACIÓN", "COTIZADA", "APROBADA"];
const CLOSED_STATES = ["CERRADA", "ENTREGADA", "ANULADA"];

const PRIORITY_STYLES: Record<string, string> = {
  "Critica, Impacto Negocio": "bg-destructive/15 text-destructive border-destructive/30",
  "Alta": "bg-warning/15 text-warning border-warning/30",
  "Media": "bg-info/15 text-info border-info/30",
  "Baja": "bg-muted text-muted-foreground border-border",
};

const STATE_STYLES: Record<string, string> = {
  "EN ATENCIÓN": "bg-info/15 text-info",
  "PENDIENTE": "bg-warning/15 text-warning",
  "ON HOLD": "bg-muted text-muted-foreground",
  "POR CERRAR": "bg-success/15 text-success",
  "ENTREGADA": "bg-success/15 text-success",
  "CERRADA": "bg-muted text-muted-foreground",
  "ANULADA": "bg-muted text-muted-foreground",
};

function getHealth(openCount: number, criticalCount: number) {
  if (criticalCount > 0) return { label: "Crítico", emoji: "🚨", color: "from-[hsl(0_75%_35%)] via-[hsl(0_72%_45%)] to-[hsl(0_85%_55%)]" };
  if (openCount > 15) return { label: "Atención", emoji: "⚠️", color: "from-[hsl(20_85%_45%)] via-[hsl(25_92%_50%)] to-[hsl(38_92%_55%)]" };
  if (openCount > 5) return { label: "Estable", emoji: "✅", color: "from-[hsl(0_72%_42%)] via-[hsl(0_72%_51%)] to-[hsl(15_85%_55%)]" };
  return { label: "Excelente", emoji: "🌟", color: "from-[hsl(0_72%_45%)] via-[hsl(0_72%_51%)] to-[hsl(0_85%_60%)]" };
}

export function GerenteSupportDashboard({ client }: Props) {
  const { profile } = useAuth();
  const { data: tickets = [], isLoading } = useSupportTickets(client.id);
  const [tab, setTab] = useState("resumen");
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // New request wizard
  const [requestOpen, setRequestOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [requestCategory, setRequestCategory] = useState<string>("");
  const [requestText, setRequestText] = useState("");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestPriority, setRequestPriority] = useState("Media");
  const [requestProduct, setRequestProduct] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetWizard = () => {
    setWizardStep(1);
    setRequestCategory("");
    setRequestText("");
    setRequestTitle("");
    setRequestPriority("Media");
    setRequestProduct("");
  };

  // ── Metrics ──
  const openTickets = useMemo(() => tickets.filter(t => OPEN_STATES.includes(t.estado)), [tickets]);
  const closedTickets = useMemo(() => tickets.filter(t => CLOSED_STATES.includes(t.estado)), [tickets]);
  const criticalTickets = useMemo(() => openTickets.filter(t => t.prioridad?.toLowerCase().includes("critica")), [openTickets]);
  const highPriorityOpen = useMemo(() => openTickets.filter(t => t.prioridad === "Alta"), [openTickets]);
  const oldTickets = useMemo(() => openTickets.filter(t => (t.dias_antiguedad ?? 0) > 30), [openTickets]);

  const avgAge = openTickets.length
    ? Math.round(openTickets.reduce((a, t) => a + (t.dias_antiguedad ?? 0), 0) / openTickets.length)
    : 0;

  const productCounts = useMemo(() => {
    const m = new Map<string, number>();
    openTickets.forEach(t => m.set(t.producto || "Sin producto", (m.get(t.producto || "Sin producto") || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [openTickets]);

  const filteredOpen = useMemo(() => {
    const q = search.trim().toLowerCase();
    return openTickets
      .filter(t => filterPriority === "all" || t.prioridad === filterPriority)
      .filter(t => !q || t.asunto?.toLowerCase().includes(q) || t.ticket_id?.toLowerCase().includes(q) || t.producto?.toLowerCase().includes(q))
      .sort((a, b) => (b.dias_antiguedad ?? 0) - (a.dias_antiguedad ?? 0));
  }, [openTickets, search, filterPriority]);

  const health = getHealth(openTickets.length, criticalTickets.length);

  // ── Submit new request ──
  const handleSubmitRequest = async () => {
    if (!requestText.trim() || !requestTitle.trim()) {
      toast.error("Completa el título y la descripción");
      return;
    }
    setSubmitting(true);
    try {
      const ticketId = `CLI-${Date.now().toString().slice(-6)}`;
      const { error } = await (supabase.from("support_tickets") as any).insert({
        client_id: client.id,
        ticket_id: ticketId,
        producto: requestProduct || "General",
        asunto: requestTitle.slice(0, 120),
        tipo: requestCategory || "Solicitud Cliente",
        prioridad: requestPriority,
        estado: "PENDIENTE",
        fecha_registro: new Date().toISOString(),
        dias_antiguedad: 0,
        notas: `[${requestCategory || "Solicitud"}] Creada desde el portal por ${profile?.full_name || "cliente"}:\n\n${requestText}`,
        case_agreements: [],
        case_actions: [],
      });
      if (error) throw error;
      await supabase.from("client_notifications").insert({
        client_id: client.id,
        type: requestPriority.toLowerCase().includes("critica") ? "error" : "warning",
        title: `Nueva solicitud: ${requestTitle.slice(0, 60)}`,
        message: `${profile?.full_name || "Cliente"} · ${requestCategory || "Solicitud"} · ${requestPriority}`,
      });
      toast.success("✓ Solicitud enviada al equipo de Soporte Sysde", {
        description: `Ticket ${ticketId} creado. Recibirás respuesta pronto.`,
      });
      resetWizard();
      setRequestOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl lg:max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start">

        {/* ─── LEFT / TOP COLUMN ─── */}
        <div className="lg:sticky lg:top-4 space-y-4">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("relative overflow-hidden rounded-2xl p-5 lg:p-6 text-white", `bg-gradient-to-br ${health.color}`)}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70 mb-0.5 flex items-center gap-1.5">
                    <Headset className="h-3 w-3" /> Soporte Sysde
                  </p>
                  <h1 className="text-xl md:text-2xl font-black leading-tight truncate">{client.name}</h1>
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-[10px] shrink-0">
                  {health.emoji} {health.label}
                </Badge>
              </div>

              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl md:text-5xl font-black leading-none tabular-nums">{openTickets.length}</span>
                <span className="text-xs text-white/80 mb-2 ml-1">casos abiertos</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                  <p className="text-[9px] uppercase text-white/70 mb-0.5">Críticos</p>
                  <p className="text-sm font-bold tabular-nums">{criticalTickets.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                  <p className="text-[9px] uppercase text-white/70 mb-0.5">Antigüedad</p>
                  <p className="text-sm font-bold tabular-nums">{avgAge}d</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                  <p className="text-[9px] uppercase text-white/70 mb-0.5">Cerrados</p>
                  <p className="text-sm font-bold tabular-nums">{closedTickets.length}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick action: new request */}
          <Button
            onClick={() => setRequestOpen(true)}
            className="w-full h-12 text-sm font-semibold shadow-md"
            size="lg"
          >
            <Send className="h-4 w-4 mr-2" /> Nueva solicitud de soporte
          </Button>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={Flame} label="Alta prioridad" value={highPriorityOpen.length} tone="warning" />
            <MiniStat icon={Clock} label=">30 días" value={oldTickets.length} tone="destructive" />
          </div>
        </div>

        {/* ─── RIGHT / MAIN COLUMN ─── */}
        <div className="min-w-0 mt-4 lg:mt-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full sticky top-0 z-10 bg-background/95 backdrop-blur-sm h-11">
              <TabsTrigger value="resumen" className="text-xs gap-1.5">
                <Activity className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Resumen</span>
              </TabsTrigger>
              <TabsTrigger value="abiertos" className="text-xs gap-1.5 relative">
                <Ticket className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Abiertos</span>
                {openTickets.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-1 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                    {openTickets.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="historial" className="text-xs gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Historial</span>
              </TabsTrigger>
            </TabsList>

            {/* RESUMEN */}
            <TabsContent value="resumen" className="mt-4 space-y-3">
              {/* Critical alerts */}
              {criticalTickets.length > 0 && (
                <Card className="border-destructive/40 bg-destructive/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <h3 className="text-sm font-bold text-destructive">Casos Críticos</h3>
                    </div>
                    <div className="space-y-2">
                      {criticalTickets.slice(0, 3).map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTicket(t)}
                          className="w-full text-left p-2 rounded-lg bg-background hover:bg-muted/50 border border-destructive/20"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold truncate">{t.asunto}</p>
                            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{t.dias_antiguedad}d</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{t.ticket_id} · {t.producto}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top productos */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold">Casos por producto</h3>
                  </div>
                  {productCounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin casos abiertos</p>
                  ) : (
                    <div className="space-y-2">
                      {productCounts.map(([product, count]) => {
                        const pct = openTickets.length ? Math.round((count / openTickets.length) * 100) : 0;
                        return (
                          <div key={product}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium truncate">{product}</p>
                              <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6 }}
                                className="h-full bg-primary"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent activity */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-info" />
                    <h3 className="text-sm font-bold">Actividad reciente</h3>
                  </div>
                  <div className="space-y-2">
                    {tickets.slice(0, 5).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        className="w-full text-left p-2 rounded-lg hover:bg-muted/50 flex items-center gap-2"
                      >
                        <div className={cn("h-2 w-2 rounded-full shrink-0", OPEN_STATES.includes(t.estado) ? "bg-warning" : "bg-success")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{t.asunto}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{t.ticket_id} · {t.estado}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Shared presentations from Sysde */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold">Minutas compartidas</h3>
                  </div>
                  <SharedMinutasPanel clientId={client.id} compact />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABIERTOS */}
            <TabsContent value="abiertos" className="mt-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por asunto o ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-7 h-9 text-xs"
                  />
                </div>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Critica, Impacto Negocio">Crítica</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredOpen.length === 0 ? (
                <EmptyState message="No hay casos abiertos" />
              ) : (
                <div className="space-y-2">
                  {filteredOpen.map((t, idx) => (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                      onClick={() => setSelectedTicket(t)}
                      className="w-full text-left"
                    >
                      <Card className="hover:border-primary/40 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate">{t.asunto}</p>
                              <p className="text-[10px] text-muted-foreground">{t.ticket_id} · {t.producto}</p>
                            </div>
                            <Badge className={cn("text-[9px] shrink-0", PRIORITY_STYLES[t.prioridad] || "")}>
                              {t.prioridad === "Critica, Impacto Negocio" ? "Crítica" : t.prioridad}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={cn("px-1.5 py-0.5 rounded font-semibold", STATE_STYLES[t.estado] || "bg-muted")}>{t.estado}</span>
                            <span className="text-muted-foreground tabular-nums">{t.dias_antiguedad}d</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* HISTORIAL */}
            <TabsContent value="historial" className="mt-4 space-y-2">
              {closedTickets.length === 0 ? (
                <EmptyState message="No hay casos cerrados aún" />
              ) : (
                closedTickets.slice(0, 30).map(t => (
                  <button key={t.id} onClick={() => setSelectedTicket(t)} className="w-full text-left">
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{t.asunto}</p>
                            <p className="text-[10px] text-muted-foreground">{t.ticket_id} · {t.producto}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] shrink-0">{t.estado}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ─── Ticket detail sheet ─── */}
      <Sheet open={!!selectedTicket} onOpenChange={o => !o && setSelectedTicket(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selectedTicket && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={cn("text-[9px]", PRIORITY_STYLES[selectedTicket.prioridad] || "")}>
                    {selectedTicket.prioridad === "Critica, Impacto Negocio" ? "Crítica" : selectedTicket.prioridad}
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">{selectedTicket.estado}</Badge>
                </div>
                <SheetTitle className="text-base text-left">{selectedTicket.asunto}</SheetTitle>
                <SheetDescription className="text-left">
                  {selectedTicket.ticket_id} · {selectedTicket.producto}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-[9px] uppercase text-muted-foreground">Antigüedad</p>
                    <p className="font-bold tabular-nums">{selectedTicket.dias_antiguedad} días</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-[9px] uppercase text-muted-foreground">Tipo</p>
                    <p className="font-bold truncate">{selectedTicket.tipo}</p>
                  </div>
                </div>
                {selectedTicket.responsable && (
                  <div>
                    <p className="text-[9px] uppercase text-muted-foreground mb-1">Responsable</p>
                    <p className="font-medium">{selectedTicket.responsable}</p>
                  </div>
                )}
                {selectedTicket.ai_summary && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <p className="text-[10px] font-semibold text-primary uppercase">Resumen IA</p>
                    </div>
                    <p className="leading-relaxed">{selectedTicket.ai_summary}</p>
                  </div>
                )}
                {selectedTicket.notas && (
                  <div>
                    <p className="text-[9px] uppercase text-muted-foreground mb-1">Notas</p>
                    <p className="leading-relaxed bg-muted/30 rounded-lg p-2">{selectedTicket.notas}</p>
                  </div>
                )}
                {selectedTicket.case_agreements?.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase text-muted-foreground mb-1.5">Acuerdos</p>
                    <ul className="space-y-1.5">
                      {selectedTicket.case_agreements.map((a, i) => (
                        <li key={i} className="bg-muted/30 rounded p-2">
                          <p>{a.text}</p>
                          {(a.responsible || a.date) && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {a.responsible} {a.date && `· ${a.date}`}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── New request wizard sheet ─── */}
      <Sheet open={requestOpen} onOpenChange={(o) => { setRequestOpen(o); if (!o) resetWizard(); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[92vh] overflow-y-auto p-0 border-t-2 border-primary/20 sm:max-w-2xl sm:mx-auto"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Nueva solicitud de soporte</SheetTitle>
            <SheetDescription>Asistente paso a paso para crear una solicitud</SheetDescription>
          </SheetHeader>
          {/* Header with progress */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-5 pt-5 pb-3">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Headset className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight">Nueva solicitud</h2>
                  <p className="text-[11px] text-muted-foreground">Soporte Sysde · Paso {wizardStep} de 3</p>
                </div>
              </div>
              <button
                onClick={() => setRequestOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: wizardStep >= s ? "100%" : "0%" }}
                    transition={{ duration: 0.4 }}
                    className="h-full bg-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-5">
            {wizardStep === 1 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold mb-1">¿Qué tipo de ayuda necesitas?</h3>
                  <p className="text-xs text-muted-foreground">Elige la opción que mejor describa tu solicitud</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "Bug", label: "Reportar un error", desc: "Algo no funciona", icon: Bug, color: "destructive" },
                    { id: "Consulta", label: "Hacer una consulta", desc: "Tengo una duda", icon: HelpCircle, color: "info" },
                    { id: "Mejora", label: "Solicitar mejora", desc: "Sugerir cambio", icon: Sparkles, color: "primary" },
                    { id: "Configuración", label: "Configuración", desc: "Ajuste de sistema", icon: Settings2, color: "warning" },
                    { id: "Capacitación", label: "Capacitación", desc: "Necesito entrenamiento", icon: GraduationCap, color: "info" },
                    { id: "Urgencia Operativa", label: "Urgencia operativa", desc: "Impacto al negocio", icon: Zap, color: "destructive" },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const selected = requestCategory === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setRequestCategory(opt.id);
                          if (opt.id === "Urgencia Operativa") setRequestPriority("Critica, Impacto Negocio");
                          else if (opt.id === "Bug") setRequestPriority("Alta");
                        }}
                        className={cn(
                          "relative text-left p-3.5 rounded-xl border-2 transition-all",
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-muted/30"
                        )}
                      >
                        {selected && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <CheckCheck className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        <div className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center mb-2",
                          opt.color === "destructive" && "bg-destructive/10 text-destructive",
                          opt.color === "info" && "bg-info/10 text-info",
                          opt.color === "primary" && "bg-primary/10 text-primary",
                          opt.color === "warning" && "bg-warning/10 text-warning",
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-bold leading-tight">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {wizardStep === 2 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold mb-1">Cuéntanos los detalles</h3>
                  <p className="text-xs text-muted-foreground">Mientras más claro, más rápido te ayudamos</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold flex items-center gap-1.5">
                    Título <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                    placeholder="Resume tu solicitud en una línea"
                    className="h-11 text-sm"
                    maxLength={120}
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{requestTitle.length}/120</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Producto o módulo afectado</label>
                  <Input
                    value={requestProduct}
                    onChange={(e) => setRequestProduct(e.target.value)}
                    placeholder="Ej: Cartera, Contabilidad, Facturación..."
                    className="h-11 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold flex items-center gap-1.5">
                    Descripción <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    value={requestText}
                    onChange={(e) => setRequestText(e.target.value)}
                    placeholder="¿Qué pasó? ¿Cómo se reproduce? ¿Qué esperabas que sucediera?"
                    rows={5}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold">Nivel de urgencia</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "Baja", label: "Baja", desc: "Sin urgencia", color: "muted" },
                      { v: "Media", label: "Media", desc: "Normal", color: "info" },
                      { v: "Alta", label: "Alta", desc: "Importante", color: "warning" },
                      { v: "Critica, Impacto Negocio", label: "Crítica", desc: "Detiene operación", color: "destructive" },
                    ].map((p) => {
                      const selected = requestPriority === p.v;
                      return (
                        <button
                          key={p.v}
                          onClick={() => setRequestPriority(p.v)}
                          className={cn(
                            "text-left p-2.5 rounded-lg border-2 transition-all",
                            selected
                              ? p.color === "destructive" ? "border-destructive bg-destructive/5"
                                : p.color === "warning" ? "border-warning bg-warning/5"
                                : p.color === "info" ? "border-info bg-info/5"
                                : "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold">{p.label}</p>
                            {selected && <CheckCheck className="h-3.5 w-3.5 text-primary" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {wizardStep === 3 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold mb-1">Revisa tu solicitud</h3>
                  <p className="text-xs text-muted-foreground">Confirma que todo esté correcto antes de enviar</p>
                </div>

                <Card className="border-2 border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 pb-3 border-b">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Título</p>
                        <p className="text-sm font-bold leading-tight">{requestTitle || "(sin título)"}</p>
                      </div>
                      <Badge className={cn("text-[9px] shrink-0", PRIORITY_STYLES[requestPriority])}>
                        {requestPriority === "Critica, Impacto Negocio" ? "Crítica" : requestPriority}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Tipo</p>
                        <p className="font-semibold">{requestCategory}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Producto</p>
                        <p className="font-semibold">{requestProduct || "General"}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-1">Descripción</p>
                      <p className="text-xs leading-relaxed bg-muted/40 rounded-lg p-2.5 whitespace-pre-wrap">
                        {requestText}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-info/5 border border-info/20 rounded-lg p-3 flex gap-2.5">
                  <Sparkles className="h-4 w-4 text-info shrink-0 mt-0.5" />
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    Recibirás una notificación cuando el equipo Sysde clasifique y asigne tu solicitud.
                    Tiempo estimado de respuesta:{" "}
                    <span className="font-semibold text-foreground">
                      {requestPriority.includes("Critica") ? "menos de 2h" : requestPriority === "Alta" ? "4-8h" : "24-48h"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t px-5 py-3 flex gap-2">
            {wizardStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setWizardStep(wizardStep - 1)}
                disabled={submitting}
                className="h-11"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
            )}
            {wizardStep < 3 ? (
              <Button
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={
                  (wizardStep === 1 && !requestCategory) ||
                  (wizardStep === 2 && (!requestTitle.trim() || !requestText.trim()))
                }
                className="flex-1 h-11 font-semibold"
              >
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmitRequest} disabled={submitting} className="flex-1 h-11 font-semibold">
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Enviar solicitud</>
                )}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "warning" | "destructive" | "info" }) {
  const colorClass = tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-info";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={cn("h-3.5 w-3.5", colorClass)} />
          <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="text-xl font-black tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
