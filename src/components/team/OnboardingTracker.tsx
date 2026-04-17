import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Rocket, Plus, CheckCircle2, Clock, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useAllOnboarding, useUpsertOnboarding } from "@/hooks/useTeamSkills";

const DEFAULT_CHECKLIST = [
  { id: "1", title: "Setup de cuentas y accesos", done: false },
  { id: "2", title: "Inducción a la metodología SYSDE", done: false },
  { id: "3", title: "Capacitación inicial en producto/cliente", done: false },
  { id: "4", title: "Asignación de buddy/mentor", done: false },
  { id: "5", title: "Primera tarea asignada", done: false },
  { id: "6", title: "Revisión 30 días", done: false },
  { id: "7", title: "Revisión 60 días", done: false },
  { id: "8", title: "Cierre onboarding (90 días)", done: false },
];

const initials = (name: string) => name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

export function OnboardingTracker() {
  const { data: members = [] } = useSysdeTeamMembers();
  const { data: onboardings = [] } = useAllOnboarding();
  const upsert = useUpsertOnboarding();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [buddyId, setBuddyId] = useState("");

  const handleStart = () => {
    if (!memberId) return;
    upsert.mutate(
      { member_id: memberId, status: "in_progress", buddy_member_id: buddyId || null, checklist: DEFAULT_CHECKLIST as any, progress_pct: 0, start_date: new Date().toISOString().slice(0, 10) },
      { onSuccess: () => { toast.success("Onboarding iniciado"); setOpen(false); setMemberId(""); setBuddyId(""); } }
    );
  };

  const toggleItem = (rec: any, itemId: string) => {
    const updated = (rec.checklist || []).map((c: any) => c.id === itemId ? { ...c, done: !c.done } : c);
    const pct = Math.round((updated.filter((c: any) => c.done).length / Math.max(updated.length, 1)) * 100);
    const status = pct === 100 ? "completed" : "in_progress";
    upsert.mutate({ member_id: rec.member_id, checklist: updated, progress_pct: pct, status, completed_date: pct === 100 ? new Date().toISOString().slice(0, 10) : null });
  };

  const inProgress = onboardings.filter(o => o.status !== "completed");
  const completed = onboardings.filter(o => o.status === "completed");
  const memberMap = Object.fromEntries(members.map((m: any) => [m.id, m]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-base font-bold">Onboarding Tracker</h3>
            <p className="text-xs text-muted-foreground">Seguimiento de incorporación de nuevos colaboradores</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Iniciar Onboarding</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Iniciar onboarding</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Nuevo colaborador</label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona miembro" /></SelectTrigger>
                  <SelectContent>
                    {members.filter((m: any) => !onboardings.some(o => o.member_id === m.id)).map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Buddy / Mentor</label>
                <Select value={buddyId} onValueChange={setBuddyId}>
                  <SelectTrigger><SelectValue placeholder="(Opcional)" /></SelectTrigger>
                  <SelectContent>
                    {members.filter((m: any) => m.id !== memberId && m.is_active).map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleStart} disabled={!memberId || upsert.isPending} className="w-full">Iniciar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">En proceso</div>
          <div className="text-2xl font-bold text-amber-500">{inProgress.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Completados</div>
          <div className="text-2xl font-bold text-emerald-500">{completed.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Avg. progreso</div>
          <div className="text-2xl font-bold">
            {inProgress.length > 0 ? Math.round(inProgress.reduce((s, o) => s + o.progress_pct, 0) / inProgress.length) : 0}%
          </div>
        </Card>
      </div>

      {inProgress.length === 0 && completed.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No hay procesos de onboarding activos. Inicia uno para hacer seguimiento del nuevo talento.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...inProgress, ...completed].map(rec => {
            const member = memberMap[rec.member_id];
            const buddy = rec.buddy_member_id ? memberMap[rec.buddy_member_id] : null;
            if (!member) return null;
            return (
              <Card key={rec.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-9 w-9 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-sm">{member.name}</CardTitle>
                        <div className="text-[10px] text-muted-foreground">{member.role}</div>
                      </div>
                    </div>
                    <Badge className={rec.status === "completed" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" : "bg-amber-500/15 text-amber-500 border-amber-500/30"}>
                      {rec.status === "completed" ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Completo</> : <><Clock className="h-3 w-3 mr-1" /> En curso</>}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-bold">{rec.progress_pct}%</span>
                    </div>
                    <Progress value={rec.progress_pct} className="h-2" />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {rec.start_date}</div>
                    {buddy && <div className="flex items-center gap-1"><Users className="h-3 w-3" /> Buddy: {buddy.name}</div>}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pt-1">
                    {(rec.checklist || []).map((c: any) => (
                      <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-1.5 py-1">
                        <input type="checkbox" checked={c.done} onChange={() => toggleItem(rec, c.id)} />
                        <span className={c.done ? "line-through text-muted-foreground" : ""}>{c.title}</span>
                      </label>
                    ))}
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
