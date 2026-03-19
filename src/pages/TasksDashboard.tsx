import { useState } from "react";
import { useClients } from "@/hooks/useClients";
import { clients as staticClients, type ClientTask } from "@/data/projectData";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskCalendar } from "@/components/tasks/TaskCalendar";
import { TaskTimeline } from "@/components/tasks/TaskTimeline";
import { TaskTable } from "@/components/tasks/TaskTable";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutList, Columns3, Calendar, GanttChart, Search, Loader2, CheckCircle2, AlertOctagon, Clock, Loader } from "lucide-react";

type ViewType = "table" | "kanban" | "calendar" | "timeline";

type TaskWithClient = ClientTask & { clientId: string; clientName: string };

const views: { key: ViewType; label: string; icon: typeof LayoutList }[] = [
  { key: "table", label: "Tabla", icon: LayoutList },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "calendar", label: "Calendario", icon: Calendar },
  { key: "timeline", label: "Timeline", icon: GanttChart },
];

export default function TasksDashboard() {
  const { data: clientsData, isLoading } = useClients();
  const clients = clientsData && clientsData.length > 0 ? clientsData : staticClients;

  const [view, setView] = useState<ViewType>("kanban");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all");
  const [search, setSearch] = useState("");
  const [editingTask, setEditingTask] = useState<TaskWithClient | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allTasks: TaskWithClient[] = clients.flatMap(c =>
    c.tasks.map(t => ({ ...t, clientId: c.id, clientName: c.name }))
  );

  const filtered = allTasks.filter(t => {
    if (filterClient !== "all" && t.clientId !== filterClient) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterVisibility !== "all" && ((t as any).visibility || "externa") !== filterVisibility) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: allTasks.length,
    completada: allTasks.filter(t => t.status === "completada").length,
    enProgreso: allTasks.filter(t => t.status === "en-progreso").length,
    bloqueada: allTasks.filter(t => t.status === "bloqueada").length,
    pendiente: allTasks.filter(t => t.status === "pendiente").length,
  };

  const handleEdit = (task: ClientTask) => {
    // Find the clientId for this task
    const taskWithClient = allTasks.find(t => t.id === task.id);
    if (taskWithClient) {
      setEditingTask(taskWithClient);
      setEditOpen(true);
    }
  };

  // Determine the clientId to use for the current view
  // For global views, we need to find the right clientId per task
  const activeClientId = filterClient !== "all" ? filterClient : (clients[0]?.id || "");

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: LayoutList, color: "text-foreground" },
          { label: "Progreso", value: stats.enProgreso, icon: Loader, color: "text-info" },
          { label: "Pendientes", value: stats.pendiente, icon: Clock, color: "text-warning" },
          { label: "Bloqueadas", value: stats.bloqueada, icon: AlertOctagon, color: "text-destructive" },
          { label: "Completadas", value: stats.completada, icon: CheckCircle2, color: "text-success" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-[180px] pl-8 text-xs" />
          </div>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <CreateTaskDialog clientId={activeClientId} />
        </div>
      </div>

      {/* View content */}
      {view === "table" && <TaskTable tasks={filtered} clientId={activeClientId} onEdit={handleEdit} />}
      {view === "kanban" && <TaskBoard tasks={filtered} clientId={activeClientId} onEdit={handleEdit} />}
      {view === "calendar" && <TaskCalendar tasks={filtered} onEdit={handleEdit} />}
      {view === "timeline" && <TaskTimeline tasks={filtered} onEdit={handleEdit} />}

      {/* Edit Dialog */}
      <EditTaskDialog
        task={editingTask}
        clientId={editingTask?.clientId || activeClientId}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
