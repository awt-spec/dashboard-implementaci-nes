import { useState, useMemo } from "react";
import { type Client } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, MapPin, Mail, User, Calendar, TrendingUp,
  CheckCircle2, Loader2, Circle, Clock, AlertTriangle,
  ArrowLeft, Download, ArrowRightLeft, Plus, Pencil, Link2,
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
import { ClientUsersTab } from "./ClientUsersTab";
import { QuoteList } from "@/components/support/quotes/QuoteList";
import { AccountStatementPanel } from "./AccountStatementPanel";
import { EpicsProgressPanel } from "./EpicsProgressPanel";
import { summarizeEpicsFromTasks, EPICS, EPIC_LABEL } from "@/hooks/useEpics";
import { ClientAudiencesPanel } from "./ClientAudiencesPanel";
import { ClientCategoryBadge } from "./ClientCategoryBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectKPIs } from "@/components/dashboard/ProjectKPIs";
import { UpcomingDeliverables } from "@/components/dashboard/UpcomingDeliverables";
import { ClientTechStack } from "./ClientTechStack";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateClient } from "@/hooks/useClients";

const CLIENT_STATUSES = [
  { value: "activo", label: "Activo" },
  { value: "en-riesgo", label: "En Riesgo" },
  { value: "completado", label: "Completado" },
  { value: "pausado", label: "Pausado" },
];

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
  const updateClient = useUpdateClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [newCaseOpen, setNewCaseOpen] = useState(false);

  // Edición de campos del cliente (ERP-008)
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", country: "", industry: "",
    contact_name: "", contact_email: "",
    contract_start: "", contract_end: "", status: "activo",
  });
  const openEdit = () => {
    setEditForm({
      name: client.name ?? "",
      country: client.country ?? "",
      industry: client.industry ?? "",
      contact_name: client.contactName ?? "",
      contact_email: client.contactEmail ?? "",
      contract_start: client.contractStart ?? "",
      contract_end: client.contractEnd ?? "",
      status: client.status ?? "activo",
    });
    setEditOpen(true);
  };
  const handleSaveClient = () => {
    if (!editForm.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    updateClient.mutate(
      { id: client.id, updates: editForm as any },
      {
        onSuccess: () => { toast.success("Cliente actualizado"); setEditOpen(false); },
        onError: (e: any) => toast.error(e.message || "Error al actualizar"),
      },
    );
  };

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

  const handlePhaseUpdate = async (phaseName: string, field: string, value: string | number | null) => {
    const { data } = await supabase.from("phases").select("id").eq("client_id", client.id).eq("name", phaseName).single();
    if (!data) return;
    const { error } = await supabase.from("phases").update({ [field]: value } as any).eq("id", data.id);
    if (error) { toast.error("Error al actualizar fase"); return; }
    toast.success("Fase actualizada");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  // % por épica calculado del backlog — para fases vinculadas a una épica.
  const epicProgress = useMemo(() => {
    const map: Record<string, number> = {};
    summarizeEpicsFromTasks(client.tasks).summaries.forEach(s => { map[s.key] = s.progress; });
    return map;
  }, [client.tasks]);

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
                    <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Editar
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
                    <ClientCategoryBadge clientId={client.id} currentCategoryId={(client as any).category_id} />
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

      {/* Editar cliente (ERP-008) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nombre *</Label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">País</Label>
              <Input value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Industria</Label>
              <Input value={editForm.industry} onChange={e => setEditForm({ ...editForm, industry: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contacto</Label>
              <Input value={editForm.contact_name} onChange={e => setEditForm({ ...editForm, contact_name: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email contacto</Label>
              <Input type="email" value={editForm.contact_email} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Inicio contrato</Label>
              <Input type="date" value={editForm.contract_start} onChange={e => setEditForm({ ...editForm, contract_start: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fin contrato</Label>
              <Input type="date" value={editForm.contract_end} onChange={e => setEditForm({ ...editForm, contract_end: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={updateClient.isPending} className="gap-1.5">
              {updateClient.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                const linked = phase.epic && phase.epic in EPIC_LABEL;
                const autoPct = linked ? (epicProgress[phase.epic!] ?? 0) : phase.progress;
                return (
                  <div key={phase.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <config.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">{phase.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">{phase.startDate} — {phase.endDate}</span>
                        {/* Vínculo a épica: si está vinculada, el % es automático */}
                        <Select
                          value={phase.epic ?? "manual"}
                          onValueChange={v => handlePhaseUpdate(phase.name, "epic", v === "manual" ? null : v)}
                        >
                          <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none w-auto">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1">
                              <Link2 className="h-2.5 w-2.5" />
                              {linked ? EPIC_LABEL[phase.epic!] : "Manual"}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual (sin épica)</SelectItem>
                            {EPICS.map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
                    {linked ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${autoPct}%` }} />
                        </div>
                        <span className="text-[10px] text-primary font-medium w-14 text-right">auto {autoPct}%</span>
                      </div>
                    ) : (
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
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Épicas: % de avance por épica (calculado del backlog) + disparadores
            de facturación por HU (feedback Mafe/Eduardo). */}
        <div className="mt-4">
          <EpicsProgressPanel clientId={client.id} />
        </div>
      </motion.div>

      {/* Tabs */}
      {/* Tabs consolidados de 11 → 5 (feedback COO 30/04):
          • Quitamos "Minutas de Soporte" (no aplica a cliente implementación)
          • "Trabajo" agrupa Pipeline + Entregables + Pendientes + Riesgos como sub-tabs
          • "Minutas" agrupa Reuniones + Colaboración (comments del proyecto)
          • "Personas" agrupa Equipo Cliente (sus contactos) + Usuarios (accesos plataforma)
          • "Tareas" y "Contratos & SLA" se mantienen porque son vistas autocontenidas. */}
      <Tabs defaultValue="tareas">
        <TabsList className="h-9">
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="trabajo">Trabajo</TabsTrigger>
          <TabsTrigger value="minutas">Minutas</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="contratos">Contratos & SLA</TabsTrigger>
          <TabsTrigger value="cotizaciones">Cotizaciones</TabsTrigger>
          <TabsTrigger value="estado-cuenta">Estado de cuenta</TabsTrigger>
        </TabsList>

        {/* TAREAS — vista diaria del trabajo (lista/kanban/calendario) */}
        <TabsContent value="tareas" className="mt-3">
          <TaskViewSwitcher tasks={client.tasks} clientId={client.id} clientName={client.name} />
        </TabsContent>

        {/* TRABAJO — todo lo planificable: pipeline, entregables, pendientes, riesgos */}
        <TabsContent value="trabajo" className="mt-3">
          <Tabs defaultValue="pipeline">
            <TabsList className="h-8">
              <TabsTrigger value="pipeline" className="text-xs">Pipeline</TabsTrigger>
              <TabsTrigger value="entregables" className="text-xs">Entregables</TabsTrigger>
              <TabsTrigger value="pendientes" className="text-xs">Pendientes</TabsTrigger>
              <TabsTrigger value="riesgos" className="text-xs">Riesgos</TabsTrigger>
            </TabsList>
            <TabsContent value="pipeline" className="mt-3">
              <FunnelTab client={client} />
            </TabsContent>
            <TabsContent value="entregables" className="mt-3">
              <DeliverablesTab deliverables={client.deliverables} clientId={client.id} tasks={client.tasks} />
            </TabsContent>
            <TabsContent value="pendientes" className="mt-3">
              <ActionItemsTab actionItems={client.actionItems} clientId={client.id} tasks={client.tasks} />
            </TabsContent>
            <TabsContent value="riesgos" className="mt-3">
              <RisksTab risks={client.risks} clientId={client.id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* MINUTAS — reuniones + colaboración (comments del proyecto) */}
        <TabsContent value="minutas" className="mt-3">
          <Tabs defaultValue="reuniones">
            <TabsList className="h-8">
              <TabsTrigger value="reuniones" className="text-xs">Reuniones</TabsTrigger>
              <TabsTrigger value="colaboracion" className="text-xs">Colaboración</TabsTrigger>
            </TabsList>
            <TabsContent value="reuniones" className="mt-3">
              <MeetingMinutesTab meetingMinutes={client.meetingMinutes} clientId={client.id} client={client} />
            </TabsContent>
            <TabsContent value="colaboracion" className="mt-3">
              <CollaborationTab comments={client.comments} clientId={client.id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* PERSONAS — equipo del cliente + usuarios con acceso a la plataforma */}
        <TabsContent value="personas" className="mt-3">
          <Tabs defaultValue="equipo-cliente">
            <TabsList className="h-8">
              <TabsTrigger value="equipo-cliente" className="text-xs">Equipo Cliente</TabsTrigger>
              <TabsTrigger value="usuarios" className="text-xs">Accesos Plataforma</TabsTrigger>
              <TabsTrigger value="audiencias" className="text-xs">Audiencias notif.</TabsTrigger>
            </TabsList>
            <TabsContent value="equipo-cliente" className="mt-3">
              <ContactsTab clientId={client.id} />
            </TabsContent>
            <TabsContent value="usuarios" className="mt-3">
              <ClientUsersTab clientId={client.id} clientName={client.name} />
            </TabsContent>
            <TabsContent value="audiencias" className="mt-3">
              <ClientAudiencesPanel clientId={client.id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* CONTRATOS & SLA — vista autocontenida */}
        <TabsContent value="contratos" className="mt-3">
          <ContractsSLATab clientId={client.id} />
        </TabsContent>

        {/* COTIZACIONES — todas las del cliente (no solo del ticket actual) */}
        <TabsContent value="cotizaciones" className="mt-3">
          <QuoteList clientId={client.id} />
        </TabsContent>

        {/* ESTADO DE CUENTA — gap P2: consolidado consumo + cotizaciones + financials */}
        <TabsContent value="estado-cuenta" className="mt-3">
          <AccountStatementPanel clientId={client.id} />
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
