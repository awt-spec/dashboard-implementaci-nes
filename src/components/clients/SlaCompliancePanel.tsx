import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gauge, TriangleAlert, Clock, CheckCircle2, ShieldCheck } from "lucide-react";
import { useSlaCompliance, formatCutoff, type SlaLevel } from "@/hooks/useSlaCompliance";
import { TicketDetailSheet } from "@/components/support/TicketDetailSheet";
import type { SupportTicket } from "@/hooks/useSupportTickets";

function fmtH(h: number): string {
  if (!isFinite(h)) return "—";
  if (h >= 48) return `${(h / 24).toFixed(1)}d`;
  return `${Math.round(h)}h`;
}
const LEVEL: Record<SlaLevel, { label: string; badge: string; bar: string }> = {
  breached: { label: "Vencido", badge: "bg-destructive/15 text-destructive border-destructive/30", bar: "bg-destructive" },
  at_risk: { label: "En riesgo", badge: "bg-warning/15 text-warning border-warning/30", bar: "bg-warning" },
  on_track: { label: "A tiempo", badge: "bg-success/15 text-success border-success/30", bar: "bg-success" },
};

export function SlaCompliancePanel({ clientId }: { clientId: string }) {
  const { rows, summary, cutoff } = useSlaCompliance(clientId);
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const desde = formatCutoff(cutoff);
  const pct = summary.compliancePct;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold flex items-center gap-2"><Gauge className="h-4 w-4" /> Cumplimiento SLA por caso</h3>
        <span className="text-[11px] text-muted-foreground">casos abiertos vs. tiempo de resolución del SLA</span>
      </div>

      {summary.withSla === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          {summary.sinSla > 0
            ? `Hay ${summary.sinSla} caso(s) abiertos, pero ninguno tiene un SLA aplicable a su prioridad. Definí SLAs arriba para medir el cumplimiento.`
            : "Sin casos abiertos con SLA para evaluar."}
        </CardContent></Card>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="overflow-hidden">
              {/* Gris cuando no hay nada medido: pintarlo de rojo sería acusar
                  al equipo de un 0% que todavía nadie ganó ni perdió. */}
              <div className={`h-1 w-full ${pct == null ? "bg-muted" : pct >= 90 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-destructive"}`} />
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Cumplimiento</p>
                <p className={`text-2xl font-black tabular-nums ${pct == null ? "text-muted-foreground" : ""}`}>{pct == null ? "—" : `${pct}%`}</p>
                <p className="text-[10px] text-muted-foreground">
                  {pct == null
                    ? desde ? `sin casos desde el ${desde}` : "sin casos medibles"
                    : `${summary.measured - summary.measuredBreached}/${summary.measured} dentro del SLA`}
                </p>
              </CardContent>
            </Card>
            <KpiMini icon={<CheckCircle2 className="h-3 w-3" />} tone="text-success" label="A tiempo" value={summary.onTrack} />
            <KpiMini icon={<Clock className="h-3 w-3" />} tone="text-warning" label="En riesgo" value={summary.atRisk} />
            <KpiMini icon={<TriangleAlert className="h-3 w-3" />} tone="text-destructive" label="Vencidos" value={summary.breached} />
          </div>
          {summary.sinSla > 0 && (
            <p className="text-[11px] text-muted-foreground">{summary.sinSla} caso(s) abiertos sin SLA aplicable a su prioridad (no se miden).</p>
          )}
          {/* La tabla de abajo lista TODOS los casos abiertos; el porcentaje de
              arriba sale sólo de los posteriores al corte. Sin decirlo, los dos
              números se contradicen a la vista. */}
          {desde && summary.withSla > summary.measured && (
            <p className="text-[11px] text-muted-foreground">
              El cumplimiento se mide sobre los {summary.measured} caso(s) registrados desde el {desde}.
              Los {summary.withSla - summary.measured} anteriores se listan abajo y hay que atenderlos, pero
              su plazo ya venció antes del corte y no entran al porcentaje.
            </p>
          )}
          {/* Retrodatar la fecha saca el caso de la medición. A veces es
              correcto —llegó antes y se registró tarde— así que no se bloquea.
              Pero es la única salida por la que un caso deja de medirse sin
              que nadie lo note, y por eso se cuenta a la vista. */}
          {summary.registeredLate > 0 && (
            <p className="text-[11px] text-warning">
              {summary.registeredLate} caso(s) se cargaron después del corte con fecha anterior, así que
              quedaron fuera de la medición. Si la fecha está mal, corregila para que el caso vuelva a contar.
            </p>
          )}

          {/* Tabla por caso */}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caso</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead className="text-right">Transcurrido</TableHead>
                  <TableHead className="text-right">Límite</TableHead>
                  <TableHead className="w-[160px]">Consumo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const L = LEVEL[r.level];
                  return (
                    <TableRow key={r.ticket.id} className="cursor-pointer" onClick={() => setDetail(r.ticket)}>
                      <TableCell className="max-w-[240px]">
                        <p className="text-xs font-mono text-muted-foreground">{r.ticket.ticket_id}</p>
                        <p className="text-xs font-medium truncate">{r.ticket.asunto}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.ticket.prioridad}</Badge></TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-mono">{fmtH(r.elapsedHours)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-mono text-muted-foreground">{fmtH(r.limitHours)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${L.bar}`} style={{ width: `${Math.min(100, Math.max(3, r.pct))}%` }} />
                          </div>
                          <span className={`text-[10px] tabular-nums font-semibold w-9 text-right ${r.level === "breached" ? "text-destructive" : r.level === "at_risk" ? "text-warning" : "text-muted-foreground"}`}>{r.pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] ${L.badge}`}>{L.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </>
      )}

      <TicketDetailSheet ticket={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} canEditInternal />
    </div>
  );
}

function KpiMini({ icon, tone, label, value }: { icon: React.ReactNode; tone: string; label: string; value: number }) {
  return (
    <Card><CardContent className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><span className={tone}>{icon}</span> {label}</p>
      <p className={`text-2xl font-black tabular-nums ${value > 0 && tone === "text-destructive" ? "text-destructive" : ""}`}>{value}</p>
    </CardContent></Card>
  );
}
