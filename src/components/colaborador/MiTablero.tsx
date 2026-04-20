import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Plus, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";

const COLUMNS = [
  { key: "ready", label: "POR HACER", borderColor: "border-t-slate-400" },
  { key: "in_progress", label: "EN PROGRESO", borderColor: "border-t-blue-500" },
  { key: "blocked", label: "BLOQUEADAS", borderColor: "border-t-red-500" },
  { key: "done", label: "TERMINADAS", borderColor: "border-t-emerald-500" },
];

const PRIORITY_BADGE: Record<string, string> = {
  alta: "bg-red-500/10 text-red-600 border-red-500/30",
  critica: "bg-red-600/15 text-red-700 border-red-600/30",
  media: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  baja: "bg-slate-400/10 text-slate-600 border-slate-400/30",
};

interface MiTableroProps {
  items: ScrumWorkItem[];
  clientNames: Record<string, string>;
  sprintName?: string | null;
  daysLeft?: number | null;
  onSelect: (item: ScrumWorkItem) => void;
  onMove: (item: ScrumWorkItem, status: string) => void;
}

export function MiTablero({ items, clientNames, sprintName, daysLeft, onSelect, onMove }: MiTableroProps) {
  const initials = (name: string) => name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  const handleDragStart = (e: React.DragEvent, item: ScrumWorkItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, source: item.source }));
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const { id, source } = JSON.parse(raw);
    const item = items.find(i => i.id === id && i.source === source);
    if (item && item.scrum_status !== status) onMove(item, status);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Mi tablero</h3>
            <span className="text-xs text-muted-foreground">— arrastrá para mover</span>
          </div>
          {sprintName && (
            <p className="text-xs text-muted-foreground">
              {sprintName} {daysLeft !== null && <>· <span className="font-semibold text-foreground">{daysLeft}d</span> restantes</>}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {COLUMNS.map(col => {
            const colItems = items.filter(i => (i.scrum_status || "ready") === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.key)}
                className={cn("rounded-lg bg-muted/30 border border-border border-t-2 flex flex-col min-h-[280px]", col.borderColor)}
              >
                <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground">{col.label}</span>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-bold">{colItems.length}</Badge>
                  </div>
                  <button
                    onClick={() => {
                      const it = colItems[0];
                      if (it) onSelect(it);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Nueva (próximamente)"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="p-2 space-y-2 flex-1">
                  {colItems.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/50 text-center py-6 italic">Vacío</p>
                  )}
                  {colItems.map((item, idx) => (
                    <motion.div
                      key={`${item.source}-${item.id}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                    >
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onClick={() => onSelect(item)}
                      className="rounded-md bg-background border border-border/50 p-2.5 cursor-pointer hover:border-primary/40 hover:shadow-sm space-y-1.5 active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-1.5">
                        <GitBranch className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs font-semibold leading-snug line-clamp-2 flex-1">{item.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.priority && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-4 text-[9px] px-1.5 capitalize",
                              PRIORITY_BADGE[item.priority?.toLowerCase()] || PRIORITY_BADGE.media
                            )}
                          >
                            {item.priority}
                          </Badge>
                        )}
                        {item.story_points != null && (
                          <Badge variant="outline" className="h-4 text-[9px] px-1.5 font-mono">{item.story_points}pts</Badge>
                        )}
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 truncate flex-1 min-w-0">
                          <Building2 className="h-2.5 w-2.5" />
                          <span className="truncate">{clientNames[item.client_id]?.split(" ").slice(0, 2).join(" ") || item.client_id}</span>
                        </span>
                        {item.owner && (
                          <span className="ml-auto h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-bold border border-primary/20">
                            {initials(item.owner)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
