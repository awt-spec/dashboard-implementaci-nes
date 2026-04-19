import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2, Send, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateManualEntry } from "@/hooks/useTimeTracking";
import { toast } from "sonner";

interface ParsedEntry {
  source: "task" | "ticket";
  item_id: string | null;
  item_hint?: string;
  client_id: string | null;
  client_hint?: string;
  work_date: string;
  hours: number;
  description: string;
  is_billable: boolean;
  category: string;
  confidence: number;
}

const EXAMPLES = [
  "Trabajé 3h hoy en el ticket de Aurum sobre validación de facturas",
  "Ayer 2 horas de reunión con cliente para revisar el roadmap",
  "Esta mañana hice 1.5h de testing en el módulo de inventario",
  "Lunes 4 horas de consultoría para configuración SAP en CMO",
];

export function AITimeCapture() {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedEntry | null>(null);
  const create = useCreateManualEntry();

  const parse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-time-entry", { body: { text } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setParsed((data as any).parsed);
    } catch (e: any) {
      toast.error(e.message || "Error al interpretar");
    } finally {
      setParsing(false);
    }
  };

  const confirm = async () => {
    if (!parsed) return;
    if (!parsed.item_id) {
      toast.error("No se pudo identificar la tarea/ticket. Edita la entrada manualmente.");
      return;
    }
    try {
      await create.mutateAsync({
        source: parsed.source,
        item_id: parsed.item_id,
        client_id: parsed.client_id,
        work_date: parsed.work_date,
        hours: parsed.hours,
        description: parsed.description,
        is_billable: parsed.is_billable,
      });
      toast.success(`✓ Registradas ${parsed.hours}h`);
      setText("");
      setParsed(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          Captura por lenguaje natural
          <Badge className="text-[9px] bg-primary/10 text-primary border-primary/30 ml-auto">IA</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Describe lo que hiciste, ej: 'Trabajé 2 horas hoy en el ticket de Aurum'"
            rows={3}
            className="text-sm pr-10 resize-none"
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) parse();
            }}
          />
          <Button
            onClick={parse}
            disabled={parsing || !text.trim()}
            size="icon"
            variant="ghost"
            className="absolute bottom-2 right-2 h-7 w-7"
          >
            {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {!parsed && (
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 tracking-wider">Ejemplos</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  className="text-[10px] px-2 py-1 rounded-md border border-border bg-muted/30 hover:bg-primary/10 hover:border-primary/30 transition-colors"
                >
                  {ex.slice(0, 50)}{ex.length > 50 ? "..." : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {parsed && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Interpretación</span>
              </div>
              <Badge variant="outline" className="text-[9px]">
                {(parsed.confidence * 100).toFixed(0)}% confianza
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field label="Fecha" value={parsed.work_date} />
              <Field label="Horas" value={`${parsed.hours}h`} highlight />
              <Field label="Tipo" value={parsed.source} />
              <Field label="Categoría" value={parsed.category} />
              <Field label="Cliente" value={parsed.client_hint || parsed.client_id || "—"} />
              <Field label="Facturable" value={parsed.is_billable ? "Sí" : "No"} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tarea/Ticket</p>
              <p className="text-xs">
                {parsed.item_id ? "✓ Identificado" : <span className="text-warning">⚠️ {parsed.item_hint || "No identificado — usar registro manual"}</span>}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Descripción</p>
              <p className="text-xs">{parsed.description}</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setParsed(null)}>
                <X className="h-3 w-3 mr-1" /> Descartar
              </Button>
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={confirm} disabled={create.isPending || !parsed.item_id}>
                <Check className="h-3 w-3 mr-1" /> Confirmar y guardar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">{label}</p>
      <p className={`text-xs capitalize ${highlight ? "font-bold text-primary" : ""}`}>{value}</p>
    </div>
  );
}
