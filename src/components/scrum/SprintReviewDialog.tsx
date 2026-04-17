import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRightCircle, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSprintReview, useUpsertReview } from "@/hooks/useSprintCeremonies";
import type { UnifiedSprint, ScrumWorkItem } from "@/hooks/useTeamScrum";

interface Props {
  sprint: UnifiedSprint;
  items: ScrumWorkItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: () => void;
}

export function SprintReviewDialog({ sprint, items, open, onOpenChange, onComplete }: Props) {
  const { data: review } = useSprintReview(sprint.id);
  const upsert = useUpsertReview();
  const [demo, setDemo] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (review) {
      setDemo(review.demo_notes || "");
      setFeedback(review.stakeholder_feedback || "");
    }
  }, [review]);

  const completed = items.filter(i => i.scrum_status === "done");
  const carryOver = items.filter(i => i.scrum_status !== "done");
  const planned = items.reduce((s, i) => s + (i.story_points || 0), 0);
  const completedSP = completed.reduce((s, i) => s + (i.story_points || 0), 0);
  const completionPct = planned > 0 ? Math.round((completedSP / planned) * 100) : 0;

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        sprint_id: sprint.id,
        demo_notes: demo,
        stakeholder_feedback: feedback,
        completed_items: completed.map(i => ({ id: i.id, title: i.title, sp: i.story_points })),
        carry_over: carryOver.map(i => ({ id: i.id, title: i.title, sp: i.story_points, status: i.scrum_status })),
        velocity_planned: planned,
        velocity_completed: completedSP,
      });
      toast.success("Review guardada");
      onComplete?.();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightCircle className="h-5 w-5 text-primary" />
            Sprint Review — {sprint.name}
          </DialogTitle>
          <DialogDescription>Revisa lo entregado, captura feedback y prepara el cierre del sprint.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{completed.length}</p>
            <p className="text-[10px] uppercase text-muted-foreground">Completados</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-warning">{carryOver.length}</p>
            <p className="text-[10px] uppercase text-muted-foreground">Carry-over</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{completionPct}%</p>
            <p className="text-[10px] uppercase text-muted-foreground">Velocity {completedSP}/{planned} SP</p>
          </CardContent></Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <h4 className="text-xs font-bold uppercase mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />Entregados</h4>
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {completed.length === 0 && <p className="text-[11px] text-muted-foreground italic">—</p>}
                {completed.map(i => (
                  <div key={i.id} className="text-[11px] p-1.5 rounded bg-success/5 border border-success/20 flex items-center justify-between gap-2">
                    <span className="truncate">{i.title}</span>
                    {i.story_points && <Badge variant="outline" className="text-[9px] h-4">{i.story_points} SP</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <h4 className="text-xs font-bold uppercase mb-2 flex items-center gap-1.5">⏭️ Carry-over al próximo</h4>
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {carryOver.length === 0 && <p className="text-[11px] text-muted-foreground italic">Nada queda pendiente 🎉</p>}
                {carryOver.map(i => (
                  <div key={i.id} className="text-[11px] p-1.5 rounded bg-warning/5 border border-warning/20 flex items-center justify-between gap-2">
                    <span className="truncate">{i.title}</span>
                    <Badge variant="outline" className="text-[9px] h-4">{i.scrum_status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <label className="text-xs font-bold uppercase">Notas de la demo</label>
          <Textarea rows={3} value={demo} onChange={e => setDemo(e.target.value)} placeholder="Qué se mostró, comentarios técnicos…" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase flex items-center gap-1.5"><MessageSquare className="h-3 w-3" />Feedback del stakeholder</label>
          <Textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Reacciones, ajustes pedidos, próximos pasos…" />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Guardar y cerrar Sprint →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
