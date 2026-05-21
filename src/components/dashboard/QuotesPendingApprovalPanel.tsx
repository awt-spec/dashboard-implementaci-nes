import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuotesPendingApproval } from "@/hooks/useQuotes";
import { QuoteApprovalCard } from "@/components/support/quotes/QuoteApprovalCard";

/**
 * Portal cliente — PORTAL-005: "Consultar cotizaciones pendientes de aprobar".
 * Lista las cotizaciones con status='sent' del cliente actual y permite aprobar/rechazar.
 */
export function QuotesPendingApprovalPanel() {
  const { clienteAssignment } = useAuth();
  const clientId = clienteAssignment?.client_id;
  const { data: quotes, isLoading } = useQuotesPendingApproval(clientId);

  if (!clientId) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-info" />
            Cotizaciones pendientes de aprobar
          </CardTitle>
          {quotes && quotes.length > 0 && (
            <span className="text-[10px] font-semibold bg-info/15 text-info px-2 py-0.5 rounded-full">
              {quotes.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !quotes || quotes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 italic">
            No tenés cotizaciones pendientes de revisar.
          </p>
        ) : (
          <div className="space-y-3">
            {quotes.map(q => (
              <QuoteApprovalCard key={q.id} quoteId={q.id} defaultOpen={quotes.length === 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
