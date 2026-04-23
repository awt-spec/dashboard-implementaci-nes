import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Save, AlertTriangle, Sun, Coffee, Loader2, Calendar as CalIcon, CheckCircle2, Clock, TrendingUp, Smile } from "lucide-react";
import { toast } from "sonner";
import { useAllSprints, useAllScrumWorkItems } from "@/hooks/useTeamScrum";
import { useSprintDailies, useUpsertDaily } from "@/hooks/useSprintCeremonies";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { Building2 } from "lucide-react";

const MOODS = ["😞", "😐", "🙂", "😊", "🤩"];
const MOOD_LABELS = ["Muy mal", "Regular", "Ok", "Bien", "Genial"];

const initials = (n: string) => n.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

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

  const sprintMembers = useMemo(() => {
    const set = new Set<string>();
    items.filter(i => i.sprint_id === sprintId).forEach(i => i.owner && i.owner !== "—" && set.add(i.owner));
    if (me) set.add(me);
    return Array.from(set).sort();
  }, [items, sprintId, me]);

  const todayDailies = dailies.filter(d => d.date === today);
  const myDaily = todayDailies.find(d => d.member_name === me);

  const [form, setForm] = useState({ yesterday: "", today: "", blockers: "", mood: 3 });

  useEffect(() => {
    if (myDaily) {
      setForm({
        yesterday: myDaily.yesterday || "",
        today: myDaily.today || "",
        blockers: myDaily.blockers || "",
        mood: myDaily.mood || 3,
      });
    }
  }, [myDaily?.id]);

  const reported = todayDailies.length;
  const pending = sprintMembers.filter(m => !todayDailies.find(d => d.member_name === m));
  const blockers = todayDailies.filter(d => d.blockers && d.blockers.trim().length > 0);
  const avgMood = reported > 0 ? todayDailies.reduce((s, d) => s + (d.mood || 3), 0) / reported : 0;
  const reportPct = sprintMembers.length > 0 ? Math.round((reported / sprintMembers.length) * 100) : 0;

  // Trend: average mood last 7 days
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
      toast.success("Daily registrado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (activeSprints.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        No hay sprints activos. Inicia un sprint en la pestaña Gestión para usar Daily Standup.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-warning" />
          <div>
            <h3 className="text-base font-bold leading-tight">Daily Standup</h3>
            <p className="text-[11px] text-muted-foreground capitalize">
              {new Date(today).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
        <Select value={sprintId} onValueChange={setSprintId}>
          <SelectTrigger className="w-[280px] h-9 text-xs">
            <SelectValue placeholder="Seleccionar sprint" />
          </SelectTrigger>
          <SelectContent>
            {activeSprints.map(s => {
              const cn = clientMap.get(s.client_id) || s.client_id;
              return (
                <SelectItem key={s.id} value={s.id}>
                  <span className="font-semibold">{cn}</span>
                  <span className="text-muted-foreground ml-2 text-[10px]">· {s.name}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Contexto del sprint actual */}
      {sprint && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{sprintClient}</p>
                <p className="text-[11px] text-muted-foreground truncate">{sprint.name}{sprint.goal && ` · ${sprint.goal}`}</p>
              </div>
            </div>
            {sprintDaysLeft !== null && (
              <Badge className={
                sprintDaysLeft < 0 ? "ml-auto bg-destructive/15 text-destructive border-destructive/30" :
                sprintDaysLeft <= 2 ? "ml-auto bg-warning/15 text-warning border-warning/30" :
                "ml-auto bg-success/15 text-success border-success/30"
              }>
                {sprintDaysLeft < 0 ? `Vencido hace ${Math.abs(sprintDaysLeft)}d` :
                 sprintDaysLeft === 0 ? "Último día" :
                 `${sprintDaysLeft} días restantes`}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="border-info/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Reportaron</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-info" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold">{reported}</span>
              <span className="text-xs text-muted-foreground">/ {sprintMembers.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
              <motion.div className="h-full bg-info" initial={{ width: 0 }} animate={{ width: `${reportPct}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className={pending.length > 0 ? "border-warning/30" : "border-success/30"}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Pendientes</span>
              <Clock className={`h-3.5 w-3.5 ${pending.length > 0 ? "text-warning" : "text-success"}`} />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold">{pending.length}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
              {pending.length === 0 ? "✅ Equipo completo" : pending.slice(0, 2).join(", ") + (pending.length > 2 ? "…" : "")}
            </p>
          </CardContent>
        </Card>

        <Card className={blockers.length > 0 ? "border-destructive/40" : "border-border"}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Bloqueos</span>
              <AlertTriangle className={`h-3.5 w-3.5 ${blockers.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-bold ${blockers.length > 0 ? "text-destructive" : ""}`}>{blockers.length}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {blockers.length === 0 ? "Sin impedimentos" : "Requieren atención"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Mood equipo</span>
              <Smile className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl">{avgMood > 0 ? MOODS[Math.round(avgMood) - 1] : "–"}</span>
              <span className="text-xs font-bold">{avgMood > 0 ? avgMood.toFixed(1) : "–"}</span>
            </div>
            <div className="flex items-end gap-0.5 mt-1.5 h-4">
              {last7.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/30 rounded-sm"
                  style={{ height: d.mood > 0 ? `${(d.mood / 5) * 100}%` : "10%" }}
                  title={`${d.date}: ${d.mood > 0 ? d.mood.toFixed(1) : "–"}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My check-in */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.02] to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-2">
            <Coffee className="h-3.5 w-3.5 text-primary" />
            Mi check-in {myDaily && <Badge variant="outline" className="text-[9px] h-4 bg-success/10 text-success border-success/30">Ya registrado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-success flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Ayer completé
              </label>
              <Textarea
                rows={3}
                value={form.yesterday}
                onChange={e => setForm(f => ({ ...f, yesterday: e.target.value }))}
                className="text-xs mt-1 resize-none"
                placeholder="Ej: Cerré 2 tickets de AFPC, code review del PR #23, sesión con cliente por integración."
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-info flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Hoy voy a
              </label>
              <Textarea
                rows={3}
                value={form.today}
                onChange={e => setForm(f => ({ ...f, today: e.target.value }))}
                className="text-xs mt-1 resize-none"
                placeholder="Ej: Avanzar ticket SPRME-68, daily con cliente, cerrar validación del módulo de pensión."
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Necesito ayuda con
              </label>
              <Textarea
                rows={3}
                value={form.blockers}
                onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))}
                className="text-xs mt-1 resize-none"
                placeholder="Ej: Espero credenciales de AFPC desde el jueves, o bloqueado por falta de specs."
              />
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">¿Cómo te sentís?</span>
              {MOODS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setForm(f => ({ ...f, mood: i + 1 }))}
                  title={MOOD_LABELS[i]}
                  className={`text-xl transition-all ${form.mood === i + 1 ? "scale-125 -translate-y-0.5" : "opacity-40 hover:opacity-70 hover:scale-110"}`}
                >{emoji}</button>
              ))}
            </div>
            <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Guardar check-in
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blockers spotlight */}
      {blockers.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Bloqueos activos hoy ({blockers.length}) — requieren atención
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {blockers.map(d => (
              <div key={d.id} className="text-xs p-2.5 rounded-lg bg-card border border-destructive/30 flex items-start gap-2">
                <Avatar className="h-7 w-7 border border-destructive/30 shrink-0">
                  <AvatarFallback className="bg-destructive/10 text-destructive text-[10px] font-bold">{initials(d.member_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold truncate">{d.member_name}</span>
                    <span className="text-base">{MOODS[d.mood - 1]}</span>
                  </div>
                  <p className="text-muted-foreground leading-snug">{d.blockers}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5"><CalIcon className="h-3.5 w-3.5" />Timeline del equipo</span>
            <span className="text-[10px] text-muted-foreground font-normal">{reported}/{sprintMembers.length} reportaron</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sprintMembers.map(member => {
            const d = todayDailies.find(x => x.member_name === member);
            const hasBlocker = !!(d?.blockers && d.blockers.trim().length > 0);
            return (
              <motion.div
                key={member}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition ${
                  hasBlocker ? "border-destructive/30 bg-destructive/[0.04]" :
                  d ? "border-success/30 bg-success/[0.03]" :
                  "border-warning/30 bg-warning/[0.03]"
                }`}
              >
                <Avatar className="h-9 w-9 border border-border shrink-0">
                  <AvatarFallback className={`text-[11px] font-bold ${
                    hasBlocker ? "bg-destructive/10 text-destructive" :
                    d ? "bg-success/10 text-success" :
                    "bg-warning/10 text-warning"
                  }`}>{initials(member)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="font-bold text-xs truncate">{member}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {d ? (
                        <>
                          <span className="text-base leading-none" title={MOOD_LABELS[d.mood - 1]}>{MOODS[d.mood - 1]}</span>
                          <Badge variant="outline" className="text-[9px] h-4 bg-success/10 text-success border-success/30">Listo</Badge>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 text-warning border-warning/30">Pendiente</Badge>
                      )}
                    </div>
                  </div>
                  {d ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                      {d.yesterday && <p><span className="font-semibold text-muted-foreground">Ayer:</span> <span className="text-foreground/80">{d.yesterday}</span></p>}
                      {d.today && <p><span className="font-semibold text-info">Hoy:</span> <span className="text-foreground/80">{d.today}</span></p>}
                      {hasBlocker && <p className="md:col-span-2 text-destructive"><span className="font-semibold">⚠ Bloqueo:</span> {d.blockers}</p>}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">Sin reporte aún</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
