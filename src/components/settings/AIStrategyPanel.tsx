import { usePolicyAISettings } from "@/hooks/useBusinessRules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Bell, ListChecks, Activity } from "lucide-react";

export function AIStrategyPanel() {
  const { data, isLoading, update } = usePolicyAISettings();
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const s = data || { ai_model: "google/gemini-3-flash-preview", auto_notice: false, auto_checklist: true, ai_suggestions: true, sync_with_sprint: true, evaluation_frequency_minutes: 60 };

  const Toggle = ({ icon: Icon, label, desc, k }: any) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <Icon className="h-4 w-4 text-primary mt-0.5" />
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={!!s[k]} onCheckedChange={(v) => update.mutate({ [k]: v })} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Motor IA — Política v4.5</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Toggle icon={Bell} label="Aviso automático" desc="La IA redacta y propone avisos cuando un caso entra en riesgo" k="auto_notice" />
          <Toggle icon={ListChecks} label="Validación automática del checklist" desc="La IA verifica los 4 elementos obligatorios al cerrar" k="auto_checklist" />
          <Toggle icon={Sparkles} label="Sugerencias IA en panel" desc="Mostrar recomendaciones de próxima acción" k="ai_suggestions" />
          <Toggle icon={Activity} label="Sincronizar con sprint" desc="Botón 'Escalar a sprint' en casos críticos" k="sync_with_sprint" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Modelo y frecuencia</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Modelo IA por defecto</Label>
            <Select value={s.ai_model} onValueChange={(v) => update.mutate({ ai_model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google/gemini-3-flash-preview">Gemini 3 Flash (rápido, recomendado)</SelectItem>
                <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (mejor razonamiento)</SelectItem>
                <SelectItem value="openai/gpt-5-mini">GPT-5 mini</SelectItem>
                <SelectItem value="openai/gpt-5">GPT-5 (preciso)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Frecuencia de evaluación (minutos)</Label>
            <Input type="number" value={s.evaluation_frequency_minutes} min={5}
              onChange={e => update.mutate({ evaluation_frequency_minutes: Number(e.target.value) })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
