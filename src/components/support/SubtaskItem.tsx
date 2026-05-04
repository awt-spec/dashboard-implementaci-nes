import { useState, useEffect, useRef } from "react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  GripVertical, ChevronRight, Trash2, CalendarDays, Flag, UserCircle2,
  Pencil, Check, X, AlignLeft, 
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

import type { TicketSubtask, SubtaskPriority, SubtaskCategory } from "@/hooks/useSupportTicketDetails";
import { CATEGORY_META } from "./SubtaskList";

const CATEGORY_ORDER: SubtaskCategory[] = ["estrategia", "revision", "comercial", "backlog", "general"];

// ─── Helpers ─────────────────────────────────────────────────────────────

const PRIORITY_META: Record<SubtaskPriority, { label: string; classes: string; dot: string }> = {
  baja:    { label: "Baja",    classes: "bg-muted text-muted-foreground border-border",       dot: "bg-muted-foreground/60" },
  media:   { label: "Media",   classes: "bg-info/10 text-info border-info/30",                dot: "bg-info" },
  alta:    { label: "Alta",    classes: "bg-warning/15 text-warning border-warning/30",       dot: "bg-warning" },
  critica: { label: "Crítica", classes: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
};

const PRIORITY_ORDER: SubtaskPriority[] = ["baja", "media", "alta", "critica"];

function formatDue(iso: string | null): { label: string; tone: "overdue" | "today" | "ok" } {
  if (!iso) return { label: "", tone: "ok" };
  const d = parseISO(iso);
  const label = format(d, "d MMM", { locale: es });
  if (isPast(d) && !isToday(d)) return { label, tone: "overdue" };
  if (isToday(d)) return { label: "Hoy", tone: "today" };
  return { label, tone: "ok" };
}

// ─── Props ───────────────────────────────────────────────────────────────

interface Props {
  subtask: TicketSubtask;
  canEdit: boolean;
  memberNames: string[];
  onToggleComplete: (completed: boolean) => void;
  onUpdate: (updates: Partial<Pick<TicketSubtask, "title" | "description" | "assignee" | "due_date" | "priority" | "category">>) => void;
  onDelete: () => void;

  // Drag & drop (HTML5 nativo). Manejado por el componente padre (SubtaskList).
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}

// ─── Componente ──────────────────────────────────────────────────────────

export function SubtaskItem({
  subtask, canEdit, memberNames,
  onToggleComplete, onUpdate, onDelete,
  draggable, isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);
  const [descDraft, setDescDraft] = useState(subtask.description ?? "");

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);

  // Si la subtask cambia desde afuera (otra sesión, realtime) sincronizar drafts
  // cuando no estamos editando activamente.
  useEffect(() => { if (!editingTitle) setTitleDraft(subtask.title); }, [subtask.title, editingTitle]);
  useEffect(() => { if (!editingDesc) setDescDraft(subtask.description ?? ""); }, [subtask.description, editingDesc]);

  useEffect(() => { if (editingTitle) titleInputRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingDesc) descInputRef.current?.focus(); }, [editingDesc]);

  const prio = PRIORITY_META[subtask.priority] ?? PRIORITY_META.media;
  const due = formatDue(subtask.due_date);
  const hasMeta = !!(subtask.description || subtask.assignee || subtask.due_date);

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== subtask.title) onUpdate({ title: t });
    setEditingTitle(false);
  };
  const cancelTitle = () => { setTitleDraft(subtask.title); setEditingTitle(false); };

  const commitDesc = () => {
    const d = descDraft.trim();
    if (d !== (subtask.description ?? "")) onUpdate({ description: d || null });
    setEditingDesc(false);
  };
  const cancelDesc = () => { setDescDraft(subtask.description ?? ""); setEditingDesc(false); };

  return (
    <div
      draggable={draggable && canEdit}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={[
        "group rounded-lg border bg-card transition-all",
        isDragging ? "opacity-40" : "opacity-100",
        isDragOver ? "border-primary shadow-sm" : "border-border/60",
      ].join(" ")}
    >
      {/* Fila principal */}
      <div className="flex items-start gap-2 p-2">
        {/* Grip */}
        {canEdit && (
          <button
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
            aria-label="Arrastrar para reordenar"
            tabIndex={-1}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Checkbox */}
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={(v) => onToggleComplete(v === true)}
          disabled={!canEdit}
          className="mt-1 shrink-0"
        />

        {/* Contenido principal */}
        <div className="flex-1 min-w-0">
          {/* Título (editable inline) */}
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <Input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitTitle();
                  if (e.key === "Escape") cancelTitle();
                }}
                onBlur={commitTitle}
                className="h-7 text-sm"
              />
              <button onClick={commitTitle} className="p-1 rounded hover:bg-success/10 text-success"><Check className="h-3 w-3" /></button>
              <button onClick={cancelTitle} className="p-1 rounded hover:bg-muted"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => hasMeta && setExpanded((v) => !v)}
                className={[
                  "flex-1 text-left text-sm leading-tight py-0.5",
                  subtask.completed ? "line-through text-muted-foreground" : "",
                  hasMeta ? "cursor-pointer" : "cursor-default",
                ].join(" ")}
                title={hasMeta ? (expanded ? "Colapsar" : "Expandir") : undefined}
              >
                {hasMeta && (
                  <ChevronRight className={`inline h-3 w-3 mr-0.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
                )}
                {subtask.title}
              </button>
              {canEdit && (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Editar título"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Chips de metadata (siempre visibles cuando colapsado, breves) */}
          {!expanded && (hasMeta || subtask.category !== "general") && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {/* Categoría — siempre visible si no es "general" */}
              {subtask.category && subtask.category !== "general" && (() => {
                const cm = CATEGORY_META[subtask.category];
                return (
                  <Badge variant="outline" className={`text-[10px] h-4 px-1.5 gap-0.5 ${cm.bg} ${cm.tone} ${cm.border}`}>
                    <cm.Icon className="h-2.5 w-2.5" /> {cm.label}
                  </Badge>
                );
              })()}
              {subtask.priority !== "media" && (
                <Badge variant="outline" className={`text-[10px] h-4 px-1.5 gap-0.5 ${prio.classes}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${prio.dot}`} /> {prio.label}
                </Badge>
              )}
              {subtask.assignee && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                  <UserCircle2 className="h-2.5 w-2.5" /> {subtask.assignee}
                </Badge>
              )}
              {subtask.due_date && (
                <Badge
                  variant="outline"
                  className={[
                    "text-[10px] h-4 px-1.5 gap-0.5",
                    due.tone === "overdue" ? "bg-destructive/10 text-destructive border-destructive/30" :
                    due.tone === "today"   ? "bg-warning/15 text-warning border-warning/30" :
                                             "",
                  ].join(" ")}
                >
                  <CalendarDays className="h-2.5 w-2.5" /> {due.label}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Acciones rápidas (derecha) */}
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Categoría — naturaleza del trabajo */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-muted text-muted-foreground" title="Tipo de tarea">
                  {(() => {
                    const cm = CATEGORY_META[subtask.category || "general"];
                    return <cm.Icon className={`h-3.5 w-3.5 ${subtask.category !== "general" ? cm.tone : ""}`} />;
                  })()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {CATEGORY_ORDER.map((cat) => {
                  const cm = CATEGORY_META[cat];
                  return (
                    <DropdownMenuItem key={cat} onClick={() => onUpdate({ category: cat })} className="gap-2">
                      <cm.Icon className={`h-3 w-3 ${cm.tone}`} />
                      <span className="flex-1">{cm.label}</span>
                      {cat === (subtask.category || "general") && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Prioridad */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-muted text-muted-foreground" title="Prioridad">
                  <Flag className={`h-3.5 w-3.5 ${subtask.priority !== "media" ? prio.dot.replace("bg-", "text-") : ""}`} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PRIORITY_ORDER.map((p) => (
                  <DropdownMenuItem key={p} onClick={() => onUpdate({ priority: p })} className="gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[p].dot}`} />
                    {PRIORITY_META[p].label}
                    {p === subtask.priority && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Asignar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-muted text-muted-foreground" title="Responsable">
                  <UserCircle2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-auto">
                <DropdownMenuItem onClick={() => onUpdate({ assignee: null })} className="text-xs">
                  Sin asignar {!subtask.assignee && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {memberNames.map((name) => (
                  <DropdownMenuItem key={name} onClick={() => onUpdate({ assignee: name })} className="text-xs">
                    {name}
                    {name === subtask.assignee && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fecha */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1 rounded hover:bg-muted text-muted-foreground" title="Fecha límite">
                  <CalendarDays className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={subtask.due_date ? parseISO(subtask.due_date) : undefined}
                  onSelect={(d) => onUpdate({ due_date: d ? format(d, "yyyy-MM-dd") : null })}
                  locale={es}
                  initialFocus
                />
                {subtask.due_date && (
                  <div className="p-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onUpdate({ due_date: null })}
                      className="w-full h-7 text-xs"
                    >
                      Quitar fecha
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Descripción (abre expand y pone en modo edición) */}
            <button
              onClick={() => { setExpanded(true); setEditingDesc(true); }}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title={subtask.description ? "Editar descripción" : "Agregar descripción"}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>

            {/* Eliminar */}
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Panel expandido */}
      <Collapsible open={expanded}>
        <CollapsibleContent className="overflow-hidden">
          <div className="px-2 pb-2 pl-9 space-y-2">
            {/* Descripción */}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Descripción</label>
              {editingDesc ? (
                <div className="space-y-1.5">
                  <Textarea
                    ref={descInputRef}
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") cancelDesc();
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitDesc();
                    }}
                    placeholder="Pasos concretos, contexto, criterios de aceptación…"
                    rows={3}
                    className="text-xs resize-none"
                  />
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={commitDesc} className="h-6 text-[11px] gap-1">
                      <Check className="h-3 w-3" /> Guardar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelDesc} className="h-6 text-[11px]">
                      Cancelar
                    </Button>
                    <span className="text-[10px] text-muted-foreground ml-1">⌘/Ctrl + Enter</span>
                  </div>
                </div>
              ) : subtask.description ? (
                <button
                  onClick={() => canEdit && setEditingDesc(true)}
                  className={`block w-full text-left text-xs whitespace-pre-wrap p-2 rounded bg-muted/30 border border-border/40 ${canEdit ? "hover:bg-muted/50 cursor-text" : ""}`}
                >
                  {subtask.description}
                </button>
              ) : canEdit ? (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground italic"
                >
                  + Agregar descripción
                </button>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">Sin descripción</p>
              )}
            </div>

            {/* Metadata detallada (siempre visible en expand) */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Prioridad</label>
                <Badge variant="outline" className={`mt-0.5 text-[11px] h-5 gap-1 ${prio.classes}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${prio.dot}`} /> {prio.label}
                </Badge>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Responsable</label>
                <p className="mt-0.5 text-[11px] truncate">{subtask.assignee || <span className="text-muted-foreground italic">—</span>}</p>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Vence</label>
                <p className={`mt-0.5 text-[11px] ${
                  due.tone === "overdue" ? "text-destructive font-semibold" :
                  due.tone === "today"   ? "text-warning font-semibold" : ""
                }`}>
                  {subtask.due_date ? format(parseISO(subtask.due_date), "d MMM yyyy", { locale: es }) : <span className="text-muted-foreground italic">—</span>}
                </p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
