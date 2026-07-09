import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, ShieldCheck, Timer, MessageSquareReply } from "lucide-react";
import { useSlaHistory } from "@/hooks/useSlaHistory";

function fmtH(h?: number | null): string {
  if (h == null || !isFinite(h)) return "—";
  if (h >= 48) return `${(h / 24).toFixed(1)}d`;
  return `${Math.round(h)}h`;
}
function pct(met: number, total: number): number | null {
  return total > 0 ? Math.round((met / total) * 100) : null;
}
function pctTone(p: number | null): string {
  if (p == null) return "";
  return p >= 90 ? "text-success" : p >= 70 ? "text-warning" : "text-destructive";
}
function barTone(p: number): string {
  return p >= 90 ? "bg-success" : p >= 70 ? "bg-warning" : "bg-destructive";
}
const PRIO_LABEL: Record<string, string> = { critica: "Crítica", alta: "Alta", media: "Media", baja: "Baja" };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return `${MONTHS[Number(mo) - 1] || mo} ${y?.slice(2) || ""}`;
}

export function SlaHistoryPanel({ clientId }: { clientId: string }) {
  const { data: h, isLoading } = useSlaHistory(clientId);

  const compliance = h ? pct(h.overall.met, h.overall.measured) : null;
  const respPct = h ? pct(h.response.met, h.response.measured) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Histórico de cumplimiento</h3>
        <span className="text-[11px] text-muted-foreground">casos cerrados · tiempo de resolución vs. SLA</span>
      </div>

      {isLoading || !h ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Cargando…</CardContent></Card>
      ) : h.overall.measured === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          {h.closed_total === 0
            ? "Aún no hay casos cerrados para este cliente."
            : `De ${h.closed_total} caso(s) cerrados, ninguno tiene fecha de entrega registrada (o SLA de su prioridad) para medir el tiempo de resolución. El histórico se llena a medida que los casos se cierran con fecha de entrega.`}
        </CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card className="overflow-hidden">
              <div className={`h-1 w-full ${compliance != null ? barTone(compliance) : "bg-transparent"}`} />
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Cumplimiento resolución</p>
                <p className={`text-2xl font-black tabular-nums ${pctTone(compliance)}`}>{compliance}%</p>
                <p className="text-[10px] text-muted-foreground">{h.overall.met}/{h.overall.measured} dentro del SLA</p>
              </CardContent>
            </Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Timer className="h-3 w-3" /> Resolución promedio</p>
              <p className="text-2xl font-black tabular-nums">{fmtH(h.overall.avg_resolution_hours)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><MessageSquareReply className="h-3 w-3" /> Primera respuesta</p>
              {h.response.measured > 0
                ? <><p className={`text-2xl font-black tabular-nums ${pctTone(respPct)}`}>{respPct}%</p><p className="text-[10px] text-muted-foreground">{h.response.met}/{h.response.measured} en plazo</p></>
                : <><p className="text-2xl font-black tabular-nums text-muted-foreground">—</p><p className="text-[10px] text-muted-foreground">sin registro de respuestas</p></>}
            </CardContent></Card>
          </div>

          <p className="text-[11px] text-muted-foreground">Medido sobre <b>{h.overall.measured}</b> de {h.closed_total} casos cerrados (los que tienen fecha de entrega y SLA de su prioridad).</p>

          {/* Tendencia mensual */}
          {h.by_month.length > 0 && (
            <Card><CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Cumplimiento por mes</p>
              <div className="space-y-1.5">
                {h.by_month.map((m) => {
                  const p = pct(m.met, m.total) ?? 0;
                  return (
                    <div key={m.month} className="flex items-center gap-3 text-xs">
                      <span className="w-14 text-muted-foreground capitalize">{monthLabel(m.month)}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${barTone(p)}`} style={{ width: `${Math.min(100, Math.max(3, p))}%` }} /></div>
                      <span className="w-24 text-right tabular-nums font-mono text-[11px]">{m.met}/{m.total} · {p}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent></Card>
          )}

          {/* Por prioridad */}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridad</TableHead>
                  <TableHead className="text-right">Casos</TableHead>
                  <TableHead className="text-right">Cumplidos</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Resolución prom.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {h.by_priority.map((r) => {
                  const p = pct(r.met, r.total);
                  return (
                    <TableRow key={r.priority}>
                      <TableCell><Badge variant="outline" className="text-[10px]">{PRIO_LABEL[r.priority] || r.priority}</Badge></TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.total}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.met}</TableCell>
                      <TableCell className={`text-right text-xs tabular-nums font-semibold ${pctTone(p)}`}>{p}%</TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-mono text-muted-foreground">{fmtH(r.avg_resolution_hours)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
