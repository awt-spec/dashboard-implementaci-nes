import { useState, useMemo } from "react";
import { type ClientTask } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const statusColor: Record<string, string> = {
  completada: "bg-success",
  "en-progreso": "bg-info",
  bloqueada: "bg-destructive",
  pendiente: "bg-warning",
};

const priorityBorder: Record<string, string> = {
  alta: "border-l-destructive",
  media: "border-l-warning",
  baja: "border-l-success",
};

interface TaskCalendarProps {
  tasks: ClientTask[];
  onEdit?: (task: ClientTask) => void;
}

function parseDate(dateStr: string): Date | null {
  // Try common formats: "22 Feb 2026", "2026-02-22", etc.
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function TaskCalendar({ tasks, onEdit }: TaskCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-based
  const daysInMonth = lastDay.getDate();

  const tasksByDate = useMemo(() => {
    const map: Record<string, ClientTask[]> = {};
    tasks.forEach(task => {
      const d = parseDate(task.dueDate);
      if (d) {
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push(task);
      }
    });
    return map;
  }, [tasks]);

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(<div key={`empty-${i}`} className="min-h-[80px] bg-secondary/20 rounded-lg" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${month}-${day}`;
    const dayTasks = tasksByDate[key] || [];
    const isToday = new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === day;

    cells.push(
      <div
        key={day}
        className={`min-h-[80px] p-1.5 rounded-lg border transition-colors ${
          isToday ? "border-primary bg-primary/5" : "border-border/50 bg-card hover:bg-secondary/20"
        }`}
      >
        <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
          {day}
        </span>
        <div className="mt-1 space-y-0.5">
          {dayTasks.slice(0, 3).map(task => (
            <button
              key={task.id}
              onClick={() => onEdit?.(task)}
              className={`w-full text-left px-1.5 py-0.5 rounded text-[9px] font-medium truncate border-l-2 ${priorityBorder[task.priority]} bg-secondary/50 hover:bg-accent transition-colors text-foreground`}
            >
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor[task.status]}`} />
                <span className="truncate">{task.title}</span>
              </div>
            </button>
          ))}
          {dayTasks.length > 3 && (
            <span className="text-[8px] text-muted-foreground pl-1">+{dayTasks.length - 3} más</span>
          )}
        </div>
      </div>
    );
  }

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          {monthNames[month]} {year}
        </h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(new Date(year, month - 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentDate(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(new Date(year, month + 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells}
      </div>
    </div>
  );
}
