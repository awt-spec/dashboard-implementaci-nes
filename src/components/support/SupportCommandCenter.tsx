import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSupportClients, useSupportTickets, useUpdateSupportTicket, type SupportTicket } from "@/hooks/useSupportTickets";
import { useSlaCompliance, type SlaCaseRow } from "@/hooks/useSlaCompliance";
import { isTicketClosed, normalizePrioridad } from "@/lib/ticketStatus";
import { TicketHistoryTimeline } from "./TicketHistoryTimeline";
import { CaseClientCard } from "./CaseClientCard";
import { SupportKpiRow } from "./SupportKpiRow";

/* ── Helpers ─────────────────────────────────────────────────────────── */

const PRIORITY_RAIL: Record<string, string> = {
  critica: "bg-destructive",
  alta: "bg-destructive/70",
  media: "bg-warning",
  baja: "bg-muted-foreground/40",
};

const PRIORITY_TEXT: Record<string, string> = {
  critica: "text-destructive",
  alta: "text-destructive/80",
  media: "text-warning",
  baja: "text-muted-foreground",
};

const ESTADOS = ["PENDIENTE", "ASIGNADA", "EN ATENCIÓN", "ENTREGADA"] as const;

/**
 * Tiempo que queda de SLA, en el formato del diseño: "-2h 40m" cuando ya se
 * pasó, "5h 40m" o "1d 3h" cuando todavía hay margen.
 */
function slaLabel(row: SlaCaseRow | undefined): { text: string; tone: string } {
  if (!row) return { text: "sin SLA", tone: "text-muted-foreground" };
  const remaining = row.limitHours - row.elapsedHours;
  const abs = Math.abs(remaining);
  const text = abs >= 24
    ? `${Math.floor(abs / 24)}d ${Math.round(abs % 24)}h`
    : abs >= 1
      ? `${Math.floor(abs)}h ${Math.round((abs % 1) * 60)}m`
      : `${Math.round(abs * 60)}m`;
  if (remaining < 0) return { text: `-${text}`, tone: "text-destructive" };
  if (row.level === "at_risk") return { text, tone: "text-warning" };
  return { text, tone: "text-muted-foreground" };
}

