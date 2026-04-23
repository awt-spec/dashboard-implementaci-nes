import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit3, Eye, Lock, Trash2, MessageSquare, ArrowRightLeft, UserPlus,
  Clock, AlertCircle, type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { useTicketHistory, type TicketHistoryEvent, type TicketHistoryKind } from "@/hooks/useTicketHistory";

/**
 * Formatea un timestamp ISO al formato `DD/MM/YYYY HH:MM:SS`. Se usa en el
 * timeline para mostrar la fecha exacta (request explícito del equipo SYSDE).
 */
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  return format(d, "dd/MM/yyyy HH:mm:ss");
}

// ─── Estilos por tipo de evento ───────────────────────────────────────────

const KIND_STYLES: Record<TicketHistoryKind, { Icon: LucideIcon; bg: string; text: string; label: string }> = {
  create:  { Icon: Plus,           bg: "bg-success/15",     text: "text-success",     label: "Creación" },
  update:  { Icon: Edit3,          bg: "bg-info/15",        text: "text-info",        label: "Cambio" },
  status:  { Icon: ArrowRightLeft, bg: "bg-warning/15",     text: "text-warning",     label: "Estado" },
  assign:  { Icon: UserPlus,       bg: "bg-primary/10",     text: "text-primary",     label: "Asignación" },
  view:    { Icon: Eye,            bg: "bg-muted",          text: "text-muted-foreground", label: "Vista" },
  decrypt: { Icon: Lock,           bg: "bg-warning/15",     text: "text-warning",     label: "Descifrado" },
  delete:  { Icon: Trash2,         bg: "bg-destructive/15", text: "text-destructive", label: "Borrado" },
  note:    { Icon: MessageSquare,  bg: "bg-info/10",        text: "text-info",        label: "Nota" },
};

interface TimelineItemProps {
  event: TicketHistoryEvent;
  isLast: boolean;
}

function TimelineItem({ event, isLast }: TimelineItemProps) {
  const s = KIND_STYLES[event.kind] || KIND_STYLES.update;
  const when = new Date(event.created_at);
  const relative = formatDistanceToNow(when, { addSuffix: true, locale: es });
  const absolute = formatAbsolute(event.created_at);

  return (
    <div className="flex gap-3 relative">
      {/* Rail vertical */}
      {!isLast && (
        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />
      )}

      {/* Dot con icono */}
      <div className={`h-8 w-8 rounded-full ${s.bg} flex items-center justify-center shrink-0 z-10 border-2 border-card`}>
        <s.Icon className={`h-4 w-4 ${s.text}`} />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm leading-snug">{event.summary}</p>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <Badge variant="outline" className="text-[10px]" title={absolute}>
              {relative}
            </Badge>
            <time
              dateTime={event.created_at}
              className="text-[9px] font-mono tabular-nums text-muted-foreground/70"
            >
              {absolute}
            </time>
          </div>
        </div>
        {event.detail && (
          <div className="mt-1.5 p-2.5 rounded-md bg-muted/40 border border-border/60 text-xs whitespace-pre-wrap">
            {event.detail}
          </div>
        )}
        {event.kind === "note" && event.metadata?.visibility && (
          <Badge
            variant="outline"
            className={`mt-1 text-[10px] ${
              event.metadata.visibility === "externa"
                ? "bg-info/10 text-info border-info/30"
                : "bg-muted/50"
            }`}
          >
            {event.metadata.visibility === "externa" ? "👁 visible al cliente" : "🔒 sólo interna"}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  /** Si se pasa, usa el hook useTicketHistory para fetchear en vivo. */
  ticketId?: string | null | undefined;
  /** Si se pasa, renderiza estos eventos directamente (modo snapshot — usado en vista pública). */
  events?: TicketHistoryEvent[];
  /** Altura máxima del contenedor del timeline. Default "500px". */
  maxHeight?: string;
}

// ─── Componente principal ────────────────────────────────────────────────

export function TicketHistoryTimeline({ ticketId, events: eventsProp, maxHeight = "500px" }: Props) {
  // Cuando viene snapshot (eventsProp) skip el fetch.
  const { data: fetched = [], isLoading } = useTicketHistory(eventsProp ? null : ticketId);
  const events = eventsProp ?? fetched;
  const loading = !eventsProp && isLoading;

  const counts = useMemo(() => {
    const c: Partial<Record<TicketHistoryKind, number>> = {};
    events.forEach(e => { c[e.kind] = (c[e.kind] || 0) + 1; });
    return c;
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
        <Clock className="h-4 w-4 mr-2 animate-spin" /> Cargando historial…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center gap-2">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">Sin historial registrado</p>
        <p className="text-[11px] text-muted-foreground max-w-sm">
          Los cambios en el caso, notas y accesos aparecerán aquí.
          Requiere que la migración <code>20260422160000_ticket_security</code> esté aplicada.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Chips resumen */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(counts) as [TicketHistoryKind, number][]).map(([kind, count]) => {
          const s = KIND_STYLES[kind];
          if (!s) return null;
          return (
            <Badge
              key={kind}
              variant="outline"
              className={`text-[10px] gap-1 ${s.bg} ${s.text} border-transparent`}
            >
              <s.Icon className="h-3 w-3" /> {s.label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="space-y-0 overflow-auto pr-1" style={{ maxHeight }}>
        {events.map((e, i) => (
          <TimelineItem key={e.id} event={e} isLast={i === events.length - 1} />
        ))}
      </div>
    </div>
  );
}
