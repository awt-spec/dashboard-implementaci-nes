import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Star, Smile, Meh, Frown, MessageSquareHeart, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTicketFeedback, useCaptureTicketFeedback, type Sentiment } from "@/hooks/useTicketFeedback";

const SENTIMENTS: { key: Sentiment; label: string; icon: any; tone: string }[] = [
  { key: "positivo", label: "Positivo", icon: Smile, tone: "text-success border-success/40 bg-success/10" },
  { key: "neutral", label: "Neutral", icon: Meh, tone: "text-warning border-warning/40 bg-warning/10" },
  { key: "negativo", label: "Negativo", icon: Frown, tone: "text-destructive border-destructive/40 bg-destructive/10" },
];

interface Props {
  ticketId: string;
  clientId?: string | null;
  /** Suele ser true cuando el ticket está resuelto/cerrado. */
  canCapture?: boolean;
}

export function TicketFeedbackCard({ ticketId, clientId, canCapture = true }: Props) {
  const { data: feedback = [], isLoading } = useTicketFeedback(ticketId);
  const capture = useCaptureTicketFeedback(ticketId);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [comment, setComment] = useState("");

  const existing = feedback[0];

  const submit = () => {
    if (!rating) { toast.error("Elegí una calificación (1-5)"); return; }
    if (!sentiment) { toast.error("Elegí el sentimiento del cliente"); return; }
    capture.mutate(
      { rating, sentiment, comment, clientId },
      {
        onSuccess: () => { toast.success("Feedback del cliente registrado"); setRating(0); setSentiment(null); setComment(""); },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  if (isLoading) return null;

  // Ya hay feedback → mostrarlo (read-only).
  if (existing) {
    const sm = SENTIMENTS.find((s) => s.key === existing.sentiment);
    const SIcon = sm?.icon ?? Meh;
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold flex items-center gap-1.5"><MessageSquareHeart className="h-4 w-4 text-primary" /> Feedback del cliente (CSAT)</p>
            {sm && <Badge variant="outline" className={`text-[10px] gap-1 ${sm.tone}`}><SIcon className="h-3 w-3" />{sm.label}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-4 w-4 ${existing.rating && n <= existing.rating ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
            ))}
            <span className="text-xs text-muted-foreground ml-1">{existing.rating}/5</span>
          </div>
          {existing.comment && <p className="text-sm">{existing.comment}</p>}
          <p className="text-[10px] text-muted-foreground">Registrado {format(new Date(existing.created_at), "d MMM yyyy HH:mm", { locale: es })}</p>
        </CardContent>
      </Card>
    );
  }

  if (!canCapture) return null;

  // Formulario de captura.
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-xs font-bold flex items-center gap-1.5"><MessageSquareHeart className="h-4 w-4 text-primary" /> Registrar feedback del cliente (CSAT)</p>

        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Calificación</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                className="p-0.5"
              >
                <Star className={`h-6 w-6 transition-colors ${n <= (hover || rating) ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Sentimiento</p>
          <div className="flex items-center gap-2">
            {SENTIMENTS.map((s) => {
              const SIcon = s.icon;
              const active = sentiment === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSentiment(s.key)}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors ${active ? s.tone : "border-border text-muted-foreground hover:bg-accent/50"}`}
                >
                  <SIcon className="h-3.5 w-3.5" /> {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <Textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comentario del cliente (opcional)…"
          className="text-sm"
        />

        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={capture.isPending} className="gap-1.5">
            {capture.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareHeart className="h-3.5 w-3.5" />}
            Guardar feedback
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
