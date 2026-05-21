import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ChevronRight, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuotes } from "@/hooks/useQuotes";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { CreateQuoteDialog } from "./CreateQuoteDialog";
import { QuoteDetailSheet } from "./QuoteDetailSheet";

interface Props {
  ticketId?: string;
  clientId: string;
  /** Mostrar header con CTA "Nueva cotización". Default true. */
  showHeader?: boolean;
}

export function QuoteList({ ticketId, clientId, showHeader = true }: Props) {
  const { role } = useAuth();
  const isStaff = role && role !== "cliente";

  const { data: quotes, isLoading, isError, error } = useQuotes({ ticketId, clientId });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Cotizaciones</h3>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {quotes?.length ?? 0}
            </span>
          </div>
          {isStaff && (
            <CreateQuoteDialog ticketId={ticketId} clientId={clientId} />
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">No se pudo cargar el módulo de cotizaciones</p>
              <p className="text-[11px] mt-1">
                {(error as Error)?.message ?? "Error desconocido"}.
                Si recién se hizo deploy, la migración SQL podría no haberse aplicado todavía.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !quotes || quotes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Sin cotizaciones todavía.</p>
            {isStaff && (
              <CreateQuoteDialog
                ticketId={ticketId}
                clientId={clientId}
                trigger={<Button variant="link" size="sm" className="text-xs">Crear la primera</Button>}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {quotes.map(q => (
            <Card
              key={q.id}
              className="cursor-pointer hover:shadow-sm transition-all"
              onClick={() => setSelectedId(q.id)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold tabular-nums">{q.quote_number}</span>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <p className="text-xs text-foreground truncate font-medium">{q.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Creada {new Date(q.created_at).toLocaleDateString()}
                    {q.valid_until && ` · Vence ${new Date(q.valid_until).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">
                    {Number(q.total_amount).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{q.currency}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QuoteDetailSheet
        quoteId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </div>
  );
}
