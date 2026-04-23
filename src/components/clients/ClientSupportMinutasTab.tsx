import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Calendar, Headset, Loader2, Inbox, Eye, MessageSquare, ChevronRight,
  FileText, Clock,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  SupportPresentationView,
  type PresentationSnapshot,
} from "@/components/support/SupportPresentationView";
import { MinuteFeedbackList } from "@/components/support/MinuteFeedbackList";

interface PublishedMinuta {
  id: string;
  title: string;
  client_id: string | null;
  selected_slides: number[];
  presentation_snapshot: PresentationSnapshot;
  created_at: string;
  expires_at: string | null;
}

interface FeedbackCount {
  shared_presentation_id: string;
  count: number;
}

interface Props {
  clientId: string;
  clientName: string;
}

export function ClientSupportMinutasTab({ clientId, clientName }: Props) {
  const [openMinutaId, setOpenMinutaId] = useState<string | null>(null);

  const { data: minutas = [], isLoading } = useQuery({
    queryKey: ["client-support-minutas", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_support_presentations")
        .select("id, title, client_id, selected_slides, presentation_snapshot, created_at, expires_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PublishedMinuta[];
    },
  });

  const { data: feedbackCounts = [] } = useQuery({
    queryKey: ["client-support-minutas-feedback-counts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_minutes_feedback" as any)
        .select("shared_presentation_id")
        .eq("client_id", clientId);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data || []).forEach((row: any) => {
        if (row.shared_presentation_id) {
          counts.set(row.shared_presentation_id, (counts.get(row.shared_presentation_id) ?? 0) + 1);
        }
      });
      return Array.from(counts.entries()).map(([shared_presentation_id, count]) => ({
        shared_presentation_id,
        count,
      })) as FeedbackCount[];
    },
    enabled: !!clientId,
  });

  const countByMinuta = useMemo(() => {
    const m = new Map<string, number>();
    feedbackCounts.forEach(f => m.set(f.shared_presentation_id, f.count));
    return m;
  }, [feedbackCounts]);

  const openMinuta = useMemo(
    () => minutas.find(m => m.id === openMinutaId) ?? null,
    [minutas, openMinutaId],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Headset className="h-4 w-4 text-primary" />
            Minutas de Soporte
          </h2>
          <p className="text-xs text-muted-foreground">
            Minutas publicadas al perfil de {clientName}. Se crean desde el dashboard de Soporte → «Compartir».
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {minutas.length} minuta{minutas.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {minutas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="inline-flex h-12 w-12 rounded-full bg-muted items-center justify-center mb-3">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold mb-1">Aún no hay minutas publicadas</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Cuando desde el dashboard de Soporte generes una minuta y hagas clic en «Compartir»,
              aparecerá acá automáticamente para que el cliente la vea y deje feedback.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {minutas.map(m => {
            const feedbackCount = countByMinuta.get(m.id) ?? 0;
            const minutaDate = m.presentation_snapshot?.minuta?.date ?? m.created_at;
            const ticketsCount = m.presentation_snapshot?.tickets?.length ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => setOpenMinutaId(m.id)}
                className={cn(
                  "w-full text-left group",
                  "rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors",
                  "p-4 flex items-start gap-3",
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold truncate">{m.title}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(minutaDate), "dd/MM/yyyy", { locale: es })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                    </span>
                    <span>{ticketsCount} caso{ticketsCount === 1 ? "" : "s"}</span>
                    <span>{m.selected_slides?.length ?? 0} diapositiva{m.selected_slides?.length === 1 ? "" : "s"}</span>
                    {feedbackCount > 0 && (
                      <Badge variant="outline" className="gap-1 text-[9px] bg-info/10 text-info border-info/30">
                        <MessageSquare className="h-2.5 w-2.5" />
                        {feedbackCount} feedback
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Sheet con presentación + feedback */}
      <Sheet open={!!openMinutaId} onOpenChange={(o) => !o && setOpenMinutaId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader className="mb-3">
            <SheetTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              {openMinuta?.title ?? "Minuta"}
            </SheetTitle>
          </SheetHeader>

          {openMinuta && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <SupportPresentationView
                  title={openMinuta.title}
                  selectedSlides={openMinuta.selected_slides}
                  snapshot={openMinuta.presentation_snapshot}
                  sharedPresentationId={openMinuta.id}
                  clientId={openMinuta.client_id}
                  embedded
                />
              </div>

              <div>
                <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-info" />
                  Feedback del cliente
                </h3>
                <MinuteFeedbackList clientId={clientId} />
              </div>

              <Button variant="outline" className="w-full" onClick={() => setOpenMinutaId(null)}>
                Cerrar
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
