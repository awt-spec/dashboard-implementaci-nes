import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, ShieldCheck, AlertTriangle, Gauge } from "lucide-react";
import { useContractHoursAudit, type AuditStatus } from "@/hooks/useContractAudit";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { Confidential } from "@/components/common/Confidential";

const STATUS_META: Record<AuditStatus, { label: string; tone: string; icon: any; note: string }> = {
  dentro: { label: "Dentro del contrato", tone: "text-success border-success/30 bg-success/10", icon: ShieldCheck, note: "El consumo está dentro del cupo contratado." },
  en_riesgo: { label: "En riesgo", tone: "text-warning border-warning/30 bg-warning/10", icon: AlertTriangle, note: "El consumo superó el 80% del cupo. Conviene avisar antes de excederse." },
  excedido: { label: "Excedido", tone: "text-destructive border-destructive/30 bg-destructive/10", icon: ShieldAlert, note: "Se superó el cupo de horas del contrato. Toda hora adicional es fuera de contrato." },
  sin_contrato: { label: "Sin contrato activo", tone: "text-muted-foreground border-border bg-muted/30", icon: Gauge, note: "No hay contrato activo con cupo de horas para auditar." },
  sin_cupo: { label: "Sin cupo definido", tone: "text-muted-foreground border-border bg-muted/30", icon: Gauge, note: "El contrato activo no define horas incluidas (cupo). No se puede auditar consumo." },
};

const fmtH = (h: number) => `${h.toFixed(1)}h`;

export function ContractAuditPanel({ clientId }: { clientId: string }) {
  const { data: audit, isLoading } = useContractHoursAudit(clientId);
  const { canAmounts } = useFinanceAccess();

  if (isLoading) {
    return <Card><CardContent className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;
  }
  if (!audit) return null;

  const meta = STATUS_META[audit.status];
  const Icon = meta.icon;
  const hasCupo = audit.status === "dentro" || audit.status === "en_riesgo" || audit.status === "excedido";
  const pctClamped = Math.min(100, audit.pct);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2"><Gauge className="h-4 w-4" /> Auditoría del contrato — horas</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Consumo real (registros de tiempo) contra el cupo contratado.
          {audit.periodLabel ? ` Período auditado: ${audit.periodLabel}.` : ""}
        </p>
      </div>

      {/* Estado principal */}
      <div className={`rounded-lg border p-4 flex items-start gap-3 ${meta.tone}`}>
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{meta.label}</p>
          <p className="text-xs opacity-90 mt-0.5">{meta.note}</p>
        </div>
      </div>

      {hasCupo && (
        <>
          {/* Barra de consumo */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Consumido / Contratado</p>
                  <p className="text-2xl font-black tabular-nums">
                    {fmtH(audit.consumedHours)} <span className="text-sm font-normal text-muted-foreground">/ {fmtH(audit.includedHours)}</span>
                  </p>
                </div>
                <Badge variant="outline" className="tabular-nums">{audit.pct.toFixed(0)}%</Badge>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${audit.status === "excedido" ? "bg-destructive" : audit.status === "en_riesgo" ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${Math.max(2, pctClamped)}%` }}
                />
                {/* Marca del 100% cuando hay exceso */}
                {audit.status === "excedido" && <div className="absolute top-0 bottom-0 w-px bg-foreground/40" style={{ left: `${(audit.includedHours / audit.consumedHours) * 100}%` }} />}
              </div>
            </CardContent>
          </Card>

          {/* Exceso */}
          {audit.status === "excedido" && (
            <div className="grid grid-cols-2 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Horas fuera de contrato</p>
                <p className="text-2xl font-black tabular-nums text-destructive">{fmtH(audit.overHours)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Costo estimado del exceso</p>
                <p className="text-2xl font-black tabular-nums">
                  {audit.overCost != null
                    ? <Confidential show={canAmounts}>${Math.round(audit.overCost).toLocaleString()} {audit.currency}</Confidential>
                    : <span className="text-sm font-normal text-muted-foreground">sin tarifa/hora</span>}
                </p>
              </CardContent></Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
