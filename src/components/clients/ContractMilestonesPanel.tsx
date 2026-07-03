import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Milestone, FileText, Loader2, CheckCircle2, X, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useContractMilestones, useUpdateMilestone, MILESTONE_META, NEXT_STATUS,
} from "@/hooks/useContractMilestones";
import { Confidential } from "@/components/common/Confidential";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";

const TONE_CLASS: Record<string, string> = {
  muted: "bg-muted text-muted-foreground border-border",
  info: "bg-info/15 text-info border-info/30",
  success: "bg-success/15 text-success border-success/30",
  primary: "bg-primary/15 text-primary border-primary/30",
};

/**
 * Hitos de facturación derivados del contrato por IA (S2-01/S2-02): cada hito
 * enlazado a su cláusula y condición; una persona confirma el cumplimiento.
 */
export function ContractMilestonesPanel({ contractId }: { contractId: string }) {
  const { data: milestones = [], isLoading } = useContractMilestones(contractId);
  const update = useUpdateMilestone(contractId);
  const { canAmounts } = useFinanceAccess();

  const act = (id: string, status: any, msg: string) => {
    update.mutate({ id, status }, {
      onSuccess: () => toast.success(msg),
      onError: (e: any) => toast.error(e?.message || "Error"),
    });
  };

  if (isLoading) {
    return <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }
  if (milestones.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic px-1">
        La IA no detectó hitos de facturación explícitos en este contrato. Si el contrato los tiene, subilo/analizalo de nuevo o agregá el clausulado.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {milestones.map((m) => {
        const meta = MILESTONE_META[m.status];
        const next = NEXT_STATUS[m.status];
        const active = m.status !== "descartado";
        return (
          <div key={m.id} className={`rounded-lg border p-3 ${m.status === "cumplido" ? "border-success/40 bg-success/5" : "border-border"} ${!active ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[11px] font-bold tabular-nums mt-0.5">
                  {m.numero ?? "•"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{m.descripcion}</p>
                  {m.condicion && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-medium">Se dispara con:</span> {m.condicion}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {m.clausula_referencia && (
                      <Badge variant="outline" className="text-[9px] gap-1"><FileText className="h-2.5 w-2.5" /> {m.clausula_referencia}</Badge>
                    )}
                    {m.horas != null && <Badge variant="outline" className="text-[9px]">{m.horas} h</Badge>}
                    {m.porcentaje != null && (
                      <Badge variant="outline" className="text-[9px]"><Confidential show={canAmounts}>{m.porcentaje}%</Confidential></Badge>
                    )}
                    {m.monto != null && (
                      <Badge variant="outline" className="text-[9px]"><Confidential show={canAmounts}>{Number(m.monto).toLocaleString()} {m.moneda || ""}</Confidential></Badge>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className={`text-[9px] shrink-0 ${TONE_CLASS[meta.tone]}`}>{meta.label}</Badge>
            </div>

            {active && (next || m.status !== "facturado") && (
              <div className="flex items-center gap-1.5 mt-2 pl-8">
                {next && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                    onClick={() => act(m.id, next.to, `Hito ${next.to}`)} disabled={update.isPending}>
                    {m.status === "propuesto" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {next.label}
                  </Button>
                )}
                {m.status === "propuesto" && (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-muted-foreground"
                    onClick={() => act(m.id, "descartado", "Hito descartado")} disabled={update.isPending}>
                    <X className="h-3 w-3" /> Descartar
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground italic px-1 flex items-center gap-1">
        <Milestone className="h-3 w-3" /> La IA propone los hitos desde el contrato; una persona confirma el cumplimiento para activar el disparador de facturación.
      </p>
    </div>
  );
}