function fmtTimer(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ── Cola ────────────────────────────────────────────────────────────── */

function QueueCard({
  ticket, row, clientName, selected, onSelect,
}: { ticket: SupportTicket; row?: SlaCaseRow; clientName: string; selected: boolean; onSelect: () => void }) {
  const prio = normalizePrioridad(ticket.prioridad) || "baja";
  const sla = slaLabel(row);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full overflow-hidden rounded-xl border bg-card p-3 pl-4 text-left transition-colors ${
        selected ? "border-primary ring-1 ring-primary/15" : "border-border hover:bg-accent/40"
      }`}
    >
      {/* Riel de prioridad, 3px */}
      <span className={`absolute left-0 top-0 h-full w-[3px] ${PRIORITY_RAIL[prio] ?? PRIORITY_RAIL.baja}`} />
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-muted-foreground">{ticket.ticket_id}</span>
        <span className={`shrink-0 text-[10px] font-semibold ${PRIORITY_TEXT[prio] ?? ""}`}>
          {ticket.prioridad || "—"}
        </span>
        <span className={`ml-auto shrink-0 text-[10.5px] font-bold tabular-nums ${sla.tone}`}>{sla.text}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[12.5px] font-semibold leading-snug text-foreground">{ticket.asunto}</p>
      <p className="mt-1 truncate text-[10.5px] text-muted-foreground">
        {clientName || "—"} · {ticket.responsable || "Sin asignar"}
      </p>
    </button>
  );
}

/* ── Componente ──────────────────────────────────────────────────────── */

export interface SupportCommandCenterProps {
  clientId?: string;
  onNewTicket?: () => void;
}

/**
 * Centro de mando de Soporte (§9): indicadores, cola priorizada y detalle,
 * los tres en una pantalla.
 *
 * La bandeja anterior agrupaba los casos en tarjetas plegables y el detalle
 * vivía dentro de una fila expandible, así que para leer un caso había que
 * perder de vista la cola. Acá la cola queda a la izquierda y el caso a la
 * derecha, con el contexto del cliente pegado al caso.
 */
export function SupportCommandCenter({ clientId, onNewTicket }: SupportCommandCenterProps) {
  const { data: tickets = [] } = useSupportTickets(clientId);
  const { data: clients = [] } = useSupportClients();
  const { rows } = useSlaCompliance(clientId);
  const nameOf = (id: string | null) =>
    clients.find((c: { id: string }) => c.id === id)?.name ?? "";
  const update = useUpdateSupportTicket();

  const rowByTicket = useMemo(() => new Map(rows.map(r => [r.ticket.id, r])), [rows]);

  // Cola: abiertos, el más comprometido primero. `pct` ya es "porcentaje del
  // SLA consumido", así que ordenar por él pone arriba lo vencido.
  const queue = useMemo(() => {
    return tickets
      .filter(t => !isTicketClosed(t.estado))
      .sort((a, b) => (rowByTicket.get(b.id)?.pct ?? -1) - (rowByTicket.get(a.id)?.pct ?? -1));
  }, [tickets, rowByTicket]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = queue.find(t => t.id === selectedId) ?? queue[0] ?? null;

  // Al cambiar de cliente la selección anterior ya no está en la cola.
  useEffect(() => { setSelectedId(null); }, [clientId]);

  /* Timer: cuenta en local y, al pausar, suma los minutos a
     tiempo_consumido_minutos. Sin ese guardado sería un cronómetro decorativo
     que se pierde al cambiar de caso. */
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [running]);

  // Cambiar de caso con el reloj corriendo perdería lo contado: se detiene.
  useEffect(() => { setRunning(false); setElapsed(0); }, [selected?.id]);

  const stopTimer = async () => {
    setRunning(false);
    const minutes = Math.round(elapsed / 60);
    if (!selected || minutes < 1) { setElapsed(0); return; }
    try {
      await update.mutateAsync({
        id: selected.id,
        updates: { tiempo_consumido_minutos: (selected.tiempo_consumido_minutos || 0) + minutes },
      });
      toast.success(`${minutes} min registrados en ${selected.ticket_id}`);
      setElapsed(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el tiempo");
    }
  };

  const [comment, setComment] = useState("");
  const sendComment = async () => {
    if (!selected || !comment.trim()) return;
    const stamp = new Date().toLocaleString("es-CR");
    const next = `${selected.notas ? `${selected.notas}\n` : ""}[${stamp}] ${comment.trim()}`;
    try {
      await update.mutateAsync({ id: selected.id, updates: { notas: next } });
      setComment("");
      toast.success("Comentario agregado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el comentario");
    }
  };

  const setEstado = async (estado: string) => {
    if (!selected) return;
    try {
      await update.mutateAsync({ id: selected.id, updates: { estado } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  };

  const selRow = selected ? rowByTicket.get(selected.id) : undefined;
  const selSla = slaLabel(selRow);
  const selPrio = normalizePrioridad(selected?.prioridad) || "baja";

  return (
    /* La altura NO se hereda: para 'soporte' el <main> es un bloque que
       scrollea, no una columna flex de altura fija, así que flex-1 + min-h-0
       no tiene de dónde agarrarse y colapsaría todo a cero. De lg para arriba
       se fija una altura concreta y ahí sí funciona la cadena interna; en
       teléfono cada panel crece a lo suyo con su propio tope de scroll. */
    <div className="flex flex-col gap-3.5 lg:h-[calc(100vh-13rem)] lg:min-h-[520px]">
      <SupportKpiRow clientId={clientId} />

      {/* Cola 406px + detalle. min-h-0 en la grilla y en cada columna: sin eso
          el scroll interno nunca se activa y crece la página entera. */}
      <div className="grid grid-cols-1 gap-3.5 lg:min-h-0 lg:flex-1 lg:grid-cols-[406px_1fr]">
        {/* ── Cola ── */}
        <section className="flex flex-col rounded-xl border border-border bg-card lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
            <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
              Cola priorizada por SLA
            </p>
            {onNewTicket && (
              <Button size="sm" className="h-7 shrink-0 text-xs" onClick={onNewTicket}>Nuevo caso</Button>
            )}
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto p-2.5 lg:max-h-none lg:min-h-0 lg:flex-1">
            {queue.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Sin casos abiertos.</p>
            ) : queue.map(t => (
              <QueueCard
                key={t.id}
                ticket={t}
                row={rowByTicket.get(t.id)}
                clientName={nameOf(t.client_id)}
                selected={selected?.id === t.id}
                onSelect={() => setSelectedId(t.id)}
              />
            ))}
          </div>
        </section>

        {/* ── Detalle ── */}
        <section className="flex flex-col rounded-xl border border-border bg-card lg:min-h-0">
          {!selected ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Elegí un caso de la cola para verlo acá.
            </p>
          ) : (
            <>
              {/* Cabecera */}
              <div className="shrink-0 border-b border-border p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{selected.ticket_id}</span>
                  <span className={`text-[10.5px] font-semibold ${PRIORITY_TEXT[selPrio] ?? ""}`}>
                    {selected.prioridad || "—"}
                  </span>
                  <span className={`rounded-full border px-2 py-px text-[10.5px] font-bold tabular-nums ${
                    selSla.tone === "text-destructive"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : selSla.tone === "text-warning"
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : "border-border text-muted-foreground"
                  }`}>
                    {selSla.text}
                  </span>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs tabular-nums"
                      onClick={() => (running ? void stopTimer() : setRunning(true))}
                    >
                      {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {running ? fmtTimer(elapsed) : elapsed > 0 ? `Reanudar ${fmtTimer(elapsed)}` : "Iniciar timer"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled>
                      <Share2 className="h-3.5 w-3.5" /> Compartir
                    </Button>
                  </div>
                </div>
                <h2 className="mt-2 text-[16px] font-bold leading-tight text-foreground">{selected.asunto}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {nameOf(selected.client_id) || "—"} · {selected.responsable || "Sin asignar"}
                </p>
              </div>

              {/* Cuerpo: 1fr + ficha del cliente de 268px */}
              <div className="grid grid-cols-1 lg:min-h-0 lg:flex-1 xl:grid-cols-[1fr_268px]">
                <div className="space-y-3 p-3.5 lg:min-h-0 lg:overflow-y-auto">
                  {/* Estados */}
                  <div className="flex flex-wrap gap-1.5">
                    {ESTADOS.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => void setEstado(e)}
                        className={`h-8 rounded-lg px-3 text-[11.5px] font-semibold transition-colors ${
                          selected.estado === e
                            ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                            : "bg-secondary text-secondary-foreground hover:bg-accent"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>

                  {/* Resumen IA — sólo si el caso lo tiene; el borde punteado
                      violeta lo marca como generado, no escrito por una persona. */}
                  {selected.ai_summary && (
                    <div className="rounded-xl border border-dashed border-[hsl(258_90%_66%/.45)] bg-[hsl(258_90%_66%/.06)] p-3">
                      <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-[hsl(258_60%_55%)]">
                        <Sparkles className="h-3 w-3" /> Resumen IA del caso
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-snug text-foreground">
                        {selected.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* Bitácora */}
                  <div>
                    <p className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                      Bitácora
                    </p>
                    <TicketHistoryTimeline ticketId={selected.id} maxHeight="280px" />
                  </div>

                  {/* Comentario */}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Comentario…"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendComment(); } }}
                      className="h-9 text-xs"
                    />
                    <Button
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={() => void sendComment()}
                      disabled={!comment.trim() || update.isPending}
                    >
                      Enviar
                    </Button>
                  </div>
                </div>

                {/* Ficha del cliente */}
                <aside className="hidden border-l border-border bg-muted/30 p-3.5 xl:block xl:min-h-0 xl:overflow-y-auto">
                  {selected.client_id && (
                    <CaseClientCard
                      clientId={selected.client_id}
                      currentTicketId={selected.id}
                      onOpenTicket={setSelectedId}
                    />
                  )}
                </aside>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
