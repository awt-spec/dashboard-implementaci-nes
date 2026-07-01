import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  Settings2, Server, SlidersHorizontal, GraduationCap, Code2,
  Receipt, Loader2, Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEpics, useUpdateHuBilling, BILLING_STATUS, EPIC_LABEL,
  type EpicKey, type BillingStatus,
} from "@/hooks/useEpics";

const EPIC_ICON: Record<EpicKey, typeof Server> = {
  administracion: Settings2,
  infraestructura: Server,
  parametrizacion: SlidersHorizontal,
  capacitaciones: GraduationCap,
  desarrollos: Code2,
};

const TONE_CLASS: Record<string, string> = {
  muted: "bg-muted text-muted-foreground border-border",
  info: "bg-info/15 text-info border-info/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  success: "bg-success/15 text-success border-success/30",
  primary: "bg-primary/15 text-primary border-primary/30",
};

const BILLING_KEYS: BillingStatus[] = [
  "en_asignacion", "en_desarrollo", "lista_para_facturar", "facturada", "sin_estado",
];

interface Props {
  clientId: string;
}

export function EpicsProgressPanel({ clientId }: Props) {
  const { data, isLoading } = useEpics(clientId);
  const updateBilling = useUpdateHuBilling(clientId);

  const changeBilling = (id: string, billing_status: BillingStatus) => {
    updateBilling.mutate(
      { id, billing_status },
      {
        onSuccess: () => toast.success("Estado de facturación actualizado"),
        onError: (e: any) => toast.error(e?.message || "Error al actualizar"),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Avance por épica ── */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Avance por épica
          </CardTitle>
          {data && (
            <span className="text-[11px] text-muted-foreground">
              Global <span className="font-bold text-foreground tabular-nums">{data.overall}%</span> ·
              calculado del backlog
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !data || data.hus.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">
              No hay HU en el backlog de este cliente todavía.
            </p>
          ) : (
            data.summaries.map((e) => {
              const Icon = EPIC_ICON[e.key];
              return (
                <div key={e.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate">{e.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {e.done}/{e.total} HU
                      </span>
                      <span className="text-[11px] font-bold tabular-nums w-9 text-right">{e.progress}%</span>
                    </div>
                  </div>
                  <Progress value={e.progress} className="h-2" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ── Disparadores de facturación ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-success" /> Disparadores de facturación
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !data || data.billingTriggers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">
              Sin HU en asignación ni listas para facturar.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {data.billingTriggers.map((h) => {
                const meta = BILLING_STATUS[h.billing_status];
                return (
                  <div
                    key={h.id}
                    className={`rounded-lg border p-2 ${h.billing_status === "lista_para_facturar" ? "border-success/40 bg-success/5" : "border-border"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold tabular-nums text-foreground shrink-0">
                        {h.hu_code ?? "HU—"}
                      </span>
                      <Select value={h.billing_status} onValueChange={(v) => changeBilling(h.id, v as BillingStatus)}>
                        <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none w-auto gap-1">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${TONE_CLASS[meta.tone]}`}>
                            {meta.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {BILLING_KEYS.map((k) => (
                            <SelectItem key={k} value={k} className="text-xs">{BILLING_STATUS[k].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[11px] text-foreground/90 line-clamp-2 mt-0.5">{h.title}</p>
                    {h.epic && (
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">{EPIC_LABEL[h.epic]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
