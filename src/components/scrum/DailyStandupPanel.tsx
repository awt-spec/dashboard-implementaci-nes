import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Save, AlertTriangle, Sun, Coffee, Loader2, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";
import { useAllSprints, useAllScrumWorkItems } from "@/hooks/useTeamScrum";
import { useSprintDailies, useUpsertDaily } from "@/hooks/useSprintCeremonies";
import { useAuth } from "@/hooks/useAuth";

const MOODS = ["😞", "😐", "🙂", "😊", "🤩"];

export function DailyStandupPanel() {
  const { data: sprints = [] } = useAllSprints();
  const { data: items = [] } = useAllScrumWorkItems();
  const { profile } = useAuth();

  const activeSprints = sprints.filter(s => s.status === "activo");
  const [sprintId, setSprintId] = useState<string>(activeSprints[0]?.id || "");
  const sprint = sprints.find(s => s.id === sprintId);
  const { data: dailies = [] } = useSprintDailies(sprintId);
  const upsert = useUpsertDaily();

  const today = new Date().toISOString().slice(0, 10);
  const me = profile?.full_name || "Sin nombre";

  // Members in the sprint
  const sprintMembers = useMemo(() => {
    const set = new Set<string>();
    items.filter(i => i.sprint_id === sprintId).forEach(i => i.owner && i.owner !== "—" && set.add(i.owner));
    if (me) set.add(me);
    return Array.from(set).sort();
  }, [items, sprintId, me]);

  const todayDailies = dailies.filter(d => d.date === today);
  const myDaily = todayDailies.find(d => d.member_name === me);

  const [form, setForm] = useState({
    yesterday: "",
    today: "",
    blockers: "",
    mood: 3,
  });

  // Reset form when myDaily loads
  useMemo(() => {
    if (myDaily) {
      setForm({
        yesterday: myDaily.yesterday || "",
        today: myDaily.today || "",
        blockers: myDaily.blockers || "",
        mood: myDaily.mood || 3,
      });
    }
  }, [myDaily?.id]);

  const missingMembers = sprintMembers.filter(m => !todayDailies.find(d => d.member_name === m));
  const blockers = todayDailies.filter(d => d.blockers && d.blockers.trim().length > 0);

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-bold">Daily Standup — {today}</h3>
        </div>
        <Select value={sprintId} onValueChange={setSprintId}>
          <SelectTrigger className="w-[260px] h-8 text-xs"><SelectValue placeholder="Sprint" /></SelectTrigger>
          <SelectContent>
            {activeSprints.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* My daily form */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-2">
            <Coffee className="h-3.5 w-3.5 text-primary" />
            Mi check-in de hoy {myDaily && <Badge variant="outline" className="text-[9px] h-4 bg-success/10 text-success border-success/30">Ya registrado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Ayer hice</label>
              <Textarea rows={3} value={form.yesterday} onChange={e => setForm(f => ({ ...f, yesterday: e.target.value }))} className="text-xs" placeholder="Cerré ticket #123, code review…" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Hoy haré</label>
              <Textarea rows={3} value={form.today} onChange={e => setForm(f => ({ ...f, today: e.target.value }))} className="text-xs" placeholder="Implementar feature X, refactorizar…" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Bloqueos</label>
              <Textarea rows={3} value={form.blockers} onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))} className="text-xs" placeholder="Espero info de cliente…" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground">Mood:</span>
              {MOODS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setForm(f => ({ ...f, mood: i + 1 }))}
                  className={`text-lg transition ${form.mood === i + 1 ? "scale-125" : "opacity-40 hover:opacity-70"}`}
                >{emoji}</button>
              ))}
            </div>
            <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blockers panel */}
      {blockers.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Bloqueos activos hoy ({blockers.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {blockers.map(d => (
              <div key={d.id} className="text-xs p-2 rounded bg-card border border-destructive/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{d.member_name}</span>
                  <span className="text-lg">{MOODS[d.mood - 1]}</span>
                </div>
                <p className="text-muted-foreground">{d.blockers}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team status today */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5"><CalIcon className="h-3.5 w-3.5" />Estado del equipo hoy</span>
            <span className="text-[10px] text-muted-foreground font-normal">
              {todayDailies.length}/{sprintMembers.length} reportaron
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {sprintMembers.map(member => {
            const d = todayDailies.find(x => x.member_name === member);
            return (
              <motion.div
                key={member}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`p-2 rounded border text-xs ${d ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold truncate">{member}</span>
                  {d ? <span className="text-base">{MOODS[d.mood - 1]}</span> : <Badge variant="outline" className="text-[9px] h-4 text-warning">Pendiente</Badge>}
                </div>
                {d && (
                  <div className="space-y-0.5 text-[10px]">
                    {d.today && <p><span className="font-semibold">Hoy:</span> <span className="text-muted-foreground">{d.today}</span></p>}
                    {d.blockers && <p className="text-destructive"><span className="font-semibold">⚠</span> {d.blockers}</p>}
                  </div>
                )}
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* Missing alert */}
      {missingMembers.length > 0 && (
        <p className="text-[11px] text-muted-foreground italic text-center">
          Faltan: {missingMembers.join(", ")}
        </p>
      )}
    </div>
  );
}
