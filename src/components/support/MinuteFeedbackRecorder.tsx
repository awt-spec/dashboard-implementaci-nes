import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Mic, Video, ThumbsUp, ThumbsDown, Minus, Send, Loader2, Square,
  Play, Pause, Trash2, CheckCircle2, AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Constantes ──────────────────────────────────────────────────────────

const AUDIO_MAX_SECONDS = 5 * 60;  // 5 min
const VIDEO_MAX_SECONDS = 2 * 60;  // 2 min
const BUCKET = "minute-feedback-media";

type Sentiment = "positivo" | "neutro" | "negativo";
type Mode = "idle" | "recording" | "recorded";
type MediaKind = "audio" | "video";

interface RecordedMedia {
  blob: Blob;
  url: string;               // object URL para preview
  kind: MediaKind;
  duration: number;
  transcript: string | null; // del Web Speech API durante la grabación
}

// ─── Web Speech API (no-op fallback si el browser no soporta) ──────────
type SpeechRecognitionLike = any;
function getSpeechRecognition(): { new(): SpeechRecognitionLike } | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// ─── Props ───────────────────────────────────────────────────────────────

interface Props {
  minuteId?: string | null;
  sharedPresentationId?: string | null;
  clientId?: string | null;
  onSubmitted?: () => void;
}

// ─── Componente ──────────────────────────────────────────────────────────

