import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight, Loader2, Crown, Package, FileText, CheckSquare,
  User, Repeat,
} from "lucide-react";
import { useBacklogTree, type BacklogEpicNode, type BacklogFeatureNode } from "@/hooks/useBacklogTree";
import type { EpicHU } from "@/hooks/useEpics";

const STATE_TONE: Record<string, string> = {
  "Done": "bg-success/15 text-success border-success/30",
  "Doing": "bg-warning/15 text-warning border-warning/30",
  "To Do": "bg-muted text-muted-foreground border-border",
  "New": "bg-info/15 text-info border-info/30",
};

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

/** Árbol de backlog estilo Azure DevOps: Épica → Feature → HU → Task. */
export function EpicsBacklogTree({ clientId }: Props) {
  const { isLoading, tree } = useBacklogTree(clientId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

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
        <EpicRow key={epic.key} epic={epic} expanded={expanded} toggle={toggle} />
      ))}
    </div>
  );
}

function Row({
  depth, icon, title, hasChildren, expanded, onToggle, state, assigned, iteration, effort, progress, accent,
}: {
  depth: number; icon: React.ReactNode; title: string; hasChildren: boolean;
  expanded?: boolean; onToggle?: () => void;
  state?: string | null; assigned?: string | null; iteration?: string | null; effort?: number | null;
  progress: number; accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 border-b border-border/50 hover:bg-muted/40 ${accent ? "bg-muted/20" : ""}`}
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

function EpicRow({ epic, expanded, toggle }: { epic: BacklogEpicNode; expanded: Set<string>; toggle: (id: string) => void }) {
  const open = expanded.has(epic.key);
  return (
    <>
      <Row
        depth={0} accent
        icon={<Crown className="h-3.5 w-3.5 text-primary" />}
        title={`${epic.label}  ·  ${epic.done}/${epic.total} HU`}
        hasChildren={epic.features.length > 0} expanded={open} onToggle={() => toggle(epic.key)}
        progress={epic.progress}
      />
      {open && epic.features.map((f) => <FeatureRow key={f.id} feature={f} expanded={expanded} toggle={toggle} />)}
    </>
  );
}

function FeatureRow({ feature, expanded, toggle }: { feature: BacklogFeatureNode; expanded: Set<string>; toggle: (id: string) => void }) {
  const open = expanded.has(feature.id);
  return (
    <>
      <Row
        depth={1}
        icon={<Package className="h-3.5 w-3.5 text-info" />}
        title={`${feature.title}  ·  ${feature.total} HU`}
        hasChildren={feature.hus.length > 0} expanded={open} onToggle={() => toggle(feature.id)}
        progress={feature.progress}
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
            />
            {hopen && tasks.map((t) => (
              <Row
                key={t.id} depth={3}
                icon={<CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                title={t.title} hasChildren={false}
                state={t.state} assigned={t.assigned_to} iteration={t.iteration} effort={t.effort}
                progress={t.progress}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
