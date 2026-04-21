import { useBusinessRules } from "@/hooks/useBusinessRules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, ListChecks, FileSignature, BarChart3, CalendarClock } from "lucide-react";

const typeMeta: Record<string, { label: string; icon: any; color: string }> = {
  sla: { label: "Plazos SLA", icon: Clock, color: "text-blue-500" },
  checklist: { label: "Checklist de Cierre", icon: ListChecks, color: "text-emerald-500" },
  signature: { label: "Firma Estándar", icon: FileSignature, color: "text-purple-500" },
  metric: { label: "Métricas Activas", icon: BarChart3, color: "text-amber-500" },
  weekly: { label: "Cierre Semanal", icon: CalendarClock, color: "text-rose-500" },
};

export function ActivePolicyPanel() {
  const { data, isLoading } = useBusinessRules();
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const active = (data || []).filter(r => r.is_active && r.policy_version === "v4.5");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <h3 className="text-base font-semibold">Política activa: v4.5</h3>
        <Badge variant="outline" className="ml-2">{active.length} reglas</Badge>
      </div>

      {active.map(rule => {
        const meta = typeMeta[rule.rule_type] || { label: rule.rule_type, icon: ListChecks, color: "text-foreground" };
        const Icon = meta.icon;
        return (
          <Card key={rule.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                {rule.name}
                <Badge variant="secondary" className="ml-auto text-[10px]">{rule.policy_version}</Badge>
              </CardTitle>
              {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
            </CardHeader>
            <CardContent>
              {rule.rule_type === "sla" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr><th className="py-2">Tipo</th><th>Prioridad</th><th>Plazo</th><th>Avisos</th><th>Intervalo</th></tr>
                    </thead>
                    <tbody>
                      {(rule.content?.deadlines || []).map((d: any, i: number) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 capitalize">{d.case_type}</td>
                          <td className="capitalize">{d.priority}</td>
                          <td>{d.deadline_days} días</td>
                          <td>{d.notices}</td>
                          <td>{d.interval_hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rule.rule_type === "checklist" && (
                <ul className="space-y-2 text-xs">
                  {(rule.content?.items || []).map((it: any) => (
                    <li key={it.key} className="flex gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">{it.label}</span>
                        <p className="text-muted-foreground">{it.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {rule.rule_type === "signature" && (
                <pre className="text-xs bg-muted/40 p-3 rounded whitespace-pre-wrap font-mono">{rule.content?.template}</pre>
              )}
              {rule.rule_type === "metric" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(rule.content?.metrics || []).map((m: any) => (
                    <div key={m.key} className="border rounded p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                      <p className="text-sm font-bold">{m.target}</p>
                    </div>
                  ))}
                </div>
              )}
              {rule.rule_type === "weekly" && (
                <ul className="space-y-1 text-xs">
                  {(rule.content?.rules || []).map((r: any, i: number) => (
                    <li key={i} className="flex gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{r.day}</Badge>
                      <span>{r.action}</span>
                      <span className="text-muted-foreground ml-auto">— {r.responsible}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
