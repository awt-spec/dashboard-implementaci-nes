/**
 * SubtaskList — gestión de subtareas con categorías.
 *
 * Categorías:
 *   • estrategia → planificación, decisiones, próximos pasos (Target violet)
 *   • revision   → QA, code review, validación (Eye blue)
 *   • comercial  → upsell, escalamiento comercial (DollarSign emerald)
 *   • backlog    → ítem del backlog del equipo (Layers amber)
 *   • general    → genérica, default (Circle gray)
 *
 * Vista:
 *   - Toolbar: search + filtro categoría (chips) + view mode (lista/agrupada)
 *   - Lista: cards una abajo de la otra
 *   - Agrupada: secciones por categoría
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Plus, ListChecks, Circle, CheckCircle2, Search, X,
  Target, Eye, DollarSign, Layers, Tag, LayoutList, LayoutGrid,
  Flag, UserCircle2, CalendarDays, AlignLeft,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  useTicketSubtasks, useCreateTicketSubtask, useToggleTicketSubtask,
  useUpdateTicketSubtask, useDeleteTicketSubtask, useReorderTicketSubtasks,
  type TicketSubtask, type SubtaskCategory, type SubtaskPriority,
} from "@/hooks/useSupportTicketDetails";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { SubtaskItem } from "./SubtaskItem";
import { cn } from "@/lib/utils";

// ─── Meta de categorías ───────────────────────────────────────────────────

export const CATEGORY_META: Record<SubtaskCategory, {
  label: string;
  Icon: typeof Target;
  tone: string;
  bg: string;
  border: string;
  hint: string;
}> = {
  estrategia: {
    label: "Estrategia",
    Icon: Target,
    tone: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    hint: "Planificación, decisiones, próximos pasos del caso",
  },
  revision: {
    label: "Revisión",
    Icon: Eye,
    tone: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    hint: "QA, code review, validación con cliente",
  },
  comercial: {
    label: "Comercial",
    Icon: DollarSign,
    tone: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    hint: "Upsell, escalamiento comercial, cobranza, contrato",
  },
  backlog: {
    label: "Backlog",
    Icon: Layers,
    tone: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    hint: "Ítem del backlog del equipo (scrum) que afecta este caso",
  },
  general: {
    label: "General",
    Icon: Circle,
    tone: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    hint: "Tarea genérica del caso",
  },
};

const CATEGORY_ORDER: SubtaskCategory[] = ["estrategia", "revision", "comercial", "backlog", "general"];

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  ticketId: string;
  canEdit: boolean;
}

type StatusFilter = "todas" | "pendientes" | "completadas";
type ViewMode = "list" | "grouped";

// ─── Componente ───────────────────────────────────────────────────────────

export function SubtaskList({ ticketId, canEdit }: Props) {
  const { data: subtasks = [], isLoading } = useTicketSubtasks(ticketId);
  const { data: members = [] } = useSysdeTeamMembers();
  const memberNames = useMemo(() => (members as any[]).map((m) => m.name).filter(Boolean), [members]);

  const create = useCreateTicketSubtask();
  const toggle = useToggleTicketSubtask();
  const update = useUpdateTicketSubtask();
  const del = useDeleteTicketSubtask();
  const reorder = useReorderTicketSubtasks();

  // Estado del creator
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<SubtaskCategory>("general");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<SubtaskPriority>("media");
  const [newAssignee, setNewAssignee] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [detailedMode, setDetailedMode] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [categoryFilter, setCategoryFilter] = useState<SubtaskCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ─── Stats ─────────────────────────────────────────────────────────────
  const done = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const countsByCategory = useMemo(() => {
    const c: Record<SubtaskCategory, { total: number; pending: number }> = {
      estrategia: { total: 0, pending: 0 },
      revision:   { total: 0, pending: 0 },
      comercial:  { total: 0, pending: 0 },
      backlog:    { total: 0, pending: 0 },
      general:    { total: 0, pending: 0 },
    };
    subtasks.forEach((s) => {
      const cat = (s.category || "general") as SubtaskCategory;
      c[cat].total += 1;
      if (!s.completed) c[cat].pending += 1;
    });
    return c;
  }, [subtasks]);

  // ─── Filtrado ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subtasks.filter((s) => {
      // status
      if (statusFilter === "pendientes" && s.completed) return false;
      if (statusFilter === "completadas" && !s.completed) return false;
      // category
      if (categoryFilter !== "all" && (s.category || "general") !== categoryFilter) return false;
      // search
      if (q && !s.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subtasks, statusFilter, categoryFilter, search]);

  // Agrupado por categoría
  const groupedByCategory = useMemo(() => {
    const groups: Record<SubtaskCategory, TicketSubtask[]> = {
      estrategia: [], revision: [], comercial: [], backlog: [], general: [],
    };
    filtered.forEach((s) => {
      const cat = (s.category || "general") as SubtaskCategory;
      groups[cat].push(s);
    });
    return CATEGORY_ORDER
      .map((cat) => ({ category: cat, items: groups[cat] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  // ─── Handlers ──────────────────────────────────────────────────────────
  const resetCreator = (keepCategory = true) => {
    setNewTitle("");
    setNewDescription("");
    setNewPriority("media");
    setNewAssignee(null);
    setNewDueDate(null);
    if (!keepCategory) setNewCategory("general");
    setDetailedMode(false);
  };

  const handleAdd = (closeAfter = true) => {
    const t = newTitle.trim();
    if (!t) return;
    create.mutate(
      {
        ticket_id: ticketId,
        title: t,
        sort_order: subtasks.length,
        priority: newPriority,
        category: newCategory,
        description: newDescription.trim() || null,
        assignee: newAssignee,
        due_date: newDueDate ? newDueDate.toISOString().slice(0, 10) : null,
      },
      {
        onSuccess: () => {
          if (closeAfter) {
            // Mantener categoría — facilita crear varias del mismo tipo
            resetCreator(true);
          } else {
            // Solo limpiar título para seguir creando rápido
            setNewTitle("");
          }
          toast.success("Subtarea creada");
        },
        onError: (e: any) => toast.error(e?.message || "No se pudo crear la subtarea"),
      }
    );
  };

  const handleDragStart = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch { /* noop */ }
  };

  const handleDragOver = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDragLeave = (id: string) => (_e: React.DragEvent<HTMLDivElement>) => {
    if (dragOverId === id) setDragOverId(null);
  };

  const handleDrop = (targetId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { cleanupDrag(); return; }

    const srcIdx = subtasks.findIndex((s) => s.id === draggingId);
    const tgtIdx = subtasks.findIndex((s) => s.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) { cleanupDrag(); return; }

    const next = [...subtasks];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, moved);

    reorder.mutate(
      { ticket_id: ticketId, order: next.map((s) => s.id) },
      { onError: (err: any) => toast.error(err?.message || "No se pudo reordenar") }
    );
    cleanupDrag();
  };

  const cleanupDrag = () => { setDraggingId(null); setDragOverId(null); };

  const renderItem = (s: TicketSubtask, allowDrag: boolean) => (
    <SubtaskItem
      key={s.id}
      subtask={s}
      canEdit={canEdit}
      memberNames={memberNames}
      draggable={allowDrag}
      isDragging={draggingId === s.id}
      isDragOver={dragOverId === s.id}
      onDragStart={handleDragStart(s.id)}
      onDragOver={handleDragOver(s.id)}
      onDragLeave={handleDragLeave(s.id)}
      onDrop={handleDrop(s.id)}
      onDragEnd={cleanupDrag}
      onToggleComplete={(completed) =>
        toggle.mutate({ id: s.id, completed, ticket_id: ticketId })
      }
      onUpdate={(updates) =>
        update.mutate(
          { id: s.id, ticket_id: ticketId, updates },
          { onError: (err: any) => toast.error(err?.message || "No se pudo actualizar") }
        )
      }
      onDelete={() =>
        del.mutate(
          { id: s.id, ticket_id: ticketId },
          {
            onSuccess: () => toast.success("Subtarea eliminada"),
            onError: (err: any) => toast.error(err?.message || "No se pudo eliminar"),
          }
        )
      }
    />
  );

  const hasFilters = statusFilter !== "todas" || categoryFilter !== "all" || search.trim().length > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* ════════ HEADER: progreso + nuevo con categoría ════════ */}
        <Card>
          <CardContent className="p-3 space-y-2.5">
            <div className="flex items-center gap-2 text-xs">
              <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold">{done} de {total} completadas</span>
              {total > 0 && (
                <>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-muted-foreground tabular-nums">{pct}%</span>
                </>
              )}
            </div>

            {canEdit && (
              <div className="space-y-2">
                {/* Input + add buttons */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={detailedMode ? "Título de la subtarea…" : "Nueva subtarea (Enter para agregar rápido)…"}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !detailedMode) handleAdd();
                    }}
                    className="h-8 text-sm flex-1"
                  />
                  {!detailedMode ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleAdd()}
                        disabled={!newTitle.trim() || create.isPending}
                        className="h-8 gap-1 shrink-0"
                      >
                        {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Agregar
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setDetailedMode(true)}
                            className="h-8 px-2 gap-1 shrink-0"
                          >
                            <Sparkles className="h-3 w-3" />
                            Detallar
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[10px]">
                          Especifica responsable, prioridad, fecha y descripción antes de crear
                        </TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { resetCreator(true); }}
                      className="h-8 gap-1 shrink-0"
                    >
                      <X className="h-3 w-3" />
                      Cancelar
                    </Button>
                  )}
                </div>

                {/* Category picker — chips icónicos siempre visibles */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    Tipo:
                  </span>
                  {CATEGORY_ORDER.map((cat) => {
                    const m = CATEGORY_META[cat];
                    const active = newCategory === cat;
                    return (
                      <Tooltip key={cat}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setNewCategory(cat)}
                            className={cn(
                              "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold border transition-all",
                              active
                                ? cn(m.bg, m.tone, m.border, "ring-2 ring-current/20")
                                : "bg-card border-border text-muted-foreground hover:border-primary/40"
                            )}
                          >
                            <m.Icon className="h-2.5 w-2.5" />
                            {m.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[10px] max-w-[200px]">
                          {m.hint}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* MODO DETALLADO — formulario expandible */}
                {detailedMode && (
                  <div className="rounded-lg border border-primary/30 bg-primary/[0.02] p-3 space-y-3 mt-2">
                    {/* Descripción */}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                        <AlignLeft className="h-2.5 w-2.5" /> Descripción (opcional)
                      </Label>
                      <Textarea
                        placeholder="Detalle del trabajo a realizar…"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>

                    {/* Prioridad chips */}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                        <Flag className="h-2.5 w-2.5" /> Prioridad
                      </Label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(["baja", "media", "alta", "critica"] as SubtaskPriority[]).map((p) => {
                          const active = newPriority === p;
                          const styles =
                            p === "critica" ? { bg: "bg-destructive/15", text: "text-destructive", border: "border-destructive/40", dot: "bg-destructive" } :
                            p === "alta"    ? { bg: "bg-warning/15",     text: "text-warning",     border: "border-warning/40",     dot: "bg-warning" } :
                            p === "media"   ? { bg: "bg-info/10",        text: "text-info",        border: "border-info/30",        dot: "bg-info" } :
                                              { bg: "bg-muted",          text: "text-muted-foreground", border: "border-border",     dot: "bg-muted-foreground/60" };
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setNewPriority(p)}
                              className={cn(
                                "inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10px] font-semibold border transition-all capitalize",
                                active
                                  ? cn(styles.bg, styles.text, styles.border, "ring-2 ring-current/20")
                                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Responsable */}
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                          <UserCircle2 className="h-2.5 w-2.5" /> Responsable
                        </Label>
                        <Select value={newAssignee || "__none"} onValueChange={(v) => setNewAssignee(v === "__none" ? null : v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                          <SelectContent className="max-h-56">
                            <SelectItem value="__none" className="text-xs">Sin asignar</SelectItem>
                            {memberNames.map((name) => (
                              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Fecha límite */}
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-2.5 w-2.5" /> Fecha límite
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-8 w-full justify-start text-xs font-normal",
                                !newDueDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarDays className="h-3 w-3 mr-1.5" />
                              {newDueDate ? format(newDueDate, "d MMM yyyy", { locale: es }) : "Sin fecha"}
                              {newDueDate && (
                                <X
                                  className="h-3 w-3 ml-auto hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); setNewDueDate(null); }}
                                />
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={newDueDate || undefined}
                              onSelect={(d) => setNewDueDate(d || null)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Footer del form: resumen + acciones */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground">
                        Categoría: <span className="font-bold">{CATEGORY_META[newCategory].label}</span>
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm" variant="outline"
                          onClick={() => handleAdd(false)}
                          disabled={!newTitle.trim() || create.isPending}
                          className="h-7 gap-1 text-[11px]"
                          title="Crear y mantener formulario abierto para crear más"
                        >
                          {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          Crear y seguir
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAdd(true)}
                          disabled={!newTitle.trim() || create.isPending}
                          className="h-7 gap-1 text-[11px]"
                        >
                          {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Crear con detalle
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ════════ TOOLBAR: search + categoría + view mode ════════ */}
        {total > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Buscar subtarea…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-7 h-7 text-xs"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded hover:bg-muted/60 flex items-center justify-center">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Status: todas / pendientes / completadas */}
            <ToggleGroup
              type="single"
              value={statusFilter}
              onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
              className="h-7 border rounded-md p-0.5"
            >
              <ToggleGroupItem value="todas" className="h-6 px-2 text-[10px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Todas {total > 0 && `(${total})`}
              </ToggleGroupItem>
              <ToggleGroupItem value="pendientes" className="h-6 px-2 text-[10px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Pendientes {total - done > 0 && `(${total - done})`}
              </ToggleGroupItem>
              <ToggleGroupItem value="completadas" className="h-6 px-2 text-[10px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Hechas {done > 0 && `(${done})`}
              </ToggleGroupItem>
            </ToggleGroup>

            {/* View mode: lista / agrupada */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              className="h-7 border rounded-md p-0.5"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="list" className="h-6 w-6 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    <LayoutList className="h-3 w-3" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Vista lista</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="grouped" className="h-6 w-6 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    <LayoutGrid className="h-3 w-3" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Agrupar por tipo</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </div>
        )}

        {/* ════════ FILTROS DE CATEGORÍA — chips con counts ════════ */}
        {total > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold border transition-all",
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <Tag className="h-2.5 w-2.5" />
              Todos
              <span className="tabular-nums">{total}</span>
            </button>
            {CATEGORY_ORDER.map((cat) => {
              const m = CATEGORY_META[cat];
              const c = countsByCategory[cat];
              if (c.total === 0) return null;
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold border transition-all",
                    active
                      ? cn(m.bg, m.tone, m.border, "ring-2 ring-current/20")
                      : "bg-card border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <m.Icon className="h-2.5 w-2.5" />
                  {m.label}
                  <span className={cn("tabular-nums", !active && "text-muted-foreground")}>
                    {c.pending > 0 ? `${c.pending}/${c.total}` : c.total}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ════════ LISTA O AGRUPADA ════════ */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando subtareas…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={total > 0} hasFilters={hasFilters} onClearFilters={() => {
            setStatusFilter("todas"); setCategoryFilter("all"); setSearch("");
          }} />
        ) : viewMode === "grouped" ? (
          // Vista agrupada por categoría
          <div className="space-y-3">
            {groupedByCategory.map(({ category, items }) => {
              const m = CATEGORY_META[category];
              const groupDone = items.filter((s) => s.completed).length;
              return (
                <Card key={category} className={cn("border", m.border)}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", m.bg)}>
                        <m.Icon className={cn("h-3.5 w-3.5", m.tone)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold uppercase tracking-wider", m.tone)}>
                          {m.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{m.hint}</p>
                      </div>
                      <span className="text-[10px] tabular-nums font-bold text-muted-foreground shrink-0">
                        {groupDone}/{items.length}
                      </span>
                    </div>
                    <div className="space-y-1.5" onDragOver={(e) => e.preventDefault()}>
                      {items.map((s) => renderItem(s, false))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <p className="text-[10px] text-center text-muted-foreground italic">
              Para reordenar, cambiá a vista de lista.
            </p>
          </div>
        ) : (
          // Vista lista
          <div className="space-y-1.5" onDragOver={(e) => e.preventDefault()}>
            {filtered.map((s) => renderItem(s, !hasFilters))}
            {hasFilters && (
              <p className="text-[10px] text-center text-muted-foreground pt-2 italic">
                Para reordenar, limpiá los filtros.
              </p>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function EmptyState({ hasAny, hasFilters, onClearFilters }: {
  hasAny: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (!hasAny) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center space-y-2">
          <ListChecks className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground">
            Sin subtareas aún. Dividí el caso en pasos concretos ↑
          </p>
          <p className="text-[10px] text-muted-foreground/70 max-w-xs mx-auto">
            Podés clasificar cada subtarea como <span className="text-violet-500 font-semibold">Estrategia</span>,
            <span className="text-blue-500 font-semibold"> Revisión</span>,
            <span className="text-emerald-500 font-semibold"> Comercial</span>,
            <span className="text-amber-500 font-semibold"> Backlog</span> o
            <span className="text-muted-foreground font-semibold"> General</span>.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (hasFilters) {
    return (
      <Card>
        <CardContent className="py-6 text-center space-y-2">
          <Search className="h-6 w-6 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground">Sin resultados con estos filtros</p>
          <Button size="sm" variant="outline" onClick={onClearFilters} className="h-7 text-xs">
            Limpiar filtros
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <p className="text-xs text-center text-muted-foreground py-6">
      Todas las subtareas están completadas 🎉
    </p>
  );
}
