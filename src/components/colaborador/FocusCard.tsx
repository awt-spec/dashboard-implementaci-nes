import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Building2, Target, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";

interface FocusCardProps {
  items: ScrumWorkItem[];
  clientNames: Record<string, string>;
  activeTimer: string | null;
  onTimer: (item: ScrumWorkItem) => void;
  onSelect: (item: ScrumWorkItem) => void;
  onSeeAll: () => void;
}

export function FocusCard({ items, clientNames, activeTimer, onTimer, onSelect, onSeeAll }: FocusCardProps) {
  // Top 3: bloqueadas primero, luego in_progress, luego ready, todo por WSJF
  const ranked = [...items].sort((a, b) => {
    const score = (i: ScrumWorkItem) => {
      if (i.scrum_status === "blocked") return 0;
      if (i.scrum_status === "in_progress") return 1;
      if (i.scrum_status === "ready") return 2;
      return 3;
    };
    if (score(a) !== score(b)) return score(a) - score(b);
    return (b.wsjf || 0) - (a.wsjf || 0);
  }).slice(0, 3);

  return (
    <Card className="h-full">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Foco de hoy</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">{ranked.length}</Badge>
          </div>
          <button onClick={onSeeAll} className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium">
            Ver todo mi trabajo <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="space-y-2 flex-1">
          {ranked.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-8">No tenés tareas de foco hoy</p>
          )}
          {ranked.map(item => (
            <button
              key={`${item.source}-${item.id}`}
              onClick={() => onSelect(item)}
              className={cn(
                "w-full text-left rounded-lg border p-3 transition-all hover:border-primary/50 hover:shadow-sm group",
                activeTimer === item.id ? "border-primary/50 bg-primary/5" : "border-border bg-card"
              )}
            >
              <div className="flex items-start gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onTimer(item); }}
                  className={cn(
                    "shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                    activeTimer === item.id
                      ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                      : "bg-muted hover:bg-primary hover:text-primary-foreground"
                  )}
                  title={activeTimer === item.id ? "Detener" : "Iniciar timer"}
                >
                  {activeTimer === item.id ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug line-clamp-1 mb-1">{item.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-2.5 w-2.5" /> {clientNames[item.client_id] || item.client_id}
                    </span>
                    {item.priority && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4 text-[9px] px-1.5",
                          item.priority?.toLowerCase() === "alta" && "text-red-500 border-red-500/30 bg-red-500/5",
                          item.priority?.toLowerCase() === "media" && "text-amber-600 border-amber-500/30 bg-amber-500/5",
                          item.priority?.toLowerCase() === "baja" && "text-slate-500 border-slate-500/30 bg-slate-500/5",
                        )}
                      >
                        {item.priority}
                      </Badge>
                    )}
                    {item.story_points != null && (
                      <span className="text-[10px] font-mono text-muted-foreground">· {item.story_points}pts</span>
                    )}
                  </div>
                </div>
                {item.due_date && (
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-1">
                    {item.due_date.slice(5)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