export function MinuteFeedbackRecorder({
  minuteId, sharedPresentationId, clientId, onSubmitted,
}: Props) {
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [textComment, setTextComment] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [audioRecording, setAudioRecording] = useState<Mode>("idle");
  const [videoRecording, setVideoRecording] = useState<Mode>("idle");
  const [audioMedia, setAudioMedia] = useState<RecordedMedia | null>(null);
  const [videoMedia, setVideoMedia] = useState<RecordedMedia | null>(null);
  const [audioElapsed, setAudioElapsed] = useState(0);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Refs para MediaRecorder
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<number | null>(null);
  const videoTimerRef = useRef<number | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Web Speech API refs — transcribe mientras grabás (opcional, depende del browser)
  const audioRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const videoRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioTranscriptRef = useRef<string>("");
  const videoTranscriptRef = useRef<string>("");

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopAudioTracks();
      stopVideoTracks();
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
      if (audioMedia?.url) URL.revokeObjectURL(audioMedia.url);
      if (videoMedia?.url) URL.revokeObjectURL(videoMedia.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAudioTracks = () => {
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
  };
  const stopVideoTracks = () => {
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
  };

  // Inicia reconocimiento de voz en paralelo a la grabación.
  // Si el browser no lo soporta (Firefox, Safari < iOS 17), no pasa nada:
  // el recorder sigue funcionando y simplemente no hay transcripción.
  const startRecognition = (which: "audio" | "video"): void => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "es-419"; // español latinoamérica; degrada a es-ES si no existe
      const transcriptRef = which === "audio" ? audioTranscriptRef : videoTranscriptRef;
      transcriptRef.current = "";
      rec.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) transcriptRef.current += r[0].transcript + " ";
        }
      };
      rec.onerror = () => { /* silent — se pierde la transcripción sin romper la grabación */ };
      rec.start();
      if (which === "audio") audioRecognitionRef.current = rec;
      else videoRecognitionRef.current = rec;
    } catch { /* ignore */ }
  };

  const stopRecognition = (which: "audio" | "video"): void => {
    const rec = which === "audio" ? audioRecognitionRef.current : videoRecognitionRef.current;
    try { rec?.stop?.(); } catch { /* ignore */ }
    if (which === "audio") audioRecognitionRef.current = null;
    else videoRecognitionRef.current = null;
  };

  // ─── Audio ────────────────────────────────────────────────────────────

  const startAudio = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu browser no soporta grabación de audio");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      audioRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mime || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const transcript = audioTranscriptRef.current.trim();
        setAudioMedia({ blob, url, kind: "audio", duration: audioElapsed, transcript: transcript || null });
        setAudioRecording("recorded");
        stopRecognition("audio");
        stopAudioTracks();
        if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
      };
      recorder.start(1000);
      startRecognition("audio");
      setAudioRecording("recording");
      setAudioElapsed(0);
      audioTimerRef.current = window.setInterval(() => {
        setAudioElapsed((prev) => {
          const next = prev + 1;
          if (next >= AUDIO_MAX_SECONDS) { stopAudio(); return AUDIO_MAX_SECONDS; }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      toast.error(e?.name === "NotAllowedError" ? "Permiso de micrófono denegado" : "No se pudo acceder al micrófono");
      stopAudioTracks();
    }
  };

  const stopAudio = () => {
    if (audioRecorderRef.current?.state === "recording") audioRecorderRef.current.stop();
  };

  const discardAudio = () => {
    if (audioMedia?.url) URL.revokeObjectURL(audioMedia.url);
    setAudioMedia(null);
    setAudioRecording("idle");
    setAudioElapsed(0);
  };

  // ─── Video ────────────────────────────────────────────────────────────

  const startVideo = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu browser no soporta grabación de video");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        await videoPreviewRef.current.play().catch(() => {});
      }
      const mime = pickVideoMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      videoRecorderRef.current = recorder;
      videoChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: mime || "video/webm" });
        const url = URL.createObjectURL(blob);
        const transcript = videoTranscriptRef.current.trim();
        setVideoMedia({ blob, url, kind: "video", duration: videoElapsed, transcript: transcript || null });
        setVideoRecording("recorded");
        stopRecognition("video");
        stopVideoTracks();
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
        if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; }
      };
      recorder.start(1000);
      startRecognition("video");
      setVideoRecording("recording");
      setVideoElapsed(0);
      videoTimerRef.current = window.setInterval(() => {
        setVideoElapsed((prev) => {
          const next = prev + 1;
          if (next >= VIDEO_MAX_SECONDS) { stopVideo(); return VIDEO_MAX_SECONDS; }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      toast.error(e?.name === "NotAllowedError" ? "Permiso de cámara denegado" : "No se pudo acceder a la cámara");
      stopVideoTracks();
    }
  };

  const stopVideo = () => {
    if (videoRecorderRef.current?.state === "recording") videoRecorderRef.current.stop();
  };

  const discardVideo = () => {
    if (videoMedia?.url) URL.revokeObjectURL(videoMedia.url);
    setVideoMedia(null);
    setVideoRecording("idle");
    setVideoElapsed(0);
  };

  // ─── Upload + save ────────────────────────────────────────────────────

  const uploadMedia = async (media: RecordedMedia): Promise<string | null> => {
    const ext = media.kind === "audio"
      ? (media.blob.type.includes("mp4") ? "mp4" : "webm")
      : (media.blob.type.includes("mp4") ? "mp4" : "webm");
    const prefix = sharedPresentationId ?? minuteId ?? "anon";
    const path = `${prefix}/${Date.now()}_${media.kind}_${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, media.blob, {
      contentType: media.blob.type,
      upsert: false,
    });
    if (uploadErr) {
      toast.error(`Error subiendo ${media.kind}: ${uploadErr.message}`);
      return null;
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return pub?.publicUrl ?? null;
  };

  const handleSubmit = async () => {
    if (!sentiment && !textComment.trim() && !audioMedia && !videoMedia) {
      toast.error("Agregá al menos una forma de feedback (sentimiento, texto, audio o video)");
      return;
    }
    setSubmitting(true);
    try {
      const [audioUrl, videoUrl] = await Promise.all([
        audioMedia ? uploadMedia(audioMedia) : null,
        videoMedia ? uploadMedia(videoMedia) : null,
      ]);

      const payload: Record<string, unknown> = {
        minute_id: minuteId ?? null,
        shared_presentation_id: sharedPresentationId ?? null,
        client_id: clientId ?? null,
        sentiment: sentiment ?? null,
        text_comment: textComment.trim() || null,
        audio_url: audioUrl,
        audio_duration_seconds: audioMedia?.duration ?? null,
        audio_transcript: audioMedia?.transcript ?? null,
        video_url: videoUrl,
        video_duration_seconds: videoMedia?.duration ?? null,
        video_transcript: videoMedia?.transcript ?? null,
        author_name: authorName.trim() || null,
      };

      const { error } = await (supabase
        .from("support_minutes_feedback" as any)
        .insert(payload) as any);
      if (error) throw error;

      setSubmitted(true);
      toast.success("¡Gracias por tu feedback!");
      onSubmitted?.();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo enviar el feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12"
      >
        <div className="inline-flex h-16 w-16 rounded-full bg-success/15 items-center justify-center mb-4">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-2xl font-bold mb-1">¡Feedback recibido!</h2>
        <p className="text-sm text-muted-foreground">Gracias — el equipo de soporte lo revisará en breve.</p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-black mb-1">¿Cómo evaluás esta sesión?</h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Tu feedback nos ayuda a mejorar — escribilo, grabalo o ambos.
        </p>
      </div>

      {/* Sentimiento */}
      <div className="grid grid-cols-3 gap-2">
        <SentimentButton
          value="positivo" current={sentiment} onChange={setSentiment}
          Icon={ThumbsUp} label="Positivo" colorClass="text-success" bg="border-success/40 bg-success/10"
        />
        <SentimentButton
          value="neutro" current={sentiment} onChange={setSentiment}
          Icon={Minus} label="Neutro" colorClass="text-info" bg="border-info/40 bg-info/10"
        />
        <SentimentButton
          value="negativo" current={sentiment} onChange={setSentiment}
          Icon={ThumbsDown} label="Mejorable" colorClass="text-destructive" bg="border-destructive/40 bg-destructive/10"
        />
      </div>

      {/* Autor opcional */}
      <input
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder="Tu nombre (opcional)"
        className="w-full rounded-xl border border-border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {/* Texto */}
      <textarea
        value={textComment}
        onChange={(e) => setTextComment(e.target.value)}
        placeholder="Comentarios, detalles, cualquier cosa que quieras decirnos..."
        rows={4}
        className="w-full rounded-xl border border-border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {/* Audio recorder */}
      <Card>
        <CardContent className="p-3 md:p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Mensaje de audio</span>
              <Badge variant="outline" className="text-[10px]">máx. 5 min</Badge>
            </div>
            {audioRecording === "recording" && (
              <RecordingIndicator elapsed={audioElapsed} max={AUDIO_MAX_SECONDS} />
            )}
          </div>

          {audioRecording === "idle" && !audioMedia && (
            <Button onClick={startAudio} variant="outline" className="w-full gap-2">
              <Mic className="h-4 w-4" /> Iniciar grabación
            </Button>
          )}

          {audioRecording === "recording" && (
            <Button onClick={stopAudio} variant="destructive" className="w-full gap-2">
              <Square className="h-4 w-4" /> Detener ({fmtTime(audioElapsed)})
            </Button>
          )}

          {audioMedia && audioRecording === "recorded" && (
            <div className="space-y-2">
              <audio src={audioMedia.url} controls className="w-full" />
              {audioMedia.transcript && (
                <p className="text-[11px] italic text-muted-foreground p-2 rounded bg-muted/30 border border-border/40">
                  “{audioMedia.transcript}”
                </p>
              )}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Duración: {fmtTime(audioMedia.duration)}</span>
                <Button variant="ghost" size="sm" onClick={discardAudio} className="h-7 gap-1 text-[11px] text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3" /> Descartar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video recorder */}
      <Card>
        <CardContent className="p-3 md:p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Mensaje de video</span>
              <Badge variant="outline" className="text-[10px]">máx. 2 min · opcional</Badge>
            </div>
            {videoRecording === "recording" && (
              <RecordingIndicator elapsed={videoElapsed} max={VIDEO_MAX_SECONDS} />
            )}
          </div>

          {/* Preview durante grabación */}
          <AnimatePresence>
            {videoRecording === "recording" && (
              <motion.video
                ref={videoPreviewRef}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full rounded-lg border border-border bg-black aspect-video object-contain"
                playsInline
              />
            )}
          </AnimatePresence>

          {/* Preview después de grabar */}
          {videoMedia && videoRecording === "recorded" && (
            <video src={videoMedia.url} controls className="w-full rounded-lg border border-border" />
          )}

          {videoRecording === "idle" && !videoMedia && (
            <Button onClick={startVideo} variant="outline" className="w-full gap-2">
              <Video className="h-4 w-4" /> Iniciar grabación
            </Button>
          )}

          {videoRecording === "recording" && (
            <Button onClick={stopVideo} variant="destructive" className="w-full gap-2">
              <Square className="h-4 w-4" /> Detener ({fmtTime(videoElapsed)})
            </Button>
          )}

          {videoMedia && videoRecording === "recorded" && (
            <div className="space-y-2">
              {videoMedia.transcript && (
                <p className="text-[11px] italic text-muted-foreground p-2 rounded bg-muted/30 border border-border/40">
                  “{videoMedia.transcript}”
                </p>
              )}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Duración: {fmtTime(videoMedia.duration)}</span>
                <Button variant="ghost" size="sm" onClick={discardVideo} className="h-7 gap-1 text-[11px] text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3" /> Descartar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-11 gap-2"
        size="lg"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? "Enviando…" : "Enviar feedback"}
      </Button>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────

function SentimentButton({
  value, current, onChange, Icon, label, colorClass, bg,
}: {
  value: Sentiment;
  current: Sentiment | null;
  onChange: (v: Sentiment) => void;
  Icon: typeof ThumbsUp;
  label: string;
  colorClass: string;
  bg: string;
}) {
  const selected = current === value;
  return (
    <button
      onClick={() => onChange(value)}
      className={cn(
        "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5",
        selected ? bg : "border-border hover:border-primary/30",
      )}
    >
      <Icon className={cn("h-6 w-6", selected ? colorClass : "text-muted-foreground")} />
      <p className={cn("font-bold text-xs", selected ? colorClass : "text-muted-foreground")}>{label}</p>
    </button>
  );
}

function RecordingIndicator({ elapsed, max }: { elapsed: number; max: number }) {
  const warn = elapsed > max * 0.85;
  return (
    <div className="flex items-center gap-1.5">
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="h-2 w-2 rounded-full bg-destructive"
      />
      <span className={cn(
        "text-[11px] font-mono tabular-nums font-bold",
        warn ? "text-warning" : "text-destructive"
      )}>
        {fmtTime(elapsed)} / {fmtTime(max)}
      </span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Encuentra el primer mimeType de audio soportado por el browser.
 * Prioriza MP4 (mejor soporte iOS Safari) → WebM opus → fallback.
 */
function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", ""];
  for (const c of candidates) {
    if (!c || MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function pickVideoMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", ""];
  for (const c of candidates) {
    if (!c || MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}
