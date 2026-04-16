import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Layers, Target, Save } from "lucide-react";
import { toast } from "sonner";
import { useSprints, useUpdateTicketScrum, wsjf } from "@/hooks/useScrum";
import type { SupportTicket } from "@/hooks/useSupportTickets";

const SCRUM_STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  ready: "Listo",
  in_sprint: "En Sprint",
  in_progress: "En Progreso",
  done: "Hecho",
};

interface Props {
  ticket: SupportTicket;
}

export function SupportCaseScrumSection({ ticket }: Props) {
  const t: any = ticket;
  const { data: sprints = [] } = useSprints(ticket.client_id);
  const update = useUpdateTicketScrum();

  const [sprintId, setSprintId] = useState<string>(t.sprint_id || "__none__");
  const [storyPoints, setStoryPoints] = useState<string>(t.story_points?.toString() || "");
  const [businessValue, setBusinessValue] = useState<string>(t.business_value?.toString() || "");
  const [effort, setEffort] = useState<string>(t.effort?.toString() || "");
  const [scrumStatus, setScrumStatus] = useState<string>(t.scrum_status || "backlog");

  useEffect(() => {
    setSprintId(t.sprint_id || "__none__");
    setStoryPoints(t.story_points?.toString() || "");
    setBusinessValue(t.business_value?.toString() || "");
    setEffort(t.effort?.toString() || "");
    setScrumStatus(t.scrum_status || "backlog");
  }, [t.id]);

  const score = wsjf(Number(businessValue) || 0, Number(effort) || 0);

  const handleSave = () => {
    update.mutate(
      {
        id: ticket.id,
        updates: {
          sprint_id: sprintId === "__none__" ? null : sprintId,
          story_points: storyPoints ? Number(storyPoints) : null,
          business_value: businessValue ? Number(businessValue) : null,
          effort: effort ? Number(effort) : null,
          scrum_status: scrumStatus as any,
        },
      },
      { onSuccess: () => toast.success("Scrum actualizado") }
    );
  };

  return (
    <div className="space-y-3">
      {/* Scoring */}
      <div className="grid grid-cols-3 gap-2">
        <Field icon={TrendingUp} label="Valor (1-10)" color="text-emerald-400">
          <Input type="number" min={1} max={10} value={businessValue} onChange={e => setBusinessValue(e.target.value)} className="h-7 text-xs" placeholder="—" />
        </Field>
        <Field icon={Layers} label="Esfuerzo (1-10)" color="text-amber-400">
          <Input type="number" min={1} max={10} value={effort} onChange={e => setEffort(e.target.value)} className="h-7 text-xs" placeholder="—" />
        </Field>
        <Field icon={Zap} label="Story Points" color="text-violet-400">
          <Input type="number" min={0} value={storyPoints} onChange={e => setStoryPoints(e.target.value)} className="h-7 text-xs" placeholder="—" />
        </Field>
      </div>

      {/* WSJF Score */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-violet-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-medium">Prioridad WSJF</span>
        </div>
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-sm">{score}</Badge>
      </div>

      {/* Estado Scrum + Sprint */}
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Estado Scrum</label>
          <Select value={scrumStatus} onValueChange={setScrumStatus}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SCRUM_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Sprint</label>
          <Select value={sprintId} onValueChange={setSprintId}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Sin sprint" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin sprint (Backlog)</SelectItem>
              {sprints.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} {s.status === "activo" && "🔥"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleSave} disabled={update.isPending}>
        <Save className="h-3 w-3" /> Guardar Scrum
      </Button>

      <p className="text-[10px] text-muted-foreground italic leading-relaxed">
        WSJF (Weighted Shortest Job First) = Valor / Esfuerzo. Mayor score = más prioridad.
      </p>
    </div>
  );
}

function Field({ icon: Icon, label, color, children }: any) {
  return (
    <div>
      <label className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Icon className={`h-2.5 w-2.5 ${color}`} /> {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
