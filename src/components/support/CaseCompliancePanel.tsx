import { useEffect } from "react";
import { useCaseCompliance, useEvaluateCompliance, useUpdateChecklist, useIncrementNotice } from "@/hooks/useCaseCompliance";
import { useBusinessRules } from "@/hooks/useBusinessRules";
import { usePolicyAI } from "@/hooks/usePolicyAI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield, Sparkles, Bell, FileCheck, AlertTriangle, Clock, Send } from "lucide-react";
import { useState } from "react";

interface Props {
  ticketId: string;
  ticketTitle?: string;
  clientId?: string;
  onEscalate?: () => void;
}

const semaphoreColor: Record<string, string> = {
  green: "bg-success text-success-foreground",
  yellow: "bg-warning text-warning-foreground",
  red: "bg-destructive text-destructive-foreground",
  overdue: "bg-destructive text-destructive-foreground animate-pulse",
};

export function CaseCompliancePanel({ ticketId, onEscalate }: Props) {
  const { data: compliance, isLoading } = useCaseCompliance(ticketId);
  const { data: rules } = useBusinessRules();
  const evaluate = useEvaluateCompliance();
  const updateChecklist = useUpdateChecklist();
  const incrementNotice = useIncrementNotice();
  const ai = usePolicyAI();
  const [aiText, setAiText] = useState<string>("");
  const [aiMode, setAiMode] = useState<string>("");

  useEffect(() => {
    if (ticketId && !compliance && !isLoading) {
      evaluate.mutate(ticketId);
    }
  }, [ticketId, compliance, isLoading]);

  const checklistDef = (rules || []).find(r => r.rule_type === "checklist" && r.is_active)?.content?.items || [];

  if (isLoading || !compliance) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Evaluando cumplimiento de política v4.5…
        </CardContent>
      </Card>
    );
  }

  const semClass = semaphoreColor[compliance.semaphore] || semaphoreColor.green;
  const canEscalate = compliance.risk_level === "high" || compliance.risk_level === "critical";
  const canClose = compliance.checklist_completed_count === 5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Cumplimiento Política v4.5
          <Badge className={`ml-auto ${semClass}`}>
            {compliance.semaphore === "overdue" ? "VENCIDO" : compliance.semaphore.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Semáforo + plazos */}
        <div className="grid grid-cols-3 gap-2">
          <div className="border rounded p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Plazo</p>
            <p className="text-lg font-bold">{compliance.applicable_deadline_days}d</p>
          </div>
          <div className="border rounded p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Restante</p>
            <p className={`text-lg font-bold ${(compliance.days_remaining ?? 0) < 0 ? "text-destructive" : ""}`}>
              {compliance.days_remaining}d
            </p>
          </div>
          <div className="border rounded p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Avisos</p>
            <p className="text-lg font-bold">{compliance.notices_sent}/{compliance.notices_required}</p>
          </div>
        </div>

        {/* Checklist */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold flex items-center gap-1"><FileCheck className="h-3.5 w-3.5" /> Checklist de cierre</h4>
            <Badge variant={canClose ? "default" : "outline"} className="text-[10px]">
              {compliance.checklist_completed_count}/5
            </Badge>
          </div>
          <div className="space-y-1.5">
            {checklistDef.map((it: any) => (
              <label key={it.key} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/40 p-1.5 rounded">
                <Checkbox
                  checked={!!compliance.checklist[it.key]}
                  onCheckedChange={(v) => updateChecklist.mutate({
                    ticket_id: ticketId,
                    checklist: { ...compliance.checklist, [it.key]: !!v },
                  })}
                />
                <div className="flex-1">
                  <p className="font-medium">{it.label}</p>
                  <p className="text-muted-foreground text-[11px]">{it.description}</p>
                </div>
              </label>
            ))}
          </div>
          {!canClose && (
            <p className="text-[11px] text-warning mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> El cierre se bloquea hasta completar los 5 puntos.
            </p>
          )}
        </div>

        {/* Acciones IA */}
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" disabled={ai.isPending}
            onClick={async () => {
              setAiMode("recommend_action");
              const r = await ai.mutateAsync({ mode: "recommend_action", ticket_id: ticketId });
              setAiText(r.result);
            }}>
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Recomendación IA
          </Button>
          <Button size="sm" variant="outline" disabled={ai.isPending}
            onClick={async () => {
              setAiMode("generate_notice");
              const r = await ai.mutateAsync({ mode: "generate_notice", ticket_id: ticketId, notice_type: "seguimiento" });
              setAiText(r.result);
            }}>
            <Bell className="h-3.5 w-3.5 mr-1" /> Generar aviso
          </Button>
          <Button size="sm" variant="outline" disabled={ai.isPending}
            onClick={async () => {
              setAiMode("validate_closing");
              const r = await ai.mutateAsync({ mode: "validate_closing", ticket_id: ticketId });
              setAiText(r.result);
            }}>
            <FileCheck className="h-3.5 w-3.5 mr-1" /> Validar cierre IA
          </Button>
          <Button size="sm" variant="outline" onClick={() => incrementNotice.mutate(ticketId)}>
            <Send className="h-3.5 w-3.5 mr-1" /> Registrar aviso enviado
          </Button>
        </div>

        {ai.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Consultando IA…
          </div>
        )}

        {aiText && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase">{aiMode.replace("_", " ")}</span>
              </div>
              <pre className="text-xs whitespace-pre-wrap">{aiText}</pre>
            </CardContent>
          </Card>
        )}

        {/* Escalación */}
        {canEscalate && onEscalate && (
          <Button size="sm" variant="destructive" className="w-full" onClick={onEscalate}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Escalar a sprint activo
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground text-right">
          Política {compliance.policy_version} · Evaluado {new Date(compliance.last_evaluated_at).toLocaleString("es")}
        </p>
      </CardContent>
    </Card>
  );
}
