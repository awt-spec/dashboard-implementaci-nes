import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MessageCircle, ThumbsUp, ThumbsDown, Minus, Mic, Video, User,
  Loader2, Inbox, FileText, Sparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Tipos ───────────────────────────────────────────────────────────────

interface FeedbackRow {
  id: string;
  minute_id: string | null;
  shared_presentation_id: string | null;
  sentiment: "positivo" | "neutro" | "negativo" | null;
  text_comment: string | null;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  audio_transcript: string | null;
  video_url: string | null;
  video_duration_seconds: number | null;
  video_transcript: string | null;
  author_name: string | null;
  client_id: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const SENTIMENT_META = {
  positivo: { Icon: ThumbsUp,  label: "Positivo",  classes: "bg-success/15 text-success border-success/30" },
  neutro:   { Icon: Minus,     label: "Neutro",    classes: "bg-info/15 text-info border-info/30" },
  negativo: { Icon: ThumbsDown, label: "Mejorable", classes: "bg-destructive/15 text-destructive border-destructive/30" },
} as const;

function fmtTime(sec: number | null | undefined): string {
  if (!sec || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Hook de fetch ───────────────────────────────────────────────────────

function useMinuteFeedback(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["minute-feedback", clientId || "all"],
    queryFn: async () => {
      let q = (supabase.from("support_minutes_feedback" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100) as any);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FeedbackRow[];
    },
  });
}

// ─── Props ───────────────────────────────────────────────────────────────

interface Props {
  clientId?: string | null;
}

// ─── Componente ──────────────────────────────────────────────────────────

export function MinuteFeedbackList({ clientId }: Props) {
  const { data: feedback = [], isLoading } = useMinuteFeedback(clientId);

  const counts = {
    total: feedback.length,
    positivo: feedback.filter((f) => f.sentiment === "positivo").length,
    neutro: feedback.filter((f) => f.sentiment === "neutro").length,
    negativo: feedback.filter((f) => f.sentiment === "negativo").length,
    with_audio: feedback.filter((f) => !!f.audio_url).length,
    with_video: feedback.filter((f) => !!f.video_url).length,
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando feedback…
        </CardContent>
      </Card>
    );
  }

  if (feedback.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center space-y-2">
          <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground">
            Sin feedback recibido aún. Cuando el cliente responda las minutas compartidas,
            los mensajes (texto, audio, video) aparecerán acá.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Feedback recibido del cliente
          <Badge variant="outline" className="text-[10px]">{counts.total}</Badge>
        </CardTitle>
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {counts.positivo > 0 && (
            <Badge variant="outline" className={SENTIMENT_META.positivo.classes + " text-[10px] gap-1"}>
              <ThumbsUp className="h-3 w-3" /> {counts.positivo}
            </Badge>
          )}
          {counts.neutro > 0 && (
            <Badge variant="outline" className={SENTIMENT_META.neutro.classes + " text-[10px] gap-1"}>
              <Minus className="h-3 w-3" /> {counts.neutro}
            </Badge>
          )}
          {counts.negativo > 0 && (
            <Badge variant="outline" className={SENTIMENT_META.negativo.classes + " text-[10px] gap-1"}>
              <ThumbsDown className="h-3 w-3" /> {counts.negativo}
            </Badge>
          )}
          {counts.with_audio > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Mic className="h-3 w-3" /> {counts.with_audio} audio
            </Badge>
          )}
          {counts.with_video > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Video className="h-3 w-3" /> {counts.with_video} video
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {feedback.map((f) => (
          <FeedbackItem key={f.id} row={f} />
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Item individual ─────────────────────────────────────────────────────

function FeedbackItem({ row }: { row: FeedbackRow }) {
  const sentimentMeta = row.sentiment ? SENTIMENT_META[row.sentiment] : null;
  const absoluteDate = format(new Date(row.created_at), "d MMM yyyy · HH:mm", { locale: es });
  const relativeDate = formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: es });

  return (
    <div className="p-3 rounded-lg border border-border/60 bg-card space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-bold truncate">{row.author_name || "Anónimo"}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground" title={absoluteDate}>{relativeDate}</span>
        </div>
        {sentimentMeta && (
          <Badge variant="outline" className={cn("text-[10px] gap-1 shrink-0", sentimentMeta.classes)}>
            <sentimentMeta.Icon className="h-3 w-3" /> {sentimentMeta.label}
          </Badge>
        )}
      </div>

      {/* Text */}
      {row.text_comment && (
        <p className="text-sm whitespace-pre-wrap">{row.text_comment}</p>
      )}

      {/* Audio */}
      {row.audio_url && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Mic className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wide">Audio</span>
            <span>· {fmtTime(row.audio_duration_seconds)}</span>
          </div>
          <audio src={row.audio_url} controls className="w-full h-9" preload="none" />
          {row.audio_transcript ? (
            <div className="p-2 rounded-md bg-muted/40 border border-border/40 text-[11px] italic flex gap-1.5">
              <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
              <p className="whitespace-pre-wrap">{row.audio_transcript}</p>
            </div>
          ) : (
            <p className="text-[10px] italic text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Transcripción pendiente…
            </p>
          )}
        </div>
      )}

      {/* Video */}
      {row.video_url && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Video className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wide">Video</span>
            <span>· {fmtTime(row.video_duration_seconds)}</span>
          </div>
          <video
            src={row.video_url}
            controls
            className="w-full rounded-md border border-border/60 max-h-[60vh]"
            preload="none"
          />
          {row.video_transcript ? (
            <div className="p-2 rounded-md bg-muted/40 border border-border/40 text-[11px] italic flex gap-1.5">
              <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
              <p className="whitespace-pre-wrap">{row.video_transcript}</p>
            </div>
          ) : (
            <p className="text-[10px] italic text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Transcripción pendiente…
            </p>
          )}
        </div>
      )}

      {/* Tie-in a minuta/presentación (si existe) */}
      {(row.minute_id || row.shared_presentation_id) && (
        <div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground border-t border-border/40">
          <FileText className="h-3 w-3" />
          <span>
            {row.shared_presentation_id ? "Desde presentación compartida" : "Sobre minuta interna"}
          </span>
        </div>
      )}
    </div>
  );
}
