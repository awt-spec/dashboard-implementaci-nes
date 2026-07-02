import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronRight, Loader2, Crown, Package, FileText, CheckSquare,
  User, Repeat, Plus, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useBacklogTree, useUpsertBacklogItem, useDeleteBacklogItem,
  type BacklogEpicNode, type BacklogFeatureNode, type BacklogItemInput,
} from "@/hooks/useBacklogTree";
import type { EpicHU } from "@/hooks/useEpics";

const STATE_TONE: Record<string, string> = {
  "Done": "bg-success/15 text-success border-success/30",
  "Doing": "bg-warning/15 text-warning border-warning/30",
  "To Do": "bg-muted text-muted-foreground border-border",
  "New": "bg-info/15 text-info border-info/30",
};
const TASK_STATES = ["To Do", "Doing", "Done"];

function huState(h: EpicHU): string {
  if (h.done) return "Done";
  if (h.status === "en-progreso" || h.scrum_status === "in_progress" || h.scrum_status === "in_sprint") return "Doing";
  return "To Do";
}

function Bar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5 w-24">
      <Progress value={value} className="h-1.5 flex-1" />
      <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

interface Props {
  clientId: string;
}

/** Árbol de backlog estilo Azure DevOps: Épica → Feature → HU → Task, con CRUD
 *  de Features y Tasks (crear/editar/eliminar). */
