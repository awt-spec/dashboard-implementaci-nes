import { useState } from "react";
import { type Client } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Building2, MapPin, Mail, User, Calendar, TrendingUp,
  CheckCircle2, Loader2, Circle, Clock, AlertTriangle,
  ArrowLeft, Download, ArrowRightLeft, Plus, Ticket,
} from "lucide-react";
import { NewTicketForm } from "@/components/support/NewTicketForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { exportClientPdf } from "@/lib/exportPdf";
import { ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell } from "recharts";
import { ActionItemsTab } from "./tabs/ActionItemsTab";
import { MeetingMinutesTab } from "./tabs/MeetingMinutesTab";
import { DeliverablesTab } from "./tabs/DeliverablesTab";
import { RisksTab } from "./tabs/RisksTab";
import { CollaborationTab } from "./tabs/CollaborationTab";
import { TaskViewSwitcher } from "@/components/tasks/TaskViewSwitcher";
import { ContactsTab } from "./tabs/ContactsTab";
import { FunnelTab } from "./tabs/FunnelTab";
import { ContractsSLATab } from "./ContractsSLATab";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectKPIs } from "@/components/dashboard/ProjectKPIs";
import { UpcomingDeliverables } from "@/components/dashboard/UpcomingDeliverables";
import { ClientTechStack } from "./ClientTechStack";
import { useQueryClient } from "@tanstack/react-query";

const phaseStatusConfig = {
  completado: { label: "Completado", icon: CheckCircle2, className: "bg-success text-success-foreground" },
  "en-progreso": { label: "Progreso", icon: Loader2, className: "bg-warning text-warning-foreground" },
  "por-iniciar": { label: "Por Iniciar", icon: Clock, className: "bg-info text-info-foreground" },
  pendiente: { label: "Pendiente", icon: Circle, className: "bg-muted text-muted-foreground" },
};

const phaseStatusOptions = Object.entries(phaseStatusConfig).map(([k, v]) => ({ value: k, label: v.label }));

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
}

