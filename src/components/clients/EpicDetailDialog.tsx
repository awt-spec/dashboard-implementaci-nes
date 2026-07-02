import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings2, Server, SlidersHorizontal, GraduationCap, Code2, CheckCircle2, CircleDot, Circle, Ban, User } from "lucide-react";
import { toast } from "sonner";
import { useUpdateHuBilling, BILLING_STATUS, type EpicKey, type BillingStatus, type EpicSummary, type EpicHU } from "@/hooks/useEpics";

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

function huStatusMeta(h: EpicHU) {
  if (h.done) return { label: "Terminada", Icon: CheckCircle2, cls: "text-success" };
  if (h.status === "bloqueada") return { label: "Bloqueada", Icon: Ban, cls: "text-destructive" };
  if (h.status === "en-progreso" || h.scrum_status === "in_progress" || h.scrum_status === "in_sprint")
    return { label: "En progreso", Icon: CircleDot, cls: "text-warning" };
  return { label: "Pendiente", Icon: Circle, cls: "text-muted-foreground" };
}

interface Props {
  clientId: string;
  epic: EpicSummary | null;
  onOpenChange: (open: boolean) => void;
}

/** Zoom-in de una épica: las HU que la componen con estado, puntos, responsable
 *  y facturación editable. Reutilizado por el panel de épicas y por las fases. */
export function EpicDetailDialog({ clientId, epic, onOpenChange }: Props) {
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
    <Dialog open={!!epic} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {epic && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                {(() => { const Icon = EPIC_ICON[epic.key]; return <Icon className="h-4 w-4 text-primary" />; })()}
                {epic.label}
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex-1"><Progress value={epic.progress} className="h-2" /></div>
              <span className="font-bold tabular-nums">{epic.progress}%</span>
              <span className="text-muted-foreground tabular-nums">{epic.done}/{epic.total} HU</span>
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
                  {epic.hus.map((h) => {
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
  );
}
