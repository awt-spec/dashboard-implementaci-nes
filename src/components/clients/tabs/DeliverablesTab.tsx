import { useMemo, useState } from "react";
import { type Deliverable, type ClientTask } from "@/data/projectData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText, Package, Settings, GraduationCap, BarChart3,
  ChevronDown, ChevronUp, Clock, Paperclip, History, Plus, Trash2,
  Building2, Users, Search, X, Calendar, AlertTriangle, CheckCircle2,
  PackageOpen, ClipboardList, Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCreateDeliverable, useDeleteDeliverable, useUpdateDeliverable,
} from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Configuración de estados / tipos ────────────────────────────────────

type DStatus = "pendiente" | "en-revision" | "entregado" | "aprobado";
type DType = "documento" | "modulo" | "configuracion" | "capacitacion" | "reporte";

const STATUS_META: Record<DStatus, { label: string; short: string; tone: string; dot: string; Icon: typeof CheckCircle2 }> = {
  pendiente:     { label: "Pendiente",   short: "Pend.",  tone: "bg-muted/50 text-muted-foreground border-border",            dot: "bg-muted-foreground/50", Icon: ClipboardList },
  "en-revision": { label: "En revisión", short: "Rev.",   tone: "bg-warning/15 text-warning border-warning/30",                dot: "bg-warning",             Icon: Eye },
  entregado:     { label: "Entregado",   short: "Entr.",  tone: "bg-info/15 text-info border-info/30",                         dot: "bg-info",                Icon: PackageOpen },
  aprobado:      { label: "Aprobado",    short: "Aprob.", tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",    dot: "bg-emerald-500",         Icon: CheckCircle2 },
};

const TYPE_META: Record<DType, { label: string; Icon: typeof FileText }> = {
  documento:     { label: "Documento",     Icon: FileText },
  modulo:        { label: "Módulo",        Icon: Package },
  configuracion: { label: "Configuración", Icon: Settings },
  capacitacion:  { label: "Capacitación",  Icon: GraduationCap },
  reporte:       { label: "Reporte",       Icon: BarChart3 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

function daysUntil(s?: string | null): number | null {
  if (!s) return null;
  const d = new Date(s).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

interface DeliverablesTabProps {
  deliverables: Deliverable[];
  clientId: string;
  tasks?: ClientTask[];
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function DeliverablesTab({ deliverables, clientId, tasks = [] }: DeliverablesTabProps) {
  const [statusFilter, setStatusFilter] = useState<DStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const deleteDeliverable = useDeleteDeliverable();
  const updateDeliverable = useUpdateDeliverable();

  // ─── Stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const c = { total: deliverables.length, pendiente: 0, "en-revision": 0, entregado: 0, aprobado: 0 };
    deliverables.forEach((d) => {
      if (d.status in c) (c as any)[d.status] += 1;
    });
    return c;
  }, [deliverables]);

  const pctApproved = stats.total > 0 ? Math.round((stats.aprobado / stats.total) * 100) : 0;

  // ─── Filter ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deliverables.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q);
    });
  }, [deliverables, statusFilter, search]);

  // ─── Mutations ─────────────────────────────────────────────────────────
  const handleDelete = async (d: Deliverable) => {
    if (!confirm(`¿Eliminar "${d.name}"?`)) return;
    const { data } = await supabase
      .from("deliverables").select("id")
      .eq("client_id", clientId).eq("original_id", d.id).single();
    if (!data) return;
    deleteDeliverable.mutate(data.id, {
      onSuccess: () => toast.success("Eliminado"),
      onError: () => toast.error("Error al eliminar"),
    });
  };

  const handleStatusChange = async (d: Deliverable, newSt: string) => {
    const { data } = await supabase
      .from("deliverables").select("id")
      .eq("client_id", clientId).eq("original_id", d.id).single();
    if (!data) return;
    const updates: Record<string, unknown> = { status: newSt };
    if (newSt === "entregado") updates.delivered_date = new Date().toISOString().slice(0, 10);
    updateDeliverable.mutate({ id: data.id, updates }, {
      onSuccess: () => toast.success("Estado actualizado"),
    });
  };

  const getLinkedTaskTitle = (linkedId?: number) => {
    if (!linkedId) return null;
    const t = tasks.find((t) => t.id === linkedId);
    return t ? `#${t.id} · ${t.title}` : `#${linkedId}`;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* ════════ HERO ════════ */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-4">
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                  Entregables del proyecto
                </p>
                <h2 className="text-lg font-black leading-tight mt-0.5">
                  {stats.total === 0 ? "Sin entregables" : `${stats.total} entregable${stats.total === 1 ? "" : "s"}`}
                </h2>
                {stats.total > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-bold text-emerald-500">{stats.aprobado}</span> aprobados de {stats.total}
                  </p>
                )}
              </div>
            </div>
            <CreateDeliverableDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              clientId={clientId}
              tasks={tasks}
            />
          </div>

          {/* Progress bar % aprobado */}
          {stats.total > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Progress value={pctApproved} className="h-1.5 flex-1" />
              <span className="text-[10px] tabular-nums font-bold text-emerald-500">{pctApproved}%</span>
            </div>
          )}

          {/* Stats por estado — clickables = filtros */}
          {stats.total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/40">
              {(Object.keys(STATUS_META) as DStatus[]).map((k) => {
                const m = STATUS_META[k];
                const n = (stats as any)[k] || 0;
                const active = statusFilter === k;
                return (
                  <button
                    key={k}
                    onClick={() => setStatusFilter(active ? "all" : k)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-left transition-all",
                      active
                        ? "border-primary bg-primary/[0.06] ring-2 ring-primary/30"
                        : "border-border/50 hover:border-primary/40 hover:bg-muted/20"
                    )}
                  >
                    <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0 border", m.tone)}>
                      <m.Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-black tabular-nums leading-none">{n}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{m.short}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ════════ TOOLBAR ════════ */}
        {deliverables.length > 3 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar entregable…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9 h-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded hover:bg-muted/60 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {statusFilter !== "all" && (
              <Badge
                variant="outline"
                className={cn("gap-1 h-8 px-2 cursor-pointer", STATUS_META[statusFilter].tone)}
                onClick={() => setStatusFilter("all")}
              >
                {STATUS_META[statusFilter].label} <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}

        {/* ════════ LISTA ════════ */}
        {deliverables.length === 0 ? (
          <Card className="border-dashed border-2 border-primary/30 bg-primary/[0.02]">
            <CardContent className="py-10 text-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
                <Package className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">Aún no hay entregables</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Documentos, módulos, configuraciones, capacitaciones y reportes que SYSDE entrega al cliente.
                </p>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 mt-2">
                <Plus className="h-3.5 w-3.5" /> Crear primer entregable
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <Search className="h-7 w-7 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">Sin resultados</p>
              <Button
                size="sm" variant="outline"
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
                className="h-7 text-[11px]"
              >
                Limpiar filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((d) => (
                <DeliverableCard
                  key={d.id}
                  d={d}
                  expanded={expandedId === d.id}
                  onToggleExpand={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  onStatusChange={(s) => handleStatusChange(d, s)}
                  onDelete={() => handleDelete(d)}
                  getLinkedTaskTitle={getLinkedTaskTitle}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CARD DE UN ENTREGABLE — limpia y compacta
// ═══════════════════════════════════════════════════════════════════════════

function DeliverableCard({
  d,
  expanded,
  onToggleExpand,
  onStatusChange,
  onDelete,
  getLinkedTaskTitle,
}: {
  d: Deliverable;
  expanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (s: string) => void;
  onDelete: () => void;
  getLinkedTaskTitle: (id?: number) => string | null;
}) {
  const tMeta = TYPE_META[d.type] || TYPE_META.documento;
  const sMeta = STATUS_META[d.status as DStatus] || STATUS_META.pendiente;
  const hasDetail = !!d.detail;
  const rp = (d as any).responsibleParty as string | undefined;
  const rt = (d as any).responsibleTeam as string | undefined;
  const lt = (d as any).linkedTaskId as number | undefined;

  const days = daysUntil(d.dueDate);
  const isOverdue = days !== null && days < 0 && d.status !== "entregado" && d.status !== "aprobado";
  const isUrgent = days !== null && days >= 0 && days <= 3 && d.status !== "entregado" && d.status !== "aprobado";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
    >
      <Card className={cn(
        "group relative overflow-hidden border-border hover:border-primary/40 transition-all",
        isOverdue && "border-l-4 border-l-destructive",
        !isOverdue && isUrgent && "border-l-4 border-l-warning"
      )}>
        <div className="p-3 flex items-center gap-3">
          {/* Icono tipo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-9 w-9 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                <tMeta.Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>{tMeta.label}</TooltipContent>
          </Tooltip>

          {/* Info principal */}
          <button
            onClick={hasDetail ? onToggleExpand : undefined}
            className={cn(
              "flex-1 min-w-0 text-left",
              hasDetail ? "cursor-pointer" : "cursor-default"
            )}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold truncate">{d.name}</p>
              <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">v{d.version}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
              <span className={cn(
                "flex items-center gap-1",
                isOverdue && "text-destructive font-semibold",
                isUrgent && "text-warning font-semibold"
              )}>
                <Calendar className="h-2.5 w-2.5" />
                {fmtDate(d.dueDate)}
                {isOverdue && <span className="ml-1">(+{Math.abs(days!)}d)</span>}
                {isUrgent && days !== null && <span className="ml-1">({days}d)</span>}
              </span>
              {d.deliveredDate && (
                <span className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {fmtDate(d.deliveredDate)}
                </span>
              )}
              {rp && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn(
                      "flex items-center gap-1",
                      rp === "sysde" || rp === "cisde" ? "text-primary" : "text-warning"
                    )}>
                      {rp === "sysde" || rp === "cisde" ? <Building2 className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
                      {rp === "sysde" || rp === "cisde" ? "SYSDE" : "Cliente"}
                      {rt && ` · ${rt}`}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Responsable</TooltipContent>
                </Tooltip>
              )}
              {lt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-muted-foreground/70">
                      <Paperclip className="h-2.5 w-2.5" /> #{lt}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{getLinkedTaskTitle(lt)}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </button>

          {/* Status select */}
          <Select value={d.status} onValueChange={onStatusChange}>
            <SelectTrigger className={cn(
              "h-7 w-auto gap-1 text-[11px] border px-2 shrink-0",
              sMeta.tone
            )}>
              <span className="flex items-center gap-1">
                <sMeta.Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{sMeta.short}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_META) as DStatus[]).map((k) => {
                const m = STATUS_META[k];
                return (
                  <SelectItem key={k} value={k} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", m.dot)} />
                      {m.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar</TooltipContent>
            </Tooltip>
          </div>

          {/* Expand chevron — sólo si hay detalle */}
          {hasDetail && (
            <button onClick={onToggleExpand} className="h-6 w-6 rounded hover:bg-muted/60 flex items-center justify-center shrink-0">
              {expanded
                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          )}
        </div>

        {/* Detalle expandible */}
        <AnimatePresence>
          {expanded && d.detail && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 border-t border-border/60 pt-3 space-y-3">
                {d.detail.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{d.detail.description}</p>
                )}

                {/* Métricas inline */}
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> <span className="font-bold tabular-nums">{d.detail.hoursInvested}h</span> invertidas
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Paperclip className="h-3 w-3" /> {d.detail.attachments.length} archivo{d.detail.attachments.length === 1 ? "" : "s"}
                  </span>
                </div>

                {d.detail.reviewNotes && (
                  <div className="bg-warning/5 border border-warning/20 rounded-lg p-2.5 flex gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-warning uppercase tracking-wider mb-0.5">Notas de revisión</p>
                      <p className="text-xs text-muted-foreground">{d.detail.reviewNotes}</p>
                    </div>
                  </div>
                )}

                {d.detail.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {d.detail.attachments.map((a) => (
                      <span key={a} className="flex items-center gap-1 bg-secondary/50 rounded px-2 py-1 text-[11px]">
                        <Paperclip className="h-3 w-3 text-muted-foreground" /> {a}
                      </span>
                    ))}
                  </div>
                )}

                {d.detail.history.length > 0 && (
                  <div className="border-t border-border/40 pt-2 space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Historial</p>
                    {d.detail.history.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <History className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground tabular-nums">{h.date}</span>
                        <span className="text-foreground font-medium">{h.action}</span>
                        <span className="text-muted-foreground">— {h.by}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE DIALOG — quick-add con "más opciones"
// ═══════════════════════════════════════════════════════════════════════════

function CreateDeliverableDialog({
  open,
  onOpenChange,
  clientId,
  tasks,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  tasks: ClientTask[];
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DType>("documento");
  const [status, setStatus] = useState<DStatus>("pendiente");
  const [dueDate, setDueDate] = useState("");
  const [responsible, setResponsible] = useState<"sysde" | "cliente">("sysde");
  const [team, setTeam] = useState("");
  const [linkedTask, setLinkedTask] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const createDeliverable = useCreateDeliverable();

  const reset = () => {
    setName(""); setType("documento"); setStatus("pendiente"); setDueDate("");
    setResponsible("sysde"); setTeam(""); setLinkedTask(""); setShowAdvanced(false);
  };

  const handleCreate = () => {
    if (!name.trim() || !dueDate) {
      toast.error("Nombre y fecha son obligatorios");
      return;
    }
    createDeliverable.mutate({
      client_id: clientId,
      original_id: `D-${Date.now()}`,
      name: name.trim(),
      type,
      status,
      due_date: dueDate,
      version: "1.0",
      responsible_party: responsible,
      responsible_team: responsible === "sysde" && team.trim() ? team.trim() : undefined,
      linked_task_id: linkedTask ? Number(linkedTask) : undefined,
    }, {
      onSuccess: () => {
        toast.success("Entregable creado");
        reset();
        onOpenChange(false);
      },
      onError: () => toast.error("Error al crear"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 h-8 text-xs shadow-md shadow-primary/20">
          <Plus className="h-3.5 w-3.5" /> Nuevo entregable
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Nuevo entregable
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Documento de arquitectura v2"
              className="h-10 text-sm"
              autoFocus
            />
          </div>

          {/* Tipo — picker visual */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Tipo</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(TYPE_META) as DType[]).map((k) => {
                const m = TYPE_META[k];
                const active = type === k;
                return (
                  <Tooltip key={k}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setType(k)}
                        className={cn(
                          "h-12 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all",
                          active
                            ? "border-primary bg-primary/[0.06] ring-2 ring-primary/30 text-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted/20 text-muted-foreground"
                        )}
                      >
                        <m.Icon className="h-4 w-4" />
                        <span className="text-[9px] font-semibold">{m.label.slice(0, 6)}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{m.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Fecha límite */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Fecha límite *</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          {/* Más opciones (collapsible) */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showAdvanced ? "Menos opciones" : "Más opciones"}
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  {/* Estado */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Estado inicial</Label>
                    <div className="grid grid-cols-4 gap-1">
                      {(Object.keys(STATUS_META) as DStatus[]).map((k) => {
                        const m = STATUS_META[k];
                        const active = status === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setStatus(k)}
                            className={cn(
                              "h-8 rounded-md border text-[10px] flex items-center justify-center gap-1 transition-all",
                              active
                                ? cn("ring-2 ring-primary/30", m.tone, "border-primary")
                                : "border-border hover:bg-muted/20 text-muted-foreground"
                            )}
                          >
                            <m.Icon className="h-3 w-3" />
                            {m.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Responsable */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Responsable</Label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setResponsible("sysde")}
                          className={cn(
                            "h-8 rounded-md border text-[11px] flex items-center justify-center gap-1 transition-all",
                            responsible === "sysde"
                              ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                              : "border-border hover:bg-muted/20 text-muted-foreground"
                          )}
                        >
                          <Building2 className="h-3 w-3" /> SYSDE
                        </button>
                        <button
                          type="button"
                          onClick={() => setResponsible("cliente")}
                          className={cn(
                            "h-8 rounded-md border text-[11px] flex items-center justify-center gap-1 transition-all",
                            responsible === "cliente"
                              ? "border-warning bg-warning/10 text-warning ring-2 ring-warning/30"
                              : "border-border hover:bg-muted/20 text-muted-foreground"
                          )}
                        >
                          <Users className="h-3 w-3" /> Cliente
                        </button>
                      </div>
                    </div>
                    {responsible === "sysde" && (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Equipo</Label>
                        <Input
                          value={team}
                          onChange={(e) => setTeam(e.target.value)}
                          placeholder="Equipo Técnico"
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Vincular tarea */}
                  {tasks.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Vincular a tarea</Label>
                      <Select value={linkedTask || "none"} onValueChange={(v) => setLinkedTask(v === "none" ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">Sin vincular</SelectItem>
                          {tasks.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                              #{t.id} — {t.title.slice(0, 40)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={createDeliverable.isPending} className="gap-2">
            {createDeliverable.isPending ? "Creando…" : <><Plus className="h-3.5 w-3.5" /> Crear</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
