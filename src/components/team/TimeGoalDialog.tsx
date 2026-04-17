import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useMyTimeGoal, useUpsertTimeGoal } from "@/hooks/useTimeTracking";
import { Target } from "lucide-react";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export function TimeGoalDialog({ open, onOpenChange }: Props) {
  const { data: goal } = useMyTimeGoal();
  const upsert = useUpsertTimeGoal();
  const [weekly, setWeekly] = useState(40);
  const [billable, setBillable] = useState(80);

  useEffect(() => {
    if (goal) { setWeekly(goal.weekly_target_hours); setBillable(goal.billable_target_pct); }
  }, [goal, open]);

  const submit = async () => {
    try {
      await upsert.mutateAsync({ weekly_target_hours: weekly, billable_target_pct: billable });
      toast.success("Metas actualizadas");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Target className="h-4 w-4" /> Mis metas semanales</DialogTitle>
          <DialogDescription>Define tu carga objetivo y tu meta de horas facturables.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Horas por semana</Label>
              <Input type="number" min={5} max={80} value={weekly} onChange={e => setWeekly(Number(e.target.value))} className="h-7 w-20 text-right" />
            </div>
            <Slider value={[weekly]} onValueChange={v => setWeekly(v[0])} min={5} max={80} step={1} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>5h</span><span className="font-bold text-foreground">{weekly}h</span><span>80h</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Meta facturable (%)</Label>
              <Input type="number" min={0} max={100} value={billable} onChange={e => setBillable(Number(e.target.value))} className="h-7 w-20 text-right" />
            </div>
            <Slider value={[billable]} onValueChange={v => setBillable(v[0])} min={0} max={100} step={5} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0%</span><span className="font-bold text-foreground">{billable}%</span><span>100%</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>📊 Diariamente: <span className="font-bold text-foreground">{(weekly / 5).toFixed(1)}h</span> en días laborables</p>
            <p>💰 Objetivo facturable: <span className="font-bold text-foreground">{((weekly * billable) / 100).toFixed(1)}h/sem</span></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? "Guardando..." : "Guardar metas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
