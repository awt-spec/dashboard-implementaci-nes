import { useState, useMemo } from "react";
import { type Client } from "@/data/projectData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle2, Clock, Ban,
  Users, Target, Zap, Eye, Filter, TrendingUp, 
  ArrowUpRight, Flame, Shield, Search, LayoutGrid, List,
  GripVertical
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface FunnelTabProps {
  client: Client;
}

interface FunnelItem {
  id: string;
  title: string;
  type: "task" | "deliverable" | "action" | "risk";
  status: string;
  stage: string;
  owner: string;
  dueDate?: string;
  priority: "alta" | "media" | "baja" | "critica";
  clientImpact: "alto" | "medio" | "bajo";
  internalImpact: "alto" | "medio" | "bajo";
  blocker?: string;
  blockerWho?: string;
  blockerSide?: "cliente" | "sysde" | "externo";
  blockerSince?: string;
  description?: string;
  originalId: string | number;
}

const STAGES = [
  { id: "identificado", label: "Identificado", icon: Eye, color: "var(--muted-foreground)", accent: "bg-muted/60", ring: "ring-muted-foreground/20", emoji: "🔍" },
  { id: "analisis", label: "Análisis", icon: Target, color: "var(--info)", accent: "bg-info/10", ring: "ring-info/20", emoji: "🔬" },
  { id: "en-progreso", label: "Progreso", icon: Clock, color: "var(--warning)", accent: "bg-warning/10", ring: "ring-warning/20", emoji: "⚡" },
  { id: "bloqueado", label: "Bloqueado", icon: Ban, color: "var(--destructive)", accent: "bg-destructive/10", ring: "ring-destructive/20", emoji: "🚫" },
  { id: "resuelto", label: "Resuelto", icon: CheckCircle2, color: "var(--success)", accent: "bg-success/10", ring: "ring-success/20", emoji: "✅" },
];

const IMPACT_COLORS: Record<string, string> = {
  alto: "text-destructive bg-destructive/10 border-destructive/20",
  medio: "text-warning bg-warning/10 border-warning/20",
  bajo: "text-success bg-success/10 border-success/20",
  critica: "text-destructive-foreground bg-destructive border-destructive",
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Shield; cls: string }> = {
  task: { label: "Tarea", icon: CheckCircle2, cls: "bg-info/10 text-info" },
  deliverable: { label: "Entregable", icon: ArrowUpRight, cls: "bg-primary/10 text-primary" },
  action: { label: "Pendiente", icon: Clock, cls: "bg-warning/10 text-warning" },
  risk: { label: "Riesgo", icon: Flame, cls: "bg-destructive/10 text-destructive" },
};

function mapTaskToStage(s: string) { return s === "completada" ? "resuelto" : s === "en-progreso" ? "en-progreso" : s === "bloqueada" ? "bloqueado" : "identificado"; }
function mapDeliverableToStage(s: string) { return s === "aprobado" ? "resuelto" : s === "entregado" ? "en-progreso" : s === "en-revision" ? "analisis" : "identificado"; }
function mapRiskToStage(s: string) { return (s === "cerrado" || s === "mitigado") ? "resuelto" : "bloqueado"; }
function calcImpact(item: any, type: string): "alto" | "medio" | "bajo" {
  if (type === "risk") return item.impact;
  const p = item.priority;
  return p === "alta" ? "alto" : p === "media" ? "medio" : "bajo";
}

