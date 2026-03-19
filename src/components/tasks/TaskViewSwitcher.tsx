import { useState } from "react";
import { type ClientTask } from "@/data/projectData";
import { TaskTable } from "./TaskTable";
import { TaskBoard } from "./TaskBoard";
import { TaskCalendar } from "./TaskCalendar";
import { TaskTimeline } from "./TaskTimeline";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { EditTaskDialog } from "./EditTaskDialog";
import { Button } from "@/components/ui/button";
import { LayoutList, Columns3, Calendar, GanttChart, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ViewType = "table" | "kanban" | "calendar" | "timeline";

const views: { key: ViewType; label: string; icon: typeof LayoutList }[] = [
  { key: "table", label: "Tabla", icon: LayoutList },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "calendar", label: "Calendario", icon: Calendar },
  { key: "timeline", label: "Timeline", icon: GanttChart },
];

interface TaskViewSwitcherProps {
  tasks: ClientTask[];
  clientId: string;
  clientName?: string;
}

export function TaskViewSwitcher({ tasks, clientId, clientName }: TaskViewSwitcherProps) {
  const [view, setView] = useState<ViewType>("table");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all");
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = (task: ClientTask) => {
    setEditingTask(task);
    setEditOpen(true);
  };

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterVisibility !== "all" && ((t as any).visibility || "externa") !== filterVisibility) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
          {views.map(v => (
            <Button
              key={v.key}
              variant={view === v.key ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => setView(v.key)}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar tarea..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-[180px] pl-8 text-xs"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="en-progreso">Progreso</SelectItem>
              <SelectItem value="bloqueada">Bloqueada</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue placeholder="Prioridad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterVisibility} onValueChange={setFilterVisibility}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="externa">🌐 Externa</SelectItem>
              <SelectItem value="interna">🔒 Interna</SelectItem>
            </SelectContent>
          </Select>
          <CreateTaskDialog clientId={clientId} clientName={clientName} />
        </div>
      </div>

      {/* View */}
      {view === "table" && <TaskTable tasks={filtered} clientId={clientId} onEdit={handleEdit} />}
      {view === "kanban" && <TaskBoard tasks={filtered} clientId={clientId} onEdit={handleEdit} />}
      {view === "calendar" && <TaskCalendar tasks={filtered} onEdit={handleEdit} />}
      {view === "timeline" && <TaskTimeline tasks={filtered} onEdit={handleEdit} />}

      {/* Edit Dialog */}
      <EditTaskDialog
        task={editingTask}
        clientId={clientId}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
