import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Settings2, Server, SlidersHorizontal, GraduationCap, Code2,
  Receipt, Loader2, Layers, ChevronRight, CheckCircle2, CircleDot, Circle, Ban, User,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEpics, useUpdateHuBilling, BILLING_STATUS, EPIC_LABEL,
  type EpicKey, type BillingStatus, type EpicSummary, type EpicHU,
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

/** Estado de trabajo de la HU → etiqueta + ícono + tono. */
function huStatusMeta(h: EpicHU) {
  if (h.done) return { label: "Terminada", Icon: CheckCircle2, cls: "text-success" };
  if (h.status === "bloqueada") return { label: "Bloqueada", Icon: Ban, cls: "text-destructive" };
  if (h.status === "en-progreso" || h.scrum_status === "in_progress" || h.scrum_status === "in_sprint")
    return { label: "En progreso", Icon: CircleDot, cls: "text-warning" };
  return { label: "Pendiente", Icon: Circle, cls: "text-muted-foreground" };
}

interface Props {
  clientId: string;
}

export function EpicsProgressPanel({ clientId }: Props) {
  const { data, isLoading } = useEpics(clientId);
  const updateBilling = useUpdateHuBilling(clientId);
  const [detail, setDetail] = useState<EpicSummary | null>(null);

  const changeBilling = (id: string, billing_status: BillingStatus) => {
    updateBilling.mutate(
      { id, billing_status },
      {
        onSuccess: () => toast.success("Estado de facturación actualizado"),
        onError: (e: any) => toast.error(e?.message || "Error al actualizar"),
      },
    );
  };

  // Re-lookup de la épica abierta para reflejar cambios sin cerrar el diálogo.
  const openEpic = detail ? data?.summaries.find((s) => s.key === detail.key) ?? detail : null;

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
        <CardContent className="space-y-2">
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
                <button
                  key={e.key}
                  onClick={() => e.total > 0 && setDetail(e)}
                  disabled={e.total === 0}
                  className="w-full text-left space-y-1 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors disabled:opacity-60 disabled:hover:bg-transparent disabled:cursor-default"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate">{e.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground tabular-nums">{e.done}/{e.total} HU</span>
                      <span className="text-[11px] font-bold tabular-nums w-9 text-right">{e.progress}%</span>
                      {e.total > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                  <Progress value={e.progress} className="h-2" />
                </button>
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

      {/* ── Detalle de épica (zoom-in): HU que la componen ── */}
      <Dialog open={!!openEpic} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {openEpic && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  {(() => { const Icon = EPIC_ICON[openEpic.key]; return <Icon className="h-4 w-4 text-primary" />; })()}
                  {openEpic.label}
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex-1"><Progress value={openEpic.progress} className="h-2" /></div>
                <span className="font-bold tabular-nums">{openEpic.progress}%</span>
                <span className="text-muted-foreground tabular-nums">{openEpic.done}/{openEpic.total} HU</span>
              </div>

              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase text-muted-foreground border-b">
                      <th className="text-left font-medium py-1.5 pr-2">HU</th>
                      <th className="text-left font-medium py-1.5 px-2">Título</th>
                      <th className="text-left font-medium py-1.5 px-2">Estado</th>
                      <th className="text-right font-medium py-1.5 px-2">Pts</th>
                      <th className="text-left font-medium py-1.5 px-2">Responsable</th>
                      <th className="text-left font-medium py-1.5 pl-2">Facturación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openEpic.hus.map((h) => {
                      const s = huStatusMeta(h);
                      const b = BILLING_STATUS[h.billing_status];
                      return (
                        <tr key={h.id} className="border-b last:border-0 align-top">
                          <td className="py-1.5 pr-2 tabular-nums font-semibold whitespace-nowrap">{h.hu_code ?? "—"}</td>
                          <td className="py-1.5 px-2 max-w-[280px]">{h.title}</td>
                          <td className="py-1.5 px-2">
                            <span className={`inline-flex items-center gap-1 ${s.cls}`}>
                              <s.Icon className="h-3 w-3" /> {s.label}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{h.story_points ?? "—"}</td>
                          <td className="py-1.5 px-2">
                            {h.owner ? (
                              <span className="inline-flex items-center gap-1"><User className="h-3 w-3 text-muted-foreground" />{h.owner}</span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-1.5 pl-2">
                            <Select value={h.billing_status} onValueChange={(v) => changeBilling(h.id, v as BillingStatus)}>
                              <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none w-auto gap-1">
                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${TONE_CLASS[b.tone]}`}>{b.label}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {BILLING_KEYS.map((k) => (
                                  <SelectItem key={k} value={k} className="text-xs">{BILLING_STATUS[k].label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
