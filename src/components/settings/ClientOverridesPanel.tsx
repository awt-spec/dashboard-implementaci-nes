import { useState } from "react";
import { useClients } from "@/hooks/useClients";
import { useBusinessRules, useClientOverrides, useUpsertClientOverride } from "@/hooks/useBusinessRules";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ClientOverridesPanel() {
  const { data: clients } = useClients();
  const { data: rules } = useBusinessRules();
  const [clientId, setClientId] = useState<string>("");
  const { data: overrides, isLoading } = useClientOverrides(clientId || undefined);
  const upsert = useUpsertClientOverride();
  const [draft, setDraft] = useState<{ rule_id: string; content: string }>({ rule_id: "", content: "{}" });

  const supportClients = (clients || []).filter((c: any) => c.client_type === "soporte");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold mb-2">Overrides por cliente</h3>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Seleccionar cliente de soporte" /></SelectTrigger>
          <SelectContent>
            {supportClients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {clientId && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Crear override para una regla activa</p>
              <Select value={draft.rule_id} onValueChange={(v) => setDraft({ ...draft, rule_id: v })}>
                <SelectTrigger><SelectValue placeholder="Regla a sobrescribir" /></SelectTrigger>
                <SelectContent>
                  {(rules || []).filter(r => r.is_active).map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.rule_type})</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea rows={6} className="font-mono text-xs" placeholder='{"deadlines":[{"case_type":"correccion","priority":"alta","deadline_days":2}]}'
                value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} />
              <Button size="sm" onClick={() => {
                try {
                  const c = JSON.parse(draft.content || "{}");
                  upsert.mutate({ client_id: clientId, rule_id: draft.rule_id, override_content: c });
                  setDraft({ rule_id: "", content: "{}" });
                } catch { alert("JSON inválido"); }
              }}><Save className="h-4 w-4 mr-1" /> Guardar override</Button>
            </CardContent>
          </Card>

          {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
            <div className="space-y-2">
              {(overrides || []).map((o: any) => (
                <Card key={o.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{o.business_rules?.name || "Regla"}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{o.business_rules?.rule_type}</Badge>
                      {o.is_active && <Badge className="text-[10px] bg-success">activo</Badge>}
                    </div>
                    <pre className="text-[11px] bg-muted/40 p-2 rounded overflow-auto">{JSON.stringify(o.override_content, null, 2)}</pre>
                  </CardContent>
                </Card>
              ))}
              {(overrides || []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Sin overrides para este cliente</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
