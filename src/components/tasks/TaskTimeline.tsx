import { useMemo } from "react";
import { type ClientTask } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";

const statusColor: Record<string, string> = {
  completada: "bg-success",
  "en-progreso": "bg-info",
  bloqueada: "bg-destructive",
  pendiente: "bg-warning",
};

const priorityLabel: Record<string, { label: string; className: string }> = {
  alta: { label: "Alta", className: "bg-destructive/10 text-destructive" },
  media: { label: "Media", className: "bg-warning/10 text-warning" },
  baja: { label: "Baja", className: "bg-muted text-muted-foreground" },
};

interface TaskTimelineProps {
  tasks: ClientTask[];
  onEdit?: (task: ClientTask) => void;
}

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function TaskTimeline({ tasks, onEdit }: TaskTimelineProps) {
  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const da = parseDate(a.dueDate)?.getTime() || 0;
      const db = parseDate(b.dueDate)?.getTime() || 0;
      return da - db;
    });
  }, [tasks]);

  // Group by month
  const grouped = useMemo(() => {
    const map: Record<string, ClientTask[]> = {};
    sorted.forEach(task => {
      const d = parseDate(task.dueDate);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!map[key]) map[key] = [];
        map[key].push(task);
      } else {
        if (!map["sin-fecha"]) map["sin-fecha"] = [];
        map["sin-fecha"].push(task);
      }
    });
    return map;
  }, [sorted]);

  const monthNames: Record<string, string> = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {Object.entries(grouped).map(([key, tasks]) => {
          const [year, month] = key.split("-");
          const label = key === "sin-fecha" ? "Sin Fecha" : `${monthNames[month]} ${year}`;

          return (
            <div key={key}>
              {/* Month header */}
              <div className="flex items-center gap-3 mb-3 relative">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center z-10 shrink-0">
                  <span className="text-primary-foreground text-[10px] font-bold">
                    {key === "sin-fecha" ? "?" : month}
                  </span>
                </div>
                <span className="text-sm font-bold text-foreground">{label}</span>
                <Badge variant="outline" className="text-xs">{tasks.length} tareas</Badge>
              </div>

              {/* Tasks */}
              <div className="ml-12 space-y-2">
                {tasks.map(task => {
                  const pConfig = priorityLabel[task.priority];
                  return (
                    <div
                      key={task.id}
                      onClick={() => onEdit?.(task)}
                      className="p-3 rounded-lg border border-border bg-card hover:shadow-md transition-all cursor-pointer group relative"
                    >
                      {/* Status indicator */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${statusColor[task.status]}`} />

                      <div className="flex items-start justify-between gap-2 pl-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span>{task.owner}</span>
                            <span>•</span>
                            <span>{task.dueDate}</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge className={pConfig.className + " text-[10px]"}>{pConfig.label}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
