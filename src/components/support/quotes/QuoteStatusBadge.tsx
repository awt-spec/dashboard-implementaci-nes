import { Badge } from "@/components/ui/badge";
import { FileText, Send, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import type { QuoteStatus } from "@/hooks/useQuotes";

const CONFIG: Record<QuoteStatus, { label: string; className: string; icon: typeof FileText }> = {
  draft:     { label: "Borrador",  className: "bg-muted text-muted-foreground border-border",                              icon: FileText },
  sent:      { label: "Enviada",   className: "bg-info/10 text-info border-info/30",                                       icon: Send },
  approved:  { label: "Aprobada",  className: "bg-success/10 text-success border-success/30",                              icon: CheckCircle2 },
  rejected:  { label: "Rechazada", className: "bg-destructive/10 text-destructive border-destructive/30",                  icon: XCircle },
  expired:   { label: "Expirada",  className: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",    icon: Clock },
  cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border line-through",                 icon: Ban },
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[10px] font-medium">{cfg.label}</span>
    </Badge>
  );
}
