import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, AlertTriangle, Sun, Coffee, Loader2, Calendar as CalIcon, CheckCircle2,
  Clock, TrendingUp, Smile, Sparkles, ArrowRight, ArrowLeft, Edit3, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useAllSprints, useAllScrumWorkItems } from "@/hooks/useTeamScrum";
import { useSprintDailies, useUpsertDaily } from "@/hooks/useSprintCeremonies";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { cn } from "@/lib/utils";

// ─── Constantes ──────────────────────────────────────────────────────

const MOODS = ["😞", "😐", "🙂", "😊", "🤩"];
const MOOD_LABELS = ["Muy mal", "Regular", "Ok", "Bien", "Genial"];
const MOOD_COLORS = [
  "text-destructive",
  "text-warning",
  "text-info",
  "text-success",
  "text-success",
];

const initials = (n: string) => n.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

// ─── Componente principal ────────────────────────────────────────────

export function DailyStandupPanel() {
  const { data: sprints = [] } = useAllSprints();
  const { data: items = [] } = useAllScrumWorkItems();
  const { data: clients = [] } = useClients();
  const { profile } = useAuth();

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    (clients as any[]).forEach(c => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const activeSprints = sprints.filter(s => s.status === "activo");
  const [sprintId, setSprintId] = useState<string>(activeSprints[0]?.id || "");
  const sprint = sprints.find(s => s.id === sprintId);
  const sprintClient = sprint ? (clientMap.get(sprint.client_id) || sprint.client_id) : "";

  const sprintDaysLeft = useMemo(() => {
    if (!sprint?.end_date) return null;
    return Math.ceil((new Date(sprint.end_date).getTime() - Date.now()) / 86400000);
  }, [sprint]);

  const { data: dailies = [] } = useSprintDailies(sprintId);
  const upsert = useUpsertDaily();

  const today = new Date().toISOString().slice(0, 10);
  const me = profile?.full_name || "Sin nombre";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();
  const firstName = (me || "").split(" ")[0];

  const sprintMembers = useMemo(() => {
    const set = new Set<string>();
    items.filter(i => i.sprint_id === sprintId).forEach(i => i.owner && i.owner !== "—" && set.add(i.owner));
    if (me) set.add(me);
    return Array.from(set).sort();
  }, [items, sprintId, me]);

  const todayDailies = dailies.filter(d => d.date === today);
  const myDaily = todayDailies.find(d => d.member_name === me);

  // ─── Estado del check-in (stepper) ──
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0 = mood, 1 = ayer, 2 = hoy, 3 = bloqueos
  const [editing, setEditing] = useState(false); // cuando hay myDaily, mostramos resumen; click "Editar" abre stepper
  const [form, setForm] = useState({ yesterday: "", today: "", blockers: "", mood: 0 });

  useEffect(() => {
    if (myDaily) {
      setForm({
        yesterday: myDaily.yesterday || "",
        today: myDaily.today || "",
        blockers: myDaily.blockers || "",
        mood: myDaily.mood || 0,
      });
      setEditing(false);
    } else {
      setForm({ yesterday: "", today: "", blockers: "", mood: 0 });
      setStep(0);
      setEditing(true);
    }
  }, [myDaily?.id]);

  const reported = todayDailies.length;
  const pending = sprintMembers.filter(m => !todayDailies.find(d => d.member_name === m));
  const blockers = todayDailies.filter(d => d.blockers && d.blockers.trim().length > 0);
  const avgMood = reported > 0 ? todayDailies.reduce((s, d) => s + (d.mood || 3), 0) / reported : 0;
  const reportPct = sprintMembers.length > 0 ? Math.round((reported / sprintMembers.length) * 100) : 0;

  // Sparkline del mood últimos 7 días
  const last7 = useMemo(() => {
    const days: { date: string; mood: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const ds = dailies.filter(x => x.date === d);
      const m = ds.length > 0 ? ds.reduce((s, x) => s + (x.mood || 3), 0) / ds.length : 0;
      days.push({ date: d, mood: m, count: ds.length });
    }
    return days;
  }, [dailies]);

  const handleSave = async () => {
    if (!sprintId) return toast.error("Selecciona un sprint activo");
    if (form.mood === 0) return toast.error("Elegí cómo te sentís hoy");
    try {
      await upsert.mutateAsync({
        sprint_id: sprintId,
        member_name: me,
        date: today,
        yesterday: form.yesterday,
        today: form.today,
        blockers: form.blockers,
        mood: form.mood,
      });
      toast.success("Check-in guardado · ¡buen día! 👋");
      setEditing(false);
      setStep(0);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ─── Empty: sin sprints activos ──
  if (activeSprints.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
            <Sun className="h-7 w-7 text-warning" />
          </div>
          <div>
            <p className="text-base font-bold">No hay sprints activos</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              El daily standup necesita un sprint activo para coordinar al equipo. Iniciá uno desde "Gestión de sprints".
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ════════════ HEADER + STATUS UNIFICADO ════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Sun className="h-4 w-4 text-amber-500" />
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                  Daily standup · {new Date(today).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <h2 className="text-2xl font-black leading-tight">
                {greeting}{firstName ? `, ${firstName}` : ""}.
              </h2>
              {sprint && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">{sprintClient}</span>
                  <span className="text-xs text-muted-foreground">· {sprint.name}</span>
                  {sprint.goal && <span className="text-xs text-muted-foreground italic truncate max-w-[280px]">· 🎯 {sprint.goal}</span>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {sprintDaysLeft !== null && (
                <Badge variant="outline" className={cn(
                  "h-7 text-xs",
                  sprintDaysLeft < 0 ? "bg-destructive/10 text-destructive border-destructive/30" :
                  sprintDaysLeft <= 2 ? "bg-warning/10 text-warning border-warning/30" :
                  "bg-success/10 text-success border-success/30"
                )}>
                  {sprintDaysLeft < 0 ? `Vencido hace ${Math.abs(sprintDaysLeft)}d` :
                   sprintDaysLeft === 0 ? "Último día" :
                   `${sprintDaysLeft}d restantes`}
                </Badge>
              )}
              <Select value={sprintId} onValueChange={setSprintId}>
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <SelectValue placeholder="Cambiar sprint" />
                </SelectTrigger>
                <SelectContent>
                  {activeSprints.map(s => {
                    const cn2 = clientMap.get(s.client_id) || s.client_id;
                    return (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        <span className="font-semibold">{cn2}</span>
                        <span className="text-muted-foreground ml-2">· {s.name}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats compactos inline */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border/60">
            <StatTile
              label="Tu check-in"
              value={myDaily ? "✓ Listo" : "Pendiente"}
              tone={myDaily ? "text-success" : "text-warning"}
              hint={myDaily ? `${MOODS[myDaily.mood - 1]} ${MOOD_LABELS[myDaily.mood - 1]}` : "Hacelo abajo"}
            />
            <StatTile
              label="Reportaron"
              value={`${reported}/${sprintMembers.length}`}
              tone="text-info"
              hint={`${reportPct}% del equipo`}
              progress={reportPct}
            />
            <StatTile
              label="Bloqueos"
              value={blockers.length}
              tone={blockers.length > 0 ? "text-destructive" : "text-muted-foreground"}
              hint={blockers.length === 0 ? "Sin impedimentos" : "Requieren atención"}
            />
            <StatTile
              label="Mood equipo"
              value={avgMood > 0 ? <span className="flex items-baseline gap-1.5"><span className="text-2xl">{MOODS[Math.round(avgMood) - 1]}</span><span>{avgMood.toFixed(1)}</span></span> : "—"}
              tone="text-foreground"
              sparkline={last7}
            />
          </div>
        </div>
      </div>

      {/* ════════════ BLOQUEOS PROMINENTES ════════════ */}
      {blockers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-bold text-destructive">Bloqueos activos hoy</p>
            <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5">{blockers.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {blockers.map(d => (
              <div key={d.id} className="flex items-start gap-2 p-3 rounded-lg bg-card border border-destructive/20">
                <Avatar className="h-8 w-8 border border-destructive/30 shrink-0">
                  <AvatarFallback className="bg-destructive/10 text-destructive text-[10px] font-bold">{initials(d.member_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-xs font-bold truncate">{d.member_name}</p>
                    <span className="text-base shrink-0">{MOODS[d.mood - 1]}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{d.blockers}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ════════════ MI CHECK-IN — STEPPER GUIADO ════════════ */}
      <Card className={cn(
        "border-2 transition-colors",
        editing ? "border-primary/40" : "border-success/30 bg-success/[0.03]"
      )}>
        <CardContent className="p-5">
          {/* Modo: ya registrado y no editando → resumen */}
          {!editing && myDaily ? (
            <div>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Tu check-in está listo</p>
                    <p className="text-[11px] text-muted-foreground">
                      Sentimiento: <span className="text-base align-middle">{MOODS[myDaily.mood - 1]}</span> {MOOD_LABELS[myDaily.mood - 1]}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5 text-xs h-8">
                  <Edit3 className="h-3.5 w-3.5" /> Editar
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <SummaryItem label="Ayer hice" Icon={CheckCircle2} tone="text-success" content={myDaily.yesterday || "—"} />
                <SummaryItem label="Hoy voy a" Icon={TrendingUp} tone="text-info" content={myDaily.today || "—"} />
                <SummaryItem label="Necesito ayuda" Icon={AlertTriangle} tone="text-destructive" content={myDaily.blockers || "Nada por ahora 🙌"} empty={!myDaily.blockers} />
              </div>
            </div>
          ) : (
            // Modo edición — stepper
            <div>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold">Tu check-in del día</p>
                </div>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/60" : "w-4 bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {/* STEP 0: Mood */}
                {step === 0 && (
                  <motion.div
                    key="mood"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="text-center py-6"
                  >
                    <p className="text-base font-bold mb-1">¿Cómo te sentís hoy?</p>
                    <p className="text-xs text-muted-foreground mb-4">Tu energía influye en cómo planificamos el día.</p>
                    <div className="flex items-center justify-center gap-3">
                      {MOODS.map((emoji, i) => (
                        <motion.button
                          key={i}
                          onClick={() => setForm(f => ({ ...f, mood: i + 1 }))}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all",
                            form.mood === i + 1
                              ? "border-primary bg-primary/10 scale-110 shadow-lg"
                              : "border-border bg-card hover:border-primary/40"
                          )}
                        >
                          <span className="text-3xl">{emoji}</span>
                        </motion.button>
                      ))}
                    </div>
                    {form.mood > 0 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn("text-xs font-semibold mt-3", MOOD_COLORS[form.mood - 1])}
                      >
                        {MOOD_LABELS[form.mood - 1]}
                      </motion.p>
                    )}
                  </motion.div>
                )}

                {/* STEP 1: Ayer */}
                {step === 1 && (
                  <motion.div
                    key="ayer"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">¿Qué hiciste ayer?</p>
                        <p className="text-[11px] text-muted-foreground">Lo importante, no exhaustivo.</p>
                      </div>
                    </div>
                    <Textarea
                      autoFocus
                      rows={4}
                      value={form.yesterday}
                      onChange={e => setForm(f => ({ ...f, yesterday: e.target.value }))}
                      placeholder="Ej: Cerré 2 tickets de AFPC, code review del PR #23, sesión con cliente."
                      className="text-sm resize-none"
                    />
                  </motion.div>
                )}

                {/* STEP 2: Hoy */}
                {step === 2 && (
                  <motion.div
                    key="hoy"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-info" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">¿Qué vas a hacer hoy?</p>
                        <p className="text-[11px] text-muted-foreground">2-3 cosas concretas.</p>
                      </div>
                    </div>
                    <Textarea
                      autoFocus
                      rows={4}
                      value={form.today}
                      onChange={e => setForm(f => ({ ...f, today: e.target.value }))}
                      placeholder="Ej: Avanzar ticket SPRME-68, daily con cliente, cerrar validación del módulo de pensión."
                      className="text-sm resize-none"
                    />
                  </motion.div>
                )}

                {/* STEP 3: Bloqueos */}
                {step === 3 && (
                  <motion.div
                    key="blockers"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">¿Necesitás ayuda con algo?</p>
                        <p className="text-[11px] text-muted-foreground">Opcional · Decirlo temprano destraba más rápido.</p>
                      </div>
                    </div>
                    <Textarea
                      autoFocus
                      rows={4}
                      value={form.blockers}
                      onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))}
                      placeholder="Ej: Espero credenciales de AFPC desde el jueves, o bloqueado por falta de specs."
                      className="text-sm resize-none"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Nav */}
              <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-border/60">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStep((s) => (s > 0 ? ((s - 1) as any) : s))}
                  disabled={step === 0}
                  className="gap-1.5 text-xs h-8"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Atrás
                </Button>
                <p className="text-[10px] text-muted-foreground">{step + 1} / 4</p>
                {step < 3 ? (
                  <Button
                    size="sm"
                    onClick={() => setStep((s) => ((s + 1) as any))}
                    disabled={step === 0 && form.mood === 0}
                    className="gap-1.5 text-xs h-8"
                  >
                    Siguiente <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={upsert.isPending || form.mood === 0}
                    className="gap-1.5 text-xs h-8"
                  >
                    {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Guardar check-in
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ════════════ EQUIPO HOY ════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-primary" />
              Equipo hoy
            </span>
            <span className="text-[11px] text-muted-foreground font-normal">
              {reported} de {sprintMembers.length} reportaron
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sprintMembers.map(member => {
              const d = todayDailies.find(x => x.member_name === member);
              const hasBlocker = !!(d?.blockers && d.blockers.trim().length > 0);
              return (
                <motion.div
                  key={member}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border transition",
                    hasBlocker ? "border-destructive/40 bg-destructive/[0.04]" :
                    d ? "border-success/30 bg-success/[0.03]" :
                    "border-border bg-muted/20"
                  )}
                >
                  <Avatar className="h-10 w-10 border border-border shrink-0">
                    <AvatarFallback className={cn(
                      "text-xs font-bold",
                      hasBlocker ? "bg-destructive/10 text-destructive" :
                      d ? "bg-success/10 text-success" :
                      "bg-muted text-muted-foreground"
                    )}>{initials(member)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-bold truncate">{member}</p>
                      {d ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-base leading-none" title={MOOD_LABELS[d.mood - 1]}>{MOODS[d.mood - 1]}</span>
                          {hasBlocker ? (
                            <Badge variant="outline" className="text-[9px] h-4 bg-destructive/10 text-destructive border-destructive/30">Bloqueo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] h-4 bg-success/10 text-success border-success/30">Listo</Badge>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 text-muted-foreground border-border shrink-0">Pendiente</Badge>
                      )}
                    </div>
                    {d ? (
                      <div className="text-[11px] space-y-0.5">
                        {d.today && (
                          <p className="line-clamp-1">
                            <span className="font-semibold text-info">Hoy:</span>{" "}
                            <span className="text-foreground/80">{d.today}</span>
                          </p>
                        )}
                        {hasBlocker && (
                          <p className="line-clamp-1 text-destructive">
                            <span className="font-semibold">⚠ Bloqueo:</span> {d.blockers}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">Sin reporte aún</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function StatTile({ label, value, tone = "text-foreground", hint, progress, sparkline }: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  hint?: string;
  progress?: number;
  sparkline?: { mood: number }[];
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <div className={cn("text-2xl font-black tabular-nums leading-tight mt-0.5", tone)}>{value}</div>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      {progress !== undefined && (
        <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
          <motion.div className="h-full bg-info" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="flex items-end gap-0.5 mt-1 h-3">
          {sparkline.map((d, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/30 rounded-sm"
              style={{ height: d.mood > 0 ? `${(d.mood / 5) * 100}%` : "10%" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, Icon, tone, content, empty }: {
  label: string;
  Icon: any;
  tone: string;
  content: string;
  empty?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-card/60 border border-border">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("h-3 w-3", tone)} />
        <p className={cn("text-[10px] uppercase tracking-wide font-bold", tone)}>{label}</p>
      </div>
      <p className={cn("text-[11px] leading-snug", empty ? "text-muted-foreground italic" : "text-foreground/90")}>
        {content}
      </p>
    </div>
  );
}
