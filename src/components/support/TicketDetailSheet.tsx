import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Calendar, User, Flame, Clock, CheckCheck, Loader2,
  MessageSquare, History, ScrollText, Lock, Eye, EyeOff, Copy,
  Save, Trash2, AlertTriangle, Paperclip, CheckSquare, ArrowLeft,
  Share2, Sparkles, RotateCcw, Maximize2, Minimize2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

import {
  useSupportClients, useUpdateSupportTicket, useDeleteSupportTicket,
  useDecryptTicket, type SupportTicket,
} from "@/hooks/useSupportTickets";
import {
  useTicketNotes, useCreateTicketNote, useDeleteTicketNote,
  useTicketSubtasks,
} from "@/hooks/useSupportTicketDetails";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { TicketHistoryTimeline } from "./TicketHistoryTimeline";
import { TicketLegacyView } from "./TicketLegacyView";
import { SubtaskList } from "./SubtaskList";
import { TicketStateFlow } from "./TicketStateFlow";
import { ShareTicketHistoryDialog } from "./ShareTicketHistoryDialog";
import { CaseStrategyPanel } from "./CaseStrategyPanel";
import { TicketSLAExplanation } from "./TicketSLAExplanation";
import { ReopenBadge } from "./ReopenBadge";
import { ReopenReasonDialog } from "./ReopenReasonDialog";
import { TicketReopensTimeline } from "./TicketReopensTimeline";
import { isTicketClosed } from "@/lib/ticketStatus";
import { cn } from "@/lib/utils";

/** Estados que cuentan como "entregado/aprobado" para detectar reincidencia */
const DELIVERED_STATES = new Set(["ENTREGADA", "APROBADA"]);
/** Estados activos donde puede regresar un caso entregado */
const REOPEN_TARGET_STATES = new Set(["EN ATENCIÓN", "PENDIENTE", "VALORACIÓN", "COTIZADA", "POR CERRAR"]);

// ─── Constantes ───────────────────────────────────────────────────────────

const PRIORITIES = [
  { v: "Critica, Impacto Negocio", l: "Crítica — Impacto Negocio" },
  { v: "Alta", l: "Alta" },
  { v: "Media", l: "Media" },
  { v: "Baja", l: "Baja" },
];

const priorityColor = (p: string | null | undefined) => {
  if (!p) return "bg-muted text-muted-foreground";
  if (/critica/i.test(p)) return "bg-destructive/15 text-destructive border-destructive/30";
  if (p === "Alta") return "bg-warning/15 text-warning border-warning/30";
  if (p === "Media") return "bg-info/15 text-info border-info/30";
  return "bg-muted text-muted-foreground";
};

const stateColor = (s: string) => {
  if (isTicketClosed(s)) return "bg-muted text-muted-foreground border-border";
  if (s === "EN ATENCIÓN") return "bg-info/15 text-info border-info/30";
  if (s === "PENDIENTE") return "bg-warning/15 text-warning border-warning/30";
  if (s === "ENTREGADA") return "bg-success/15 text-success border-success/30";
  return "bg-muted/40 border-border";
};

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEditInternal?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────

