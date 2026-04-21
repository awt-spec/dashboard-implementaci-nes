import { useState } from "react";
import { useBusinessRules, useToggleBusinessRule, useDeleteBusinessRule, useUpsertBusinessRule } from "@/hooks/useBusinessRules";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Copy } from "lucide-react";

export function BusinessRulesPanel() {
  const { data, isLoading } = useBusinessRules();
  const toggle = useToggleBusinessRule();
  const del = useDeleteBusinessRule();
  const upsert = useUpsertBusinessRule();

  const [editing, setEditing] = useState<any | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Reglas de Negocio</h3>
        <Button size="sm" onClick={() => setEditing({ name: "", rule_type: "sla", scope: "global", policy_version: "v4.5", content: {}, is_active: true })}>
          <Plus className="h-4 w-4 mr-1" /> Nueva regla
        </Button>
      </div>

      <div className="space-y-2">
        {(data || []).map(rule => (
          <Card key={rule.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <Switch checked={rule.is_active} onCheckedChange={(v) => toggle.mutate({ id: rule.id, is_active: v })} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{rule.name}</span>
                  <Badge variant="outline" className="text-[10px]">{rule.rule_type}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{rule.scope}</Badge>
                  <Badge className="text-[10px]">{rule.policy_version}</Badge>
                </div>
                {rule.description && <p className="text-xs text-muted-foreground truncate">{rule.description}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(rule)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => upsert.mutate({ ...rule, id: undefined, name: rule.name + " (copia)" })}><Copy className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("¿Eliminar regla?")) del.mutate(rule.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nueva"} regla</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input placeholder="Nombre" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              <Textarea placeholder="Descripción" value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <Select value={editing.rule_type} onValueChange={(v) => setEditing({ ...editing, rule_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["sla","checklist","signature","metric","weekly","closure","notice"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={editing.scope} onValueChange={(v) => setEditing({ ...editing, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">global</SelectItem>
                    <SelectItem value="client">client</SelectItem>
                    <SelectItem value="case_type">case_type</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={editing.policy_version} onChange={e => setEditing({ ...editing, policy_version: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contenido (JSON)</label>
                <Textarea
                  rows={10}
                  className="font-mono text-xs"
                  value={JSON.stringify(editing.content, null, 2)}
                  onChange={e => {
                    try { setEditing({ ...editing, content: JSON.parse(e.target.value) }); }
                    catch { setEditing({ ...editing, _rawContent: e.target.value }); }
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => { upsert.mutate(editing); setEditing(null); }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
