import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, RotateCcw, Loader2, Smile } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useSprintRetro, useUpsertRetro } from "@/hooks/useSprintCeremonies";
import type { UnifiedSprint } from "@/hooks/useTeamScrum";

interface Props {
  sprint: UnifiedSprint;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const COLUMNS = [
  { key: "well", label: "✅ Qué funcionó", color: "bg-success/10 border-success/30", btn: "text-success" },
  { key: "improve", label: "⚠️ Qué mejorar", color: "bg-warning/10 border-warning/30", btn: "text-warning" },
  { key: "actions", label: "🚀 Acciones", color: "bg-primary/10 border-primary/30", btn: "text-primary" },
] as const;

export function SprintRetroDialog({ sprint, open, onOpenChange }: Props) {
  const { data: retro } = useSprintRetro(sprint.id);
  const upsert = useUpsertRetro();

  const [well, setWell] = useState<string[]>([]);
  const [improve, setImprove] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [mood, setMood] = useState(3);
  const [draft, setDraft] = useState<Record<string, string>>({ well: "", improve: "", actions: "" });

  useEffect(() => {
    if (retro) {
      setWell(retro.what_went_well || []);
      setImprove(retro.what_to_improve || []);
      setActions(retro.action_items || []);
      setMood(Number(retro.team_mood) || 3);
    }
  }, [retro]);

  const lists: Record<string, [string[], (v: string[]) => void]> = {
    well: [well, setWell],
    improve: [improve, setImprove],
    actions: [actions, setActions],
  };

  const addItem = (key: string) => {
    const text = draft[key].trim();
    if (!text) return;
    const [list, setter] = lists[key];
    setter([...list, text]);
    setDraft(d => ({ ...d, [key]: "" }));
  };

  const removeItem = (key: string, idx: number) => {
    const [list, setter] = lists[key];
    setter(list.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        sprint_id: sprint.id,
        what_went_well: well,
        what_to_improve: improve,
        action_items: actions,
        team_mood: mood,
      });
      toast.success("Retrospectiva guardada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Retrospectiva — {sprint.name}
          </DialogTitle>
          <DialogDescription>Captura aprendizajes del equipo y define acciones concretas para el próximo sprint.</DialogDescription>
        </DialogHeader>

        {/* Mood */}
        <Card>
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Smile className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">Mood promedio del equipo:</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setMood(n)}
                  className={`text-2xl transition ${mood >= n ? "opacity-100 scale-110" : "opacity-30"}`}
                >
                  {["😞", "😐", "🙂", "😊", "🤩"][n - 1]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {COLUMNS.map(col => {
            const [list] = lists[col.key];
            return (
              <Card key={col.key} className={col.color}>
                <CardContent className="p-3 space-y-2">
                  <h4 className="text-xs font-bold uppercase">{col.label}</h4>
                  <div className="space-y-1.5 min-h-[150px]">
                    <AnimatePresence>
                      {list.map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="p-2 rounded bg-card border border-border/40 text-xs flex items-start justify-between gap-2 shadow-sm"
                        >
                          <span className="flex-1">{item}</span>
                          <button onClick={() => removeItem(col.key, i)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="flex gap-1">
                    <Input
                      value={draft[col.key]}
                      onChange={e => setDraft(d => ({ ...d, [col.key]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addItem(col.key))}
                      placeholder="Añadir…"
                      className="h-7 text-xs"
                    />
                    <Button size="sm" variant="ghost" className={`h-7 px-2 ${col.btn}`} onClick={() => addItem(col.key)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Guardar Retro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
