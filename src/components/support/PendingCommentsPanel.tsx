import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquareWarning, Loader2, User, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { usePendingComments } from "@/hooks/useSupportTicketDetails";
import { useSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";
import { TicketDetailSheet } from "./TicketDetailSheet";

/**
 * Comentarios pendientes de atender (ERP-089).
 * Lista las solicitudes cuya última nota visible al cliente fue escrita por el
 * cliente (no por staff SYSDE) y siguen abiertas — es decir, esperan respuesta
 * de SVA. Al abrir una, se muestra el detalle del caso en vista interna.
 */
export function PendingCommentsPanel({ clientId }: { clientId?: string }) {
  const { data: pending = [], isLoading } = usePendingComments(clientId);
  const { data: tickets = [] } = useSupportTickets();
  const [openTicket, setOpenTicket] = useState<SupportTicket | null>(null);

  const open = (uuid: string) => {
    const t = tickets.find((x) => x.id === uuid);
    if (t) setOpenTicket(t);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-warning" />
          Comentarios pendientes de atender
          {pending.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-warning/40 bg-warning/10 text-warning">
              {pending.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : pending.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-6">
            Sin comentarios de clientes pendientes de respuesta. ✓
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((p) => (
              <button
                key={p.note_id}
                onClick={() => open(p.ticket_uuid)}
                className="w-full text-left p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors group"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                  <code className="font-mono font-bold text-foreground">{p.ticket_code}</code>
                  <span className="truncate">· {p.asunto}</span>
                  <Badge variant="outline" className="ml-auto text-[9px] h-3.5 px-1 shrink-0">{p.estado}</Badge>
                </div>
                <p className="text-xs line-clamp-2 text-foreground/90">{p.content}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                  <User className="h-3 w-3" />
                  <span className="truncate">{p.author_name || "Cliente"}</span>
                  <span>·</span>
                  <span>{p.created_at ? formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: es }) : ""}</span>
                  <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <TicketDetailSheet
        ticket={openTicket}
        open={!!openTicket}
        onOpenChange={(o) => !o && setOpenTicket(null)}
        canEditInternal
      />
    </Card>
  );
}
