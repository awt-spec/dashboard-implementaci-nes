import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, ListChecks, Circle, CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  useTicketSubtasks, useCreateTicketSubtask, useToggleTicketSubtask,
  useUpdateTicketSubtask, useDeleteTicketSubtask, useReorderTicketSubtasks,
  type TicketSubtask,
} from "@/hooks/useSupportTicketDetails";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { SubtaskItem } from "./SubtaskItem";

interface Props {
  ticketId: string;
  canEdit: boolean;
}

type Filter = "todas" | "pendientes" | "completadas";

export function SubtaskList({ ticketId, canEdit }: Props) {
  const { data: subtasks = [], isLoading } = useTicketSubtasks(ticketId);
  const { data: members = [] } = useSysdeTeamMembers();
  const memberNames = useMemo(() => (members as any[]).map((m) => m.name).filter(Boolean), [members]);

  const create = useCreateTicketSubtask();
  const toggle = useToggleTicketSubtask();
  const update = useUpdateTicketSubtask();
  const del = useDeleteTicketSubtask();
  const reorder = useReorderTicketSubtasks();

  const [newTitle, setNewTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const done = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const filtered = useMemo(() => {
    if (filter === "pendientes") return subtasks.filter((s) => !s.completed);
    if (filter === "completadas") return subtasks.filter((s) => s.completed);
    return subtasks;
  }, [subtasks, filter]);

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    create.mutate(
      { ticket_id: ticketId, title: t, sort_order: subtasks.length, priority: "media" },
      {
        onSuccess: () => { setNewTitle(""); },
        onError: (e: any) => toast.error(e?.message || "No se pudo crear la subtarea"),
      }
    );
  };

  const handleDragStart = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Firefox requiere setData para disparar el drag
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

    // Reordenar sobre la lista COMPLETA (no sobre filtrada) para que el sort_order sea consistente.
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

  return (
    <div className="space-y-3">
      {/* Header: progreso + nuevo */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <ListChecks className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">
              {done} de {total} completadas
            </span>
            {total > 0 && (
              <>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-muted-foreground tabular-nums">{pct}%</span>
              </>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nueva subtarea…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newTitle.trim() || create.isPending}
                className="h-8 gap-1"
              >
                {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Agregar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-tabs filter */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="w-full h-8 grid grid-cols-3">
          <TabsTrigger value="todas" className="text-[11px] gap-1">
            <ListChecks className="h-3 w-3" /> Todas
            {total > 0 && <span className="text-muted-foreground">({total})</span>}
          </TabsTrigger>
          <TabsTrigger value="pendientes" className="text-[11px] gap-1">
            <Circle className="h-3 w-3" /> Pendientes
            {total - done > 0 && <span className="text-muted-foreground">({total - done})</span>}
          </TabsTrigger>
          <TabsTrigger value="completadas" className="text-[11px] gap-1">
            <CheckCircle2 className="h-3 w-3" /> Completadas
            {done > 0 && <span className="text-muted-foreground">({done})</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando subtareas…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState filter={filter} hasAny={total > 0} />
          ) : (
            <div
              className="space-y-1.5"
              onDragOver={(e) => e.preventDefault()}
            >
              {filtered.map((s: TicketSubtask) => (
                <SubtaskItem
                  key={s.id}
                  subtask={s}
                  canEdit={canEdit}
                  memberNames={memberNames}
                  draggable={filter === "todas"}
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
              ))}

              {filter !== "todas" && (
                <p className="text-[10px] text-center text-muted-foreground pt-2 italic">
                  Para reordenar, volvé a la vista "Todas".
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ filter, hasAny }: { filter: Filter; hasAny: boolean }) {
  if (filter === "pendientes" && hasAny) {
    return <p className="text-xs text-center text-muted-foreground py-6">Todas las subtareas están completadas 🎉</p>;
  }
  if (filter === "completadas") {
    return <p className="text-xs text-center text-muted-foreground py-6">Sin subtareas completadas aún.</p>;
  }
  return (
    <p className="text-xs text-center text-muted-foreground py-6">
      Sin subtareas. Dividí el caso en pasos concretos ↑
    </p>
  );
}