export function EpicsBacklogTree({ clientId }: Props) {
  const { isLoading, tree } = useBacklogTree(clientId);
  const { role } = useAuth();
  const canManage = !!role && role !== "cliente";
  const upsert = useUpsertBacklogItem(clientId);
  const del = useDeleteBacklogItem(clientId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<BacklogItemInput | null>(null);

  const toggle = (id: string) => setExpanded((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const save = () => {
    if (!dialog) return;
    if (!dialog.title.trim()) { toast.error("El título es requerido"); return; }
    upsert.mutate(dialog, {
      onSuccess: () => { toast.success(dialog.id ? "Actualizado" : "Creado"); setDialog(null); },
      onError: (e: any) => toast.error(e?.message || "Error al guardar"),
    });
  };
  const remove = (id: string, label: string) => {
    if (!confirm(`¿Eliminar "${label}"?`)) return;
    del.mutate(id, { onSuccess: () => toast.success("Eliminado"), onError: (e: any) => toast.error(e?.message || "Error al eliminar") });
  };

  const newFeature = (epicKey: string) => setDialog({ client_id: clientId, item_type: "feature", epic: epicKey, title: "" });
  const newTask = (huId: string) => setDialog({ client_id: clientId, item_type: "task", parent_hu_id: huId, title: "", state: "To Do" });

  if (isLoading) {
    return <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (tree.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-4 px-2">No hay backlog para este cliente.</p>;
  }

  return (
    <div className="text-xs">
      {/* Encabezado de columnas */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        <span className="flex-1">Elemento</span>
        <span className="w-20 shrink-0">Estado</span>
        <span className="w-32 shrink-0 hidden md:block">Asignado</span>
        <span className="w-20 shrink-0 hidden lg:block">Iteración</span>
        <span className="w-10 shrink-0 text-right hidden sm:block">Esf.</span>
        <span className="w-24 shrink-0 text-right">Progreso</span>
      </div>

      {tree.map((epic) => (
        <EpicRow
          key={epic.key} epic={epic} expanded={expanded} toggle={toggle}
          canManage={canManage}
          onAddFeature={() => newFeature(epic.key)}
          onEditFeature={(f) => setDialog({ id: f.id, client_id: clientId, item_type: "feature", epic: epic.key, title: f.title })}
          onDeleteFeature={(f) => remove(f.id, f.title)}
          onAddTask={newTask}
          onEditTask={(t) => setDialog({ id: t.id, client_id: clientId, item_type: "task", title: t.title, state: t.state, assigned_to: t.assigned_to, iteration: t.iteration, effort: t.effort })}
          onDeleteTask={(t) => remove(t.id, t.title)}
        />
      ))}

      {/* Dialogo crear/editar Feature o Task */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.id ? "Editar" : "Nuevo"} {dialog?.item_type === "feature" ? "Feature" : "Tarea"}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Título *</Label>
                <Input value={dialog.title} onChange={(e) => setDialog({ ...dialog, title: e.target.value })} className="h-9" autoFocus />
              </div>
              {dialog.item_type === "task" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Estado</Label>
                      <Select value={dialog.state ?? "To Do"} onValueChange={(v) => setDialog({ ...dialog, state: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{TASK_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Esfuerzo</Label>
                      <Input type="number" step="1" value={dialog.effort ?? ""} onChange={(e) => setDialog({ ...dialog, effort: e.target.value ? parseFloat(e.target.value) : null })} className="h-9" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Asignado</Label>
                      <Input value={dialog.assigned_to ?? ""} onChange={(e) => setDialog({ ...dialog, assigned_to: e.target.value })} className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Iteración</Label>
                      <Input value={dialog.iteration ?? ""} onChange={(e) => setDialog({ ...dialog, iteration: e.target.value })} className="h-9" placeholder="Sprint 3" />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  depth, icon, title, hasChildren, expanded, onToggle, state, assigned, iteration, effort, progress, accent, actions,
}: {
  depth: number; icon: React.ReactNode; title: string; hasChildren: boolean;
  expanded?: boolean; onToggle?: () => void;
  state?: string | null; assigned?: string | null; iteration?: string | null; effort?: number | null;
  progress: number; accent?: boolean; actions?: React.ReactNode;
}) {
  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 border-b border-border/50 hover:bg-muted/40 ${accent ? "bg-muted/20" : ""}`}
      style={{ paddingLeft: 8 + depth * 18 }}
    >
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        {hasChildren ? (
          <button onClick={onToggle} className="shrink-0 p-0.5 hover:bg-muted rounded">
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : <span className="w-[18px] shrink-0" />}
        <span className="shrink-0">{icon}</span>
        <span className={`truncate ${accent ? "font-semibold" : ""}`}>{title}</span>
        {actions && <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">{actions}</span>}
      </div>
      <span className="w-20 shrink-0">
        {state ? <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${STATE_TONE[state] ?? ""}`}>{state}</Badge> : null}
      </span>
      <span className="w-32 shrink-0 hidden md:flex items-center gap-1 text-muted-foreground truncate">
        {assigned ? <><User className="h-3 w-3 shrink-0" /><span className="truncate">{assigned}</span></> : null}
      </span>
      <span className="w-20 shrink-0 hidden lg:flex items-center gap-1 text-muted-foreground truncate">
        {iteration ? <><Repeat className="h-3 w-3 shrink-0" /><span className="truncate">{iteration}</span></> : null}
      </span>
      <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground hidden sm:block">
        {effort != null ? effort : ""}
      </span>
      <span className="w-24 shrink-0 flex justify-end"><Bar value={progress} /></span>
    </div>
  );
}

const IconBtn = ({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={title} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
    {children}
  </button>
);

interface TreeHandlers {
  canManage: boolean;
  onAddFeature: () => void;
  onEditFeature: (f: BacklogFeatureNode) => void;
  onDeleteFeature: (f: BacklogFeatureNode) => void;
  onAddTask: (huId: string) => void;
  onEditTask: (t: { id: string; title: string; state: string | null; assigned_to: string | null; iteration: string | null; effort: number | null }) => void;
  onDeleteTask: (t: { id: string; title: string }) => void;
}

function EpicRow({ epic, expanded, toggle, ...h }: { epic: BacklogEpicNode; expanded: Set<string>; toggle: (id: string) => void } & TreeHandlers) {
  const open = expanded.has(epic.key);
  return (
    <>
      <Row
        depth={0} accent
        icon={<Crown className="h-3.5 w-3.5 text-primary" />}
        title={`${epic.label}  ·  ${epic.done}/${epic.total} HU`}
        hasChildren={epic.features.length > 0} expanded={open} onToggle={() => toggle(epic.key)}
        progress={epic.progress}
        actions={h.canManage ? <IconBtn onClick={h.onAddFeature} title="Agregar Feature"><Plus className="h-3 w-3" /></IconBtn> : undefined}
      />
      {open && epic.features.map((f) => <FeatureRow key={f.id} feature={f} expanded={expanded} toggle={toggle} {...h} />)}
    </>
  );
}

function FeatureRow({ feature, expanded, toggle, ...h }: { feature: BacklogFeatureNode; expanded: Set<string>; toggle: (id: string) => void } & TreeHandlers) {
  const open = expanded.has(feature.id);
  return (
    <>
      <Row
        depth={1}
        icon={<Package className="h-3.5 w-3.5 text-info" />}
        title={`${feature.title}  ·  ${feature.total} HU`}
        hasChildren={feature.hus.length > 0} expanded={open} onToggle={() => toggle(feature.id)}
        progress={feature.progress}
        actions={h.canManage ? (
          <>
            <IconBtn onClick={() => h.onEditFeature(feature)} title="Editar Feature"><Pencil className="h-3 w-3" /></IconBtn>
            <IconBtn onClick={() => h.onDeleteFeature(feature)} title="Eliminar Feature"><Trash2 className="h-3 w-3" /></IconBtn>
          </>
        ) : undefined}
      />
      {open && feature.hus.map(({ hu, tasks }) => {
        const hid = `hu-${hu.id}`;
        const hopen = expanded.has(hid);
        const hp = hu.done ? 100 : hu.status === "en-progreso" ? 50 : 0;
        return (
          <div key={hu.id}>
            <Row
              depth={2}
              icon={<FileText className="h-3.5 w-3.5 text-warning" />}
              title={`${hu.hu_code ? hu.hu_code + " · " : ""}${hu.title}`}
              hasChildren={tasks.length > 0} expanded={hopen} onToggle={() => toggle(hid)}
              state={huState(hu)} assigned={hu.owner} effort={hu.story_points} progress={hp}
              actions={h.canManage ? <IconBtn onClick={() => h.onAddTask(hu.id)} title="Agregar Tarea"><Plus className="h-3 w-3" /></IconBtn> : undefined}
            />
            {hopen && tasks.map((t) => (
              <Row
                key={t.id} depth={3}
                icon={<CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                title={t.title} hasChildren={false}
                state={t.state} assigned={t.assigned_to} iteration={t.iteration} effort={t.effort}
                progress={t.progress}
                actions={h.canManage ? (
                  <>
                    <IconBtn onClick={() => h.onEditTask(t)} title="Editar Tarea"><Pencil className="h-3 w-3" /></IconBtn>
                    <IconBtn onClick={() => h.onDeleteTask(t)} title="Eliminar Tarea"><Trash2 className="h-3 w-3" /></IconBtn>
                  </>
                ) : undefined}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
