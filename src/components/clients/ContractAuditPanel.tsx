import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldAlert, ShieldCheck, AlertTriangle, Gauge, ScanSearch, HelpCircle, XCircle, CheckCircle2 } from "lucide-react";
import { useContractHoursAudit, type AuditStatus } from "@/hooks/useContractAudit";
import { useContractScopeAudit, type ScopeAuditResult, type ScopeVerdict } from "@/hooks/useContractScopeAudit";
import { useAuth } from "@/hooks/useAuth";
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

const VERDICT_META: Record<ScopeVerdict, { label: string; tone: string; icon: any }> = {
  dentro: { label: "Dentro", tone: "text-success border-success/30 bg-success/10", icon: CheckCircle2 },
  fuera: { label: "Fuera de alcance", tone: "text-destructive border-destructive/30 bg-destructive/10", icon: XCircle },
  dudoso: { label: "Dudoso", tone: "text-warning border-warning/30 bg-warning/10", icon: HelpCircle },
};

export function ContractAuditPanel({ clientId, contractId }: { clientId: string; contractId?: string }) {
  const { data: audit, isLoading } = useContractHoursAudit(clientId);
  const { canAmounts } = useFinanceAccess();
  const { role } = useAuth();
  const canManage = role === "admin" || role === "pm";
  const scopeAudit = useContractScopeAudit(clientId);
  const [scope, setScope] = useState<ScopeAuditResult | null>(null);

  const runScope = () => {
    setScope(null);
    scopeAudit.mutate({ contractId }, {
      onSuccess: (r) => {
        setScope(r);
        toast.success(`Alcance auditado — ${r.fuera} fuera, ${r.dudoso} dudosos de ${r.evaluated}`);
      },
      onError: (e: any) => toast.error(e.message),
    });
  };

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

      {/* ── Capa 2: auditoría de alcance (IA/RAG) ─────────────────────── */}
      <div className="pt-2 border-t border-border/60">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><ScanSearch className="h-4 w-4" /> Auditoría de alcance</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
              Evalúa las gestiones recientes contra el alcance del contrato ingestado en la Base de conocimiento. Marca lo que parece fuera de contrato para revisión.
            </p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" onClick={runScope} disabled={scopeAudit.isPending} className="gap-1.5">
              {scopeAudit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5 text-primary" />}
              Auditar alcance
            </Button>
          )}
        </div>

        {scope && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[11px]">{scope.evaluated} evaluadas</Badge>
              <Badge variant="outline" className="text-[11px] text-destructive border-destructive/30 bg-destructive/10">{scope.fuera} fuera</Badge>
              <Badge variant="outline" className="text-[11px] text-warning border-warning/30 bg-warning/10">{scope.dudoso} dudosas</Badge>
            </div>
            <p className="text-sm">{scope.audit.resumen}</p>
            <p className="text-[11px] text-muted-foreground border-l-2 border-primary/40 pl-2">
              Resultado orientativo (IA): revisá los marcados antes de accionar. No modifica ningún dato.
            </p>
            <div className="space-y-2">
              {scope.audit.hallazgos
                .slice()
                .sort((a, b) => (a.veredicto === "fuera" ? 0 : a.veredicto === "dudoso" ? 1 : 2) - (b.veredicto === "fuera" ? 0 : b.veredicto === "dudoso" ? 1 : 2))
                .map((h, i) => {
                  const vm = VERDICT_META[h.veredicto];
                  const VIcon = vm.icon;
                  return (
                    <div key={i} className={`rounded-lg border p-2.5 ${h.veredicto === "dentro" ? "opacity-70" : ""}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${vm.tone}`}><VIcon className="h-3 w-3" />{vm.label}</Badge>
                        <span className="text-xs font-mono text-muted-foreground">{h.ticket_id}</span>
                        {h.asunto && <span className="text-xs font-medium truncate">{h.asunto}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{h.razon}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
