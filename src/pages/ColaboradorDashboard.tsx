import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTodo, Headset, FileText, Loader2, Calendar, Building2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface MyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string;
  client_id: string;
  description: string | null;
}

interface MyTicket {
  id: string;
  ticket_id: string;
  asunto: string;
  estado: string;
  prioridad: string;
  client_id: string;
  fecha_entrega: string | null;
  dias_antiguedad: number;
}

interface MyMinute {
  id: string;
  title: string;
  date: string;
  client_id: string;
  summary: string;
}

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  "in-progress": "bg-primary/15 text-primary border-primary/30",
  completed: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  blocked: "bg-destructive/15 text-destructive border-destructive/30",
  abierto: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  "en-progreso": "bg-primary/15 text-primary border-primary/30",
  resuelto: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  cerrado: "bg-muted text-muted-foreground border-border",
};

export default function ColaboradorDashboard() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [minutes, setMinutes] = useState<MyMinute[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const fullName = profile?.full_name || "";

      const [tasksRes, ticketsRes, minutesRes, clientsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, client_id, description, owner, assigned_user_id, assignees")
          .or(`assigned_user_id.eq.${user.id},owner.eq.${fullName}`)
          .order("due_date", { ascending: true }),
        supabase
          .from("support_tickets")
          .select("id, ticket_id, asunto, estado, prioridad, client_id, fecha_entrega, dias_antiguedad, responsable, assigned_user_id")
          .or(`assigned_user_id.eq.${user.id},responsable.eq.${fullName}`)
          .order("dias_antiguedad", { ascending: false }),
        supabase
          .from("meeting_minutes")
          .select("id, title, date, client_id, summary, attendees")
          .order("date", { ascending: false })
          .limit(50),
        supabase.from("clients").select("id, name"),
      ]);

      // Filter minutes locally where attendees include the user's full name
      const myMinutes = (minutesRes.data || []).filter((m: any) =>
        Array.isArray(m.attendees) && m.attendees.some((a: string) => a?.toLowerCase().includes(fullName.toLowerCase()))
      );

      setTasks(tasksRes.data || []);
      setTickets(ticketsRes.data || []);
      setMinutes(myMinutes);
      setClientNames(Object.fromEntries((clientsRes.data || []).map((c) => [c.id, c.name])));
      setLoading(false);
    })();
  }, [user, profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const openTickets = tickets.filter((t) => !["resuelto", "cerrado"].includes(t.estado));

  const stats = [
    { label: "Tareas activas", value: activeTasks.length, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: "Tickets abiertos", value: openTickets.length, icon: Headset, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Minutas", value: minutes.length, icon: FileText, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Hola, {profile?.full_name?.split(" ")[0] || "Colaborador"} 👋</h2>
        <p className="text-sm text-muted-foreground">Aquí tienes un resumen de tus tareas y participación</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, idx) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card className={`${s.bg} border-border/30`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="tasks" className="gap-2"><ListTodo className="h-4 w-4" /> Mis Tareas ({tasks.length})</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2"><Headset className="h-4 w-4" /> Mis Tickets ({tickets.length})</TabsTrigger>
          <TabsTrigger value="minutes" className="gap-2"><FileText className="h-4 w-4" /> Mis Minutas ({minutes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-2">
          {tasks.length === 0 ? (
            <EmptyState message="No tienes tareas asignadas" />
          ) : tasks.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {clientNames[t.client_id] || t.client_id}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {t.due_date}</span>
                      <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                    </div>
                  </div>
                  <Badge className={`${statusColor[t.status] || "bg-muted"} text-[10px]`}>{t.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-2">
          {tickets.length === 0 ? (
            <EmptyState message="No tienes tickets asignados" />
          ) : tickets.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t.ticket_id}</code>
                      <p className="text-sm font-semibold">{t.asunto}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {clientNames[t.client_id] || t.client_id}</span>
                      <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {t.dias_antiguedad}d</span>
                      <Badge variant="outline" className="text-[10px]">{t.prioridad}</Badge>
                    </div>
                  </div>
                  <Badge className={`${statusColor[t.estado] || "bg-muted"} text-[10px]`}>{t.estado}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="minutes" className="mt-4 space-y-2">
          {minutes.length === 0 ? (
            <EmptyState message="No has participado en minutas recientes" />
          ) : minutes.map((m) => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.summary}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {clientNames[m.client_id] || m.client_id}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {m.date}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}
