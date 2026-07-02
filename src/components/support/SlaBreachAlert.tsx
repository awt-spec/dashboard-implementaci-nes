import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertOctagon, Clock, ShieldCheck } from "lucide-react";
import { useSlaAlerts, type SlaTicketStatus } from "@/hooks/useSlaAlerts";

const fmtH = (h: number) => (h >= 24 ? `${(h / 24).toFixed(1)}d` : `${Math.round(h)}h`);

interface Props {
  clientId: string;
  onSelectTicket?: (id: string) => void;
  /** Muestra un estado "en verde" cuando no hay incumplimientos. Default false. */
  showOk?: boolean;
}

/** Alerta activa de incumplimiento de SLA: el SLA "juega en la cancha". */
export function SlaBreachAlert({ clientId, onSelectTicket, showOk = false }: Props) {
  const { breached, atRisk } = useSlaAlerts(clientId);

  if (breached.length === 0 && atRisk.length === 0) {
    if (!showOk) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30 text-xs text-success">
        <ShieldCheck className="h-3.5 w-3.5" /> SLA al día — sin incumplimientos.
      </div>
    );
  }

  const Row = ({ s }: { s: SlaTicketStatus }) => (
    <button
      onClick={() => onSelectTicket?.(s.ticket.id)}
      className="w-full text-left flex items-center gap-2 p-2 rounded-md bg-background hover:bg-muted/50 border border-border"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{s.ticket.asunto}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {s.ticket.ticket_id} · {s.ticket.producto || "—"} · {s.sla.priority_level}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-[11px] font-bold tabular-nums ${s.level === "breached" ? "text-destructive" : "text-warning"}`}>
          {fmtH(s.elapsedHours)} / {fmtH(s.limitHours)}
        </p>
        <p className="text-[9px] text-muted-foreground tabular-nums">
          {s.level === "breached" ? `+${fmtH(s.overageHours)} sobre SLA` : `${s.pct}% del SLA`}
        </p>
      </div>
    </button>
  );

  return (
    <Card className={breached.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {breached.length > 0 ? (
            <AlertOctagon className="h-4 w-4 text-destructive" />
          ) : (
            <Clock className="h-4 w-4 text-warning" />
          )}
          <h3 className="text-sm font-bold">Cumplimiento de SLA</h3>
          {breached.length > 0 && (
            <Badge variant="outline" className="text-[9px] bg-destructive/15 text-destructive border-destructive/30">
              {breached.length} incumplido{breached.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {atRisk.length > 0 && (
            <Badge variant="outline" className="text-[9px] bg-warning/15 text-warning border-warning/30">
              {atRisk.length} en riesgo
            </Badge>
          )}
        </div>

        {breached.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-destructive font-semibold">Incumplidos (tiempo de resolución superado)</p>
            {breached.slice(0, 5).map((s) => <Row key={s.ticket.id} s={s} />)}
            {breached.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">y {breached.length - 5} más…</p>
            )}
          </div>
        )}

        {atRisk.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-warning font-semibold">En riesgo (≥80% del SLA)</p>
            {atRisk.slice(0, 3).map((s) => <Row key={s.ticket.id} s={s} />)}
            {atRisk.length > 3 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">y {atRisk.length - 3} más…</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
