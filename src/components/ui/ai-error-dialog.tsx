import { AlertTriangle, Sparkles, Clock, XCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Props ───────────────────────────────────────────────────────────────

interface AiErrorDialogProps {
  open: boolean;
  onClose: () => void;
  message: string | null;
  onRetry?: () => void;
}

// ─── Categorización del mensaje para UI más clara ────────────────────────

function categorize(message: string): {
  title: string;
  description: string;
  Icon: typeof AlertTriangle;
  tone: "warning" | "destructive" | "info";
  suggestion: string;
} {
  const m = (message ?? "").toLowerCase();

  if (m.includes("rate limit") || m.includes("429")) {
    return {
      title: "Límite de uso alcanzado",
      description: message,
      Icon: Clock,
      tone: "warning",
      suggestion: "La API de Gemini está rate-limiteada. Probá de nuevo en 1–2 minutos.",
    };
  }

  if (m.includes("quota") || m.includes("limit: 0") || m.includes("402")) {
    return {
      title: "Créditos de IA agotados",
      description: message,
      Icon: XCircle,
      tone: "destructive",
      suggestion: "Revisá el billing de Gemini o rotá la API key en Supabase → Functions → Secrets.",
    };
  }

  if (m.includes("timeout") || m.includes("504") || m.includes("unavailable")) {
    return {
      title: "Gemini no respondió a tiempo",
      description: message,
      Icon: Clock,
      tone: "warning",
      suggestion: "El modelo está con alta demanda. Intentá nuevamente en unos segundos.",
    };
  }

  if (m.includes("api_key") || m.includes("401") || m.includes("inválida")) {
    return {
      title: "API key inválida",
      description: message,
      Icon: XCircle,
      tone: "destructive",
      suggestion: "El secret ANTHROPIC_API_KEY en Supabase está mal configurado o expiró.",
    };
  }

  if (m.includes("503") || m.includes("500") || m.includes("502")) {
    return {
      title: "Error temporal del servicio de IA",
      description: message,
      Icon: AlertTriangle,
      tone: "warning",
      suggestion: "Se reintentó automáticamente pero falló. Probá de nuevo en un momento.",
    };
  }

  return {
    title: "Error al consultar la IA",
    description: message,
    Icon: AlertTriangle,
    tone: "destructive",
    suggestion: "Si el problema persiste, revisá los logs de la edge function en Supabase.",
  };
}

// ─── Componente ──────────────────────────────────────────────────────────

export function AiErrorDialog({ open, onClose, message, onRetry }: AiErrorDialogProps) {
  const cat = categorize(message ?? "");

  const toneClasses = {
    warning: "bg-warning/10 text-warning border-warning/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
    info: "bg-info/10 text-info border-info/30",
  }[cat.tone];

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-2 border-2 ${toneClasses}`}>
            <cat.Icon className="h-5 w-5" />
          </div>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            {cat.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block text-sm">{cat.suggestion}</span>
            {message && (
              <pre className="text-[10px] font-mono p-2 rounded bg-muted/50 border border-border/50 max-h-32 overflow-auto whitespace-pre-wrap">
                {message.slice(0, 500)}
              </pre>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {onRetry && (
            <button
              onClick={() => { onClose(); onRetry(); }}
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50"
            >
              Reintentar
            </button>
          )}
          <AlertDialogAction onClick={onClose}>Entendido</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