export function ClientDetail({ client, onBack }: ClientDetailProps) {
  const queryClient = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [newCaseOpen, setNewCaseOpen] = useState(false);

  const handleTransferToSupport = async () => {
    setTransferring(true);
    try {
      const { error } = await supabase.from("clients").update({ client_type: "soporte" } as any).eq("id", client.id);
      if (error) throw error;
      toast.success(`${client.name} transferido a Soporte`);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setTransferOpen(false);
      onBack();
    } catch (e: any) {
      toast.error(e.message || "Error al transferir");
    } finally {
      setTransferring(false);
    }
  };

  const statusColors: Record<string, string> = {
    activo: "bg-success text-success-foreground",
    "en-riesgo": "bg-destructive text-destructive-foreground",
    completado: "bg-info text-info-foreground",
    pausado: "bg-muted text-muted-foreground",
  };

  const gaugeData = [{ value: client.progress }, { value: 100 - client.progress }];

  const handlePhaseUpdate = async (phaseName: string, field: string, value: string | number) => {
    const { data } = await supabase.from("phases").select("id").eq("client_id", client.id).eq("name", phaseName).single();
    if (!data) return;
    const { error } = await supabase.from("phases").update({ [field]: value } as any).eq("id", data.id);
    if (error) { toast.error("Error al actualizar fase"); return; }
    toast.success("Fase actualizada");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <button onClick={onBack} className="mt-1 p-1.5 rounded-md hover:bg-secondary transition-colors">
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{client.name}</h2>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {client.country}</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {client.contactName}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {client.contactEmail}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setNewCaseOpen(true)}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Nuevo caso
                    </Button>
                    <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                          <ArrowRightLeft className="h-3.5 w-3.5" /> A Soporte
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Transferir a Soporte</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          ¿Estás seguro de transferir <strong>{client.name}</strong> de Implementación a Soporte?
                          El cliente aparecerá en el dashboard de soporte.
                        </p>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
                          <Button onClick={handleTransferToSupport} disabled={transferring} className="gap-1.5">
                            {transferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                            Transferir
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={() => exportClientPdf(client)} className="gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Exportar PDF
                    </Button>
                    <Badge className={statusColors[client.status]}>
                      {client.status === "activo" ? "Activo" : client.status === "en-riesgo" ? "En Riesgo" : client.status === "completado" ? "Completado" : "Pausado"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {client.contractStart} → {client.contractEnd}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Progreso", value: `${client.progress}%`, icon: TrendingUp },
          { label: "Tareas", value: client.tasks.length.toString(), icon: CheckCircle2 },
          { label: "Entregables", value: client.deliverables.length.toString(), icon: Clock },
          { label: "Riesgos", value: client.risks.filter(r => r.status === "abierto").length.toString(), icon: AlertTriangle },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* SPI/CPI KPIs */}
      <ProjectKPIs clients={[client]} client={client} />

      {/* Tech Stack: Core version + Modules */}
      <ClientTechStack clientId={client.id} coreVersion={client.coreVersion} modules={client.modules} />

      {/* Upcoming Deliverables */}
      <UpcomingDeliverables clients={[client]} client={client} />

      {/* Progress Section - Fixed, not a tab */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex flex-col items-center">
              <h3 className="text-sm font-semibold text-foreground mb-3">Progreso General</h3>
              <div className="relative w-28 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gaugeData} innerRadius={38} outerRadius={52} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                      <Cell fill="hsl(var(--primary))" />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-foreground">{client.progress}%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Fases del Proyecto</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {client.phases.map(phase => {
                const config = phaseStatusConfig[phase.status];
                return (
                  <div key={phase.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <config.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">{phase.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">{phase.startDate} — {phase.endDate}</span>
                        <Select value={phase.status} onValueChange={v => handlePhaseUpdate(phase.name, "status", v)}>
                          <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none w-auto">
                            <Badge className={`${config.className} text-[10px] px-1.5 py-0`}>{config.label}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {phaseStatusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[phase.progress]}
                        max={100}
                        step={5}
                        className="flex-1"
                        onValueCommit={v => handlePhaseUpdate(phase.name, "progress", v[0])}
                      />
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{phase.progress}%</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="tareas">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="entregables">Entregables</TabsTrigger>
          <TabsTrigger value="equipo">Equipo Cliente</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
          <TabsTrigger value="minutas">Minutas</TabsTrigger>
          <TabsTrigger value="riesgos">Riesgos</TabsTrigger>
          <TabsTrigger value="colaboracion">Colaboración</TabsTrigger>
          <TabsTrigger value="contratos">Contratos & SLA</TabsTrigger>
        </TabsList>

        <TabsContent value="tareas">
          <TaskViewSwitcher tasks={client.tasks} clientId={client.id} clientName={client.name} />
        </TabsContent>

        <TabsContent value="entregables">
          <DeliverablesTab deliverables={client.deliverables} clientId={client.id} tasks={client.tasks} />
        </TabsContent>

        <TabsContent value="equipo">
          <ContactsTab clientId={client.id} />
        </TabsContent>

        <TabsContent value="pipeline">
          <FunnelTab client={client} />
        </TabsContent>

        <TabsContent value="pendientes">
          <ActionItemsTab actionItems={client.actionItems} clientId={client.id} tasks={client.tasks} />
        </TabsContent>

        <TabsContent value="minutas">
          <MeetingMinutesTab meetingMinutes={client.meetingMinutes} clientId={client.id} client={client} />
        </TabsContent>

        <TabsContent value="riesgos">
          <RisksTab risks={client.risks} clientId={client.id} />
        </TabsContent>

        <TabsContent value="colaboracion">
          <CollaborationTab comments={client.comments} clientId={client.id} />
        </TabsContent>

        <TabsContent value="contratos">
          <ContractsSLATab clientId={client.id} />
        </TabsContent>
      </Tabs>

      {/* Dialog para crear caso desde el perfil del cliente */}
      <NewTicketForm
        open={newCaseOpen}
        onOpenChange={setNewCaseOpen}
        defaultClientId={client.id}
        mode="admin"
        onCreated={() => {
          toast.success("El caso apareció en la Bandeja de Soporte.", {
            description: "Podés ver el detalle en la sección Soporte → Bandeja.",
          });
        }}
      />
    </div>
  );
}