export function FunnelTab({ client }: FunnelTabProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterImpact, setFilterImpact] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<FunnelItem | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const qc = useQueryClient();

  const funnelItems = useMemo<FunnelItem[]>(() => {
    const items: FunnelItem[] = [];
    for (const t of client.tasks) {
      const isBlocked = t.status === "bloqueada";
      const blockerSide: "cliente" | "sysde" | "externo" = t.owner?.toLowerCase().includes("cliente") || t.owner === client.contactName ? "cliente" : "sysde";
      items.push({ id: `t-${t.id}`, title: t.title, type: "task", status: t.status, stage: mapTaskToStage(t.status), owner: t.owner, dueDate: t.dueDate, priority: t.priority === "alta" ? "alta" : t.priority === "media" ? "media" : "baja", clientImpact: calcImpact(t, "task"), internalImpact: isBlocked ? "alto" : "medio", blocker: isBlocked ? (t.description || "Sin detalle del bloqueo") : undefined, blockerWho: isBlocked ? t.owner : undefined, blockerSide: isBlocked ? blockerSide : undefined, description: t.description, originalId: t.id });
    }
    for (const d of client.deliverables) {
      items.push({ id: `d-${d.id}`, title: d.name, type: "deliverable", status: d.status, stage: mapDeliverableToStage(d.status), owner: d.responsibleParty === "cliente" ? client.contactName : "SYSDE", dueDate: d.dueDate, priority: "media", clientImpact: d.status === "pendiente" ? "alto" : "medio", internalImpact: d.status === "pendiente" ? "alto" : "bajo", description: `${d.type} · v${d.version}`, originalId: d.id });
    }
    for (const a of client.actionItems) {
      items.push({ id: `a-${a.id}`, title: a.title, type: "action", status: a.status, stage: a.status === "completado" ? "resuelto" : a.status === "vencido" ? "bloqueado" : "en-progreso", owner: a.assignee, dueDate: a.dueDate, priority: a.priority === "alta" ? "alta" : a.priority === "media" ? "media" : "baja", clientImpact: calcImpact(a, "action"), internalImpact: a.status === "vencido" ? "alto" : "medio", blocker: a.status === "vencido" ? "Plazo vencido" : undefined, blockerWho: a.status === "vencido" ? a.assignee : undefined, blockerSide: a.status === "vencido" ? (a.responsibleParty === "cliente" ? "cliente" : "sysde") : undefined, originalId: a.id });
    }
    for (const r of client.risks) {
      items.push({ id: `r-${r.id}`, title: r.description, type: "risk", status: r.status, stage: mapRiskToStage(r.status), owner: "Gerencia SYSDE", priority: r.impact === "alto" ? "critica" : r.impact === "medio" ? "alta" : "media", clientImpact: r.impact as any, internalImpact: r.impact as any, blocker: r.status === "abierto" ? (r.mitigation || "Sin mitigación") : undefined, blockerSide: r.status === "abierto" ? "sysde" : undefined, description: r.mitigation, originalId: r.id });
    }
    return items;
  }, [client]);

  const filtered = funnelItems.filter(item => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterImpact !== "all" && item.clientImpact !== filterImpact) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.owner.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stageGroups = STAGES.map(stage => ({
    ...stage,
    items: filtered.filter(i => i.stage === stage.id).sort((a, b) => {
      const o: Record<string, number> = { alto: 0, critica: 0, medio: 1, bajo: 2 };
      return (o[a.clientImpact] ?? 2) - (o[b.clientImpact] ?? 2);
    }),
  }));

  const handleStageChange = async (item: FunnelItem, newStage: string) => {
    const table = item.type === "task" ? "tasks" : item.type === "deliverable" ? "deliverables" : item.type === "risk" ? "risks" : null;
    if (!table) return;
    const statusMaps: Record<string, Record<string, string>> = {
      tasks: { identificado: "pendiente", analisis: "pendiente", "en-progreso": "en-progreso", bloqueado: "bloqueada", resuelto: "completada" },
      deliverables: { identificado: "pendiente", analisis: "en-revision", "en-progreso": "entregado", bloqueado: "pendiente", resuelto: "aprobado" },
      risks: { identificado: "abierto", analisis: "abierto", "en-progreso": "abierto", bloqueado: "abierto", resuelto: "mitigado" },
    };
    const newStatus = statusMaps[table][newStage] || "pendiente";
    const eqVal = table === "tasks" ? (item.originalId as number) : String(item.originalId);
    const { data } = await supabase.from(table).select("id").eq("client_id", client.id).eq("original_id", eqVal).single();
    if (data) {
      await supabase.from(table).update({ status: newStatus }).eq("id", data.id);
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Movido a ${STAGES.find(s => s.id === newStage)?.label}`);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, item: FunnelItem) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (dragItem && dragItem.stage !== stageId) {
      await handleStageChange(dragItem, stageId);
    }
    setDragItem(null);
  };

  const totalItems = filtered.length;
  const blockedCount = stageGroups.find(s => s.id === "bloqueado")?.items.length || 0;
  const resolvedCount = stageGroups.find(s => s.id === "resuelto")?.items.length || 0;
  const throughputPct = totalItems > 0 ? Math.round((resolvedCount / totalItems) * 100) : 0;

  const renderItemCard = (item: FunnelItem, stage: typeof STAGES[0], _i: number) => {
    const isOpen = expandedItem === item.id;
    const tb = TYPE_CONFIG[item.type];
    const TypeIcon = tb.icon;
    const isDragging = dragItem?.id === item.id;

    return (
      <div
        key={item.id}
        draggable
        onDragStart={e => handleDragStart(e as any, item)}
        onDragEnd={() => { setDragItem(null); setDragOverStage(null); }}
        className={cn(
          "rounded-2xl border bg-card p-4 transition-all cursor-grab active:cursor-grabbing group",
          "hover:shadow-lg hover:border-primary/20",
          item.clientImpact === "alto" && "border-l-4 border-l-destructive",
          item.blocker && "ring-1 ring-destructive/20",
          isDragging && "opacity-40"
        )}
        onClick={() => setExpandedItem(isOpen ? null : item.id)}
      >
        {/* Drag handle */}
        <div className="flex items-center gap-1 mb-2 opacity-0 group-hover:opacity-60 transition-opacity">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Arrastra para mover</span>
        </div>

        {/* Header: Type badge + Title */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", tb.cls)}>
            <TypeIcon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{item.title}</p>
            <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-1.5", tb.cls)}>{tb.label}</span>
          </div>
        </div>

        {/* Impact badges */}
        <div className="flex gap-1.5 mb-3">
          <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg border", IMPACT_COLORS[item.clientImpact])}>
            👤 {item.clientImpact}
          </span>
          <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg border", IMPACT_COLORS[item.internalImpact])}>
            🏢 {item.internalImpact}
          </span>
        </div>

        {/* Blocker alert */}
        {item.blocker && (
          <div className="rounded-xl bg-destructive/5 border border-destructive/15 px-3 py-2.5 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs text-destructive font-bold">Bloqueado</span>
              {item.blockerSide && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto uppercase tracking-wide",
                  item.blockerSide === "cliente" ? "bg-warning/15 text-warning" : item.blockerSide === "sysde" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"
                )}>
                  {item.blockerSide === "cliente" ? "⏳ Cliente" : item.blockerSide === "sysde" ? "🔧 SYSDE" : "🌐 Externo"}
                </span>
              )}
            </div>
            <p className="text-xs text-destructive/80 line-clamp-2 leading-relaxed">{item.blocker}</p>
            {item.blockerWho && (
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-destructive/10">
                <Users className="h-3 w-3 text-destructive/50" />
                <span className="text-[10px] text-destructive/70 font-medium">Responsable: {item.blockerWho}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer: Owner + Date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 truncate max-w-[65%]">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium">{item.owner}</span>
          </span>
          {item.dueDate && (
            <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded-md">{item.dueDate}</span>
          )}
        </div>

        {/* Expanded move actions */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border mt-3 pt-3 space-y-3">
                {item.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                )}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Mover a</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.filter(s => s.id !== stage.id).map(s => (
                      <button
                        key={s.id}
                        onClick={e => { e.stopPropagation(); handleStageChange(item, s.id); }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border",
                          "border-border hover:border-primary/30 hover:bg-primary/5 active:scale-95 transition-all"
                        )}
                      >
                        <span>{s.emoji}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Pipeline de Gestiones</h2>
            <p className="text-xs text-muted-foreground">Arrastra tarjetas entre columnas · Priorización por impacto</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 text-xs w-44 pl-8 rounded-xl"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 text-xs w-32 rounded-xl">
              <Filter className="h-3 w-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="task">Tareas</SelectItem>
              <SelectItem value="deliverable">Entregables</SelectItem>
              <SelectItem value="action">Pendientes</SelectItem>
              <SelectItem value="risk">Riesgos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterImpact} onValueChange={setFilterImpact}>
            <SelectTrigger className="h-9 text-xs w-32 rounded-xl">
              <Zap className="h-3 w-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo impacto</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="medio">Medio</SelectItem>
              <SelectItem value="bajo">Bajo</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center bg-muted rounded-xl p-0.5">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-end gap-1 justify-between mb-3">
            {stageGroups.map((stage, i) => (
              <div key={stage.id} className="flex-1 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08, type: "spring" }}>
                  <span className="text-lg">{stage.emoji}</span>
                  <p className="text-2xl font-black text-foreground">{stage.items.length}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{stage.label}</p>
                </motion.div>
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-muted">
            {stageGroups.map((stage, i) => {
              const pct = totalItems > 0 ? (stage.items.length / totalItems) * 100 : 0;
              return (
                <motion.div
                  key={stage.id}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ backgroundColor: `hsl(${stage.color})`, width: `${Math.max(pct, 2)}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 2)}%` }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span className="font-medium">{totalItems} gestiones</span>
            <span className="flex items-center gap-3">
              {blockedCount > 0 && <span className="text-destructive font-semibold">{blockedCount} bloqueadas</span>}
              <span className="font-bold text-foreground">{throughputPct}% resuelto</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Kanban view with drag & drop */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-5 gap-3">
          {stageGroups.map(stage => (
            <div
              key={stage.id}
              className="space-y-2.5"
              onDragOver={e => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, stage.id)}
            >
              <div className={cn(
                "rounded-2xl p-3 border transition-all",
                stage.accent,
                dragOverStage === stage.id && "ring-2 ring-primary border-primary/40 scale-[1.02]"
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{stage.emoji}</span>
                  <span className="text-xs font-bold text-foreground truncate">{stage.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-2 rounded-lg font-bold">{stage.items.length}</Badge>
                </div>
              </div>
              <div className={cn(
                "space-y-2 min-h-[120px] max-h-[520px] overflow-y-auto pr-0.5 rounded-xl transition-all",
                dragOverStage === stage.id && "bg-primary/5 ring-2 ring-dashed ring-primary/20"
              )} style={{ scrollbarWidth: "thin" }}>
                {stage.items.map((item, i) => renderItemCard(item, stage, i))}
                {stage.items.length === 0 && (
                  <div className={cn(
                    "text-center py-10 rounded-2xl border border-dashed border-border transition-all",
                    dragOverStage === stage.id && "border-primary bg-primary/5"
                  )}>
                    <span className="text-2xl block mb-2">{stage.emoji}</span>
                    <p className="text-xs text-muted-foreground/60 font-medium">
                      {dragOverStage === stage.id ? "Suelta aquí" : "Arrastra aquí"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_120px_100px_100px_120px_100px] gap-3 px-4 py-3 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Gestión</span>
              <span>Tipo</span>
              <span>Etapa</span>
              <span>Impacto</span>
              <span>Responsable</span>
              <span>Fecha</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No hay gestiones que coincidan con los filtros</p>
                </div>
              ) : filtered.map((item, _i) => {
                const tb = TYPE_CONFIG[item.type];
                const TypeIcon = tb.icon;
                const stageInfo = STAGES.find(s => s.id === item.stage)!;
                const isOpen = expandedItem === item.id;

                return (
                  <div key={item.id}>
                    <div
                      className={cn(
                        "grid grid-cols-[1fr_120px_100px_100px_120px_100px] gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors items-center",
                        item.blocker && "bg-destructive/5"
                      )}
                      onClick={() => setExpandedItem(isOpen ? null : item.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", tb.cls)}>
                          <TypeIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                          {item.blocker && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="h-3 w-3 text-destructive" />
                              <span className="text-[10px] text-destructive font-medium truncate">
                                {item.blockerSide === "cliente" ? "⏳ Cliente" : item.blockerSide === "sysde" ? "🔧 SYSDE" : "Bloqueado"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg w-fit", tb.cls)}>{tb.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{stageInfo.emoji}</span>
                        <span className="text-xs text-foreground font-medium">{stageInfo.label}</span>
                      </div>
                      <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg border w-fit", IMPACT_COLORS[item.clientImpact])}>
                        {item.clientImpact}
                      </span>
                      <span className="text-xs text-muted-foreground truncate font-medium">{item.owner}</span>
                      <span className="text-xs font-mono text-muted-foreground">{item.dueDate || "—"}</span>
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 bg-muted/30 space-y-3">
                            {item.description && <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>}
                            {item.blocker && (
                              <div className="rounded-xl bg-destructive/5 border border-destructive/15 px-3 py-2">
                                <p className="text-xs text-destructive/80"><span className="font-bold">Bloqueo:</span> {item.blocker}</p>
                                {item.blockerWho && <p className="text-[10px] text-destructive/60 mt-1">Responsable: {item.blockerWho}</p>}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[10px] font-bold text-muted-foreground mr-2">Mover a:</span>
                              {STAGES.filter(s => s.id !== item.stage).map(s => (
                                <button
                                  key={s.id}
                                  onClick={e => { e.stopPropagation(); handleStageChange(item, s.id); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border hover:border-primary/30 hover:bg-primary/5 active:scale-95 transition-all"
                                >
                                  <span>{s.emoji}</span>
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
