import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentConfig, useUpsertAgentConfig } from "@/hooks/useMemberAgent";
import { Loader2, Bot } from "lucide-react";

const TEMPLATES = [
  { value: "auto", label: "Auto-detectar por rol" },
  { value: "developer", label: "Developer / Tech Lead" },
  { value: "qa", label: "QA / Tester" },
  { value: "pm", label: "PM / Gerente / Scrum Master" },
  { value: "consultant", label: "Consultor SAP / IFS" },
  { value: "support", label: "Soporte / Help Desk" },
  { value: "designer", label: "Diseñador UX/UI" },
  { value: "default", label: "Asistente generalista" },
];

const TONES = [
  { value: "friendly", label: "Cercano y motivador" },
  { value: "formal", label: "Profesional y formal" },
  { value: "direct", label: "Directo, sin rodeos" },
  { value: "coaching", label: "Estilo coach (preguntas)" },
];

const MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (rápido, recomendado)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (razonamiento)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 mini" },
  { value: "openai/gpt-5", label: "GPT-5 ⭐ Premium" },
  { value: "openai/gpt-5.2", label: "GPT-5.2 ⭐ Premium (último)" },
];

export function AgentConfigDialog({
  open, onOpenChange, memberId,
}: { open: boolean; onOpenChange: (v: boolean) => void; memberId: string }) {
  const { data: cfg } = useAgentConfig(memberId);
  const upsert = useUpsertAgentConfig();

  const [template, setTemplate] = useState("auto");
  const [tone, setTone] = useState("friendly");
  const [model, setModel] = useState("google/gemini-2.5-flash");
  const [custom, setCustom] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (cfg) {
      setTemplate(cfg.role_template || "auto");
      setTone(cfg.tone || "friendly");
      setModel(cfg.preferred_model || "google/gemini-2.5-flash");
      setCustom(cfg.custom_instructions || "");
      setEnabled(cfg.enabled);
    }
  }, [cfg]);

  const save = async () => {
    await upsert.mutateAsync({
      member_id: memberId,
      role_template: template,
      tone,
      preferred_model: model,
      custom_instructions: custom || null,
      enabled,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Configura tu agente IA</DialogTitle>
          <DialogDescription>Personaliza cómo te asiste tu agente personal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Agente activo</p>
              <p className="text-xs text-muted-foreground">Si lo desactivas, no podrás chatear ni recibir digests.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label className="text-xs">Especialización</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tono</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Instrucciones personales (opcional)</Label>
            <Textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Ej: Háblame en inglés. Cuando muestres código usa TypeScript. Recuérdame siempre los SLA del cliente Aurum."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