export function TicketDetailSheet({ ticket, open, onOpenChange, canEditInternal = false }: Props) {
  const { data: clients = [] } = useSupportClients();
  const { data: members = [] } = useSysdeTeamMembers();
  const { profile } = useAuth();
  const update = useUpdateSupportTicket();
  const del = useDeleteSupportTicket();
  const decrypt = useDecryptTicket();

  const [tab, setTab] = useState("detalle");
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Diálogo de reincidencia: capturamos el estado destino mientras el usuario
  // confirma el motivo. Si cancela, el cambio de estado NO se aplica.
  const [reopenDialogTarget, setReopenDialogTarget] = useState<string | null>(null);
  // Tamaño del sheet — toggle entre normal (max-w-2xl) y wide (casi fullscreen).
  // Persistimos preferencia para que sobreviva navegación. Feedback COO 30/04:
  // "quiero poder estirar esa ventana hacia la izquierda o ponerlo en pantalla completa".
  const [isWide, setIsWide] = useState<boolean>(() => {
    try { return localStorage.getItem("sva-erp:ticket-sheet-wide") === "1"; } catch { return false; }
  });
  const toggleWide = () => {
    setIsWide((v) => {
      const next = !v;
      try { localStorage.setItem("sva-erp:ticket-sheet-wide", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  // ── Notas ──
  const { data: notes = [] } = useTicketNotes(ticket?.id ?? null);
  const createNote = useCreateTicketNote();
  const deleteNote = useDeleteTicketNote();
  const [newNote, setNewNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"interna" | "externa">("interna");

  // ── Subtareas (solo para el counter del tab header) ──
  const { data: subtasks = [] } = useTicketSubtasks(ticket?.id ?? null);

  const client = useMemo(() => clients.find(c => c.id === ticket?.client_id), [clients, ticket]);

  if (!ticket) return null;

  const isClosed = isTicketClosed(ticket.estado);

  // ── Handlers de acciones rápidas ──

  const changeState = async (newState: string) => {
    // Detectar reincidencia: ENTREGADA/APROBADA → activo abre el diálogo de motivo.
    // El UPDATE real se hace dentro del useReopenTicket() después de confirmar.
    if (DELIVERED_STATES.has(ticket.estado) && REOPEN_TARGET_STATES.has(newState)) {
      setReopenDialogTarget(newState);
      return;
    }
    try {
      await update.mutateAsync({ id: ticket.id, updates: { estado: newState } });
      toast.success(`${ticket.ticket_id} → ${newState}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const changePriority = async (newPrio: string) => {
    try {
      await update.mutateAsync({ id: ticket.id, updates: { prioridad: newPrio } });
      toast.success(`Prioridad actualizada`);
    } catch (e: any) { toast.error(e.message); }
  };

  const changeAssignee = async (name: string) => {
    try {
      const member = members.find((m: any) => m.name === name);
      const updates: Record<string, unknown> = { responsable: name };
      if (member?.user_id) updates.assigned_user_id = member.user_id;
      await update.mutateAsync({ id: ticket.id, updates });
      toast.success(`Asignado a ${name}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleClose = async () => {
    try {
      await update.mutateAsync({ id: ticket.id, updates: { estado: "CERRADA" } });
      toast.success(`Caso ${ticket.ticket_id} cerrado`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReopen = async () => {
    // Reabrir un caso CERRADO desde ENTREGADA/APROBADA también dispara
    // reincidencia. Si vino de otro estado (ej. CERRADA tras VALORACIÓN sin
    // entrega), no aplica — UPDATE directo.
    if (DELIVERED_STATES.has(ticket.estado)) {
      setReopenDialogTarget("EN ATENCIÓN");
      return;
    }
    try {
      await update.mutateAsync({ id: ticket.id, updates: { estado: "EN ATENCIÓN" } });
      toast.info(`Caso reabierto`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    try {
      await del.mutateAsync(ticket.id);
      toast.success(`Caso eliminado`);
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReveal = async () => {
    if (decryptedText) { setDecryptedText(null); return; }
    try {
      const r = await decrypt.mutateAsync(ticket.id);
      setDecryptedText(r.descripcion || "(vacío)");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    createNote.mutate(
      {
        ticket_id: ticket.id,
        content: newNote.trim(),
        author_name: profile?.full_name || "Anónimo",
        visibility: noteVisibility,
      },
      { onSuccess: () => { setNewNote(""); toast.success("Nota agregada"); } }
    );
  };

  const copyId = () => {
    navigator.clipboard.writeText(ticket.ticket_id).then(() => toast.success("ID copiado"));
  };

  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Layout flex: header fijo (no-scroll) + body scrolleable.
          Reemplaza el modelo "todo scrollea" que dejaba contenido visible
          detrás del header sticky con bg semi-transparente. */}
      <SheetContent
        side="right"
        className={cn(
          "p-0 flex flex-col gap-0 transition-[max-width] duration-200",
          isWide ? "w-full sm:max-w-[calc(100vw-3rem)]" : "w-full sm:max-w-2xl",
        )}
      >
        <SheetHeader className="space-y-3 px-6 pt-6 pb-4 bg-card border-b border-border/60 shrink-0">
          {/* Back + ID + copy + toggle fullscreen */}
          <div className="flex items-center gap-2 text-xs">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 -ml-2 gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Volver
            </Button>
            <div className="flex-1" />
            <code className="font-mono font-bold">{ticket.ticket_id}</code>
            <button
              onClick={copyId}
              className="p-1 rounded hover:bg-muted"
              title="Copiar ID"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              onClick={toggleWide}
              className="p-1 rounded hover:bg-muted"
              title={isWide ? "Contraer (ancho normal)" : "Expandir (pantalla completa)"}
              aria-label={isWide ? "Contraer ventana" : "Expandir ventana"}
            >
              {isWide
                ? <Minimize2 className="h-3.5 w-3.5" />
                : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Título */}
          <SheetTitle className="text-lg font-bold leading-tight text-left">{ticket.asunto}</SheetTitle>

          {/* Badges resumen */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={stateColor(ticket.estado)}>{ticket.estado}</Badge>
            <Badge variant="outline" className={priorityColor(ticket.prioridad)}>
              {/critica/i.test(ticket.prioridad || "") ? "Crítica" : ticket.prioridad}
            </Badge>
            {/* Reincidencia (solo cara interna — clientFacing=!canEditInternal) */}
            <ReopenBadge
              count={ticket.reopen_count}
              lastReason={ticket.last_reopen_reason}
              lastReopenAt={ticket.last_reopen_at}
              clientFacing={!canEditInternal}
            />
            {ticket.is_confidential && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                <Lock className="h-3 w-3 mr-0.5" /> Confidencial
              </Badge>
            )}
            {ticket.fuente && ticket.fuente !== "interno" && (
              <Badge variant="outline" className="text-[10px]">desde {ticket.fuente}</Badge>
            )}
          </div>

          <SheetDescription className="text-[11px] flex items-center gap-2 flex-wrap">
            {client && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {client.name}</span>}
            <span>·</span>
            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {ticket.responsable || "Sin asignar"}</span>
            <span>·</span>
            <span className="flex items-center gap-1" title={ticket.created_at ? format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: es }) : ""}>
              <Calendar className="h-3 w-3" /> {ticket.created_at ? formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es }) : ""}
            </span>
          </SheetDescription>
        </SheetHeader>

        {/* ── BODY scrolleable: state flow + acciones + SLA + tabs ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* ── Acciones rápidas + Flujo de estados ── */}
        <div className="space-y-3">
          {/* Flujo de estados visual */}
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide block mb-1">
              Estado del caso
            </label>
            <TicketStateFlow
              currentState={ticket.estado}
              onChange={changeState}
              disabled={!canEditInternal}
              pending={update.isPending}
              ticketTipo={ticket.tipo}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Cambiar prioridad */}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Prioridad</label>
              <Select value={ticket.prioridad} onValueChange={changePriority} disabled={update.isPending || !canEditInternal}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Reasignar */}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Responsable</label>
              <Select value={ticket.responsable || ""} onValueChange={changeAssignee} disabled={update.isPending || !canEditInternal}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  {members.map((m: any) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {canEditInternal && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ticket.estado === "PENDIENTE" && (
                <Button size="sm" onClick={() => changeState("EN ATENCIÓN")} disabled={update.isPending} className="h-7 gap-1 text-[11px]">
                  <CheckCheck className="h-3 w-3" /> Atender
                </Button>
              )}
              {!isClosed && (
                <Button size="sm" variant="outline" onClick={handleClose} disabled={update.isPending} className="h-7 gap-1 text-[11px]">
                  <CheckCheck className="h-3 w-3" /> Cerrar caso
                </Button>
              )}
              {isClosed && (
                <Button size="sm" variant="outline" onClick={handleReopen} disabled={update.isPending} className="h-7 gap-1 text-[11px]">
                  Reabrir
                </Button>
              )}
              {!confirmDelete ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="h-7 gap-1 text-[11px] text-destructive hover:bg-destructive/10 ml-auto">
                  <Trash2 className="h-3 w-3" /> Eliminar
                </Button>
              ) : (
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">¿Confirmás?</span>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="h-7 text-[11px]">Cancelar</Button>
                  <Button size="sm" variant="destructive" onClick={handleDelete} disabled={del.isPending} className="h-7 gap-1 text-[11px]">
                    {del.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Sí, eliminar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Explicación SLA · Por qué esta etiqueta — visible siempre, antes de los tabs ── */}
        <TicketSLAExplanation ticket={ticket} clientName={client?.name} />

        {/* ── Tabs con contenido ── */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className={cn(
            "w-full h-9 grid",
            // Tab "Reincidencias" solo si hay reopen_count > 0 y vista interna
            (canEditInternal && (ticket.reopen_count ?? 0) > 0)
              ? "grid-cols-6"
              : "grid-cols-5",
          )}>
            <TabsTrigger value="detalle" className="text-[11px] gap-1"><ScrollText className="h-3 w-3" /> Detalle</TabsTrigger>
            <TabsTrigger value="historial" className="text-[11px] gap-1"><History className="h-3 w-3" /> Historial</TabsTrigger>
            <TabsTrigger value="notas" className="text-[11px] gap-1">
              <MessageSquare className="h-3 w-3" /> Notas
              {notes.length > 0 && <Badge variant="outline" className="ml-0.5 text-[9px] h-3.5 px-1">{notes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="subtareas" className="text-[11px] gap-1">
              <CheckSquare className="h-3 w-3" /> Subtareas
              {subtasks.length > 0 && <Badge variant="outline" className="ml-0.5 text-[9px] h-3.5 px-1">{completedSubtasks}/{subtasks.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="estrategia" className="text-[11px] gap-1">
              <Sparkles className="h-3 w-3" /> Estrategia IA
            </TabsTrigger>
            {canEditInternal && (ticket.reopen_count ?? 0) > 0 && (
              <TabsTrigger value="reopens" className="text-[11px] gap-1">
                <RotateCcw className="h-3 w-3" /> Reincidencias
                <Badge variant="outline" className={cn(
                  "ml-0.5 text-[9px] h-3.5 px-1 border-warning/40 bg-warning/10 text-warning",
                  (ticket.reopen_count ?? 0) >= 3 && "border-destructive/40 bg-destructive/10 text-destructive",
                )}>
                  {ticket.reopen_count}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          {/* DETALLE — usa TicketLegacyView que ya muestra todo */}
          <TabsContent value="detalle" className="mt-3">
            <TicketLegacyView ticket={ticket} client={client || null} canEditInternal={canEditInternal} />
          </TabsContent>

          {/* HISTORIAL — timeline cronológico + botón compartir */}
          <TabsContent value="historial" className="mt-3">
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" /> Actividad del caso
                </CardTitle>
                {canEditInternal && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShareOpen(true)}
                    className="h-7 gap-1 text-[11px]"
                  >
                    <Share2 className="h-3 w-3" /> Compartir
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <TicketHistoryTimeline ticketId={ticket.id} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTAS — thread interno + externo */}
          <TabsContent value="notas" className="mt-3 space-y-3">
            {/* Nueva nota */}
            <Card>
              <CardContent className="p-3 space-y-2">
                <Textarea
                  placeholder="Escribí una nota o actualización..."
                  rows={3}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="text-sm resize-none"
                />
                <div className="flex items-center gap-2">
                  <Select value={noteVisibility} onValueChange={(v: any) => setNoteVisibility(v)}>
                    <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interna">🔒 Solo interna (SVA)</SelectItem>
                      <SelectItem value="externa">👁 Visible al cliente</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <Button size="sm" onClick={handleAddNote} disabled={createNote.isPending || !newNote.trim()} className="h-8 gap-1">
                    {createNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Agregar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de notas */}
            {notes.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-6">Sin notas aún. Agregá la primera ↑</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-auto pr-1">
                {notes.map((n: any) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2.5 rounded-lg border border-border/60 bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                          <User className="h-3 w-3" />
                          <span className="font-semibold truncate">{n.author_name || "Anónimo"}</span>
                          <span>·</span>
                          <span>{n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es }) : ""}</span>
                          <Badge variant="outline" className={`text-[10px] ml-auto ${
                            n.visibility === "externa"
                              ? "bg-info/10 text-info border-info/30"
                              : "bg-muted/50"
                          }`}>
                            {n.visibility === "externa" ? "👁 externa" : "🔒 interna"}
                          </Badge>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                      </div>
                      {canEditInternal && (
                        <button
                          onClick={() => deleteNote.mutate({ id: n.id, ticket_id: ticket.id })}
                          className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Eliminar nota"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SUBTAREAS — lista con expand/collapse, drag & drop, sub-tabs */}
          <TabsContent value="subtareas" className="mt-3">
            <SubtaskList ticketId={ticket.id} canEdit={canEditInternal} />
          </TabsContent>

          {/* ESTRATEGIA IA — diagnóstico + acción + riesgos + casos similares + SLA */}
          <TabsContent value="estrategia" className="mt-3">
            <CaseStrategyPanel ticketId={ticket.id} canEdit={canEditInternal} />
          </TabsContent>

          {/* REINCIDENCIAS — solo cara interna y solo si hubo reopens */}
          {canEditInternal && (ticket.reopen_count ?? 0) > 0 && (
            <TabsContent value="reopens" className="mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-warning" />
                    Reincidencias / Inconformidades
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-1">
                      {ticket.reopen_count} {ticket.reopen_count === 1 ? "vuelta" : "vueltas"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TicketReopensTimeline ticketId={ticket.id} ticketCode={ticket.ticket_id} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        </div>{/* /body scrolleable */}
      </SheetContent>

      {/* Dialog de compartir historial (se abre desde el tab Historial) */}
      <ShareTicketHistoryDialog
        ticket={ticket}
        clientName={client?.name ?? null}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      {/* Dialog de motivo de reincidencia (interceptor de cambio de estado) */}
      {reopenDialogTarget && (
        <ReopenReasonDialog
          open={!!reopenDialogTarget}
          onOpenChange={(o) => { if (!o) setReopenDialogTarget(null); }}
          ticketId={ticket.id}
          ticketCode={ticket.ticket_id}
          fromState={ticket.estado}
          toState={reopenDialogTarget}
          currentReopenCount={ticket.reopen_count ?? 0}
          currentResponsable={ticket.responsable}
          onSuccess={() => setReopenDialogTarget(null)}
        />
      )}
    </Sheet>
  );
}
