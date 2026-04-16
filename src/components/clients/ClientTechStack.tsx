import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cpu, Package, Plus, X, Pencil, Check } from "lucide-react";

interface ClientTechStackProps {
  clientId: string;
  coreVersion?: string;
  modules?: string[];
}

export function ClientTechStack({ clientId, coreVersion, modules }: ClientTechStackProps) {
  const queryClient = useQueryClient();
  const [editingCore, setEditingCore] = useState(false);
  const [coreValue, setCoreValue] = useState(coreVersion || "");
  const [newModule, setNewModule] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCoreValue(coreVersion || ""); }, [coreVersion]);

  const updateClient = async (updates: Record<string, any>) => {
    setSaving(true);
    const { error } = await supabase.from("clients").update(updates as any).eq("id", clientId);
    setSaving(false);
    if (error) { toast.error("Error al actualizar"); return false; }
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    return true;
  };

  const saveCoreVersion = async () => {
    const ok = await updateClient({ core_version: coreValue.trim() });
    if (ok) { setEditingCore(false); toast.success("Versión del core actualizada"); }
  };

  const addModule = async () => {
    const m = newModule.trim();
    if (!m) return;
    const current = modules || [];
    if (current.includes(m)) { toast.error("Módulo ya existe"); return; }
    const ok = await updateClient({ modules: [...current, m] });
    if (ok) { setNewModule(""); toast.success("Módulo agregado"); }
  };

  const removeModule = async (m: string) => {
    const current = modules || [];
    await updateClient({ modules: current.filter(x => x !== m) });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" /> Stack Técnico del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Core version */}
        <div>
          <p className="text-[10px] uppercase text-muted-foreground mb-1.5 font-semibold">Versión del Core</p>
          {editingCore ? (
            <div className="flex items-center gap-2">
              <Input
                value={coreValue}
                onChange={e => setCoreValue(e.target.value)}
                placeholder="ej. 2024.4.1"
                className="h-8 text-xs"
                autoFocus
              />
              <Button size="sm" onClick={saveCoreVersion} disabled={saving} className="h-8 gap-1">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingCore(false); setCoreValue(coreVersion || ""); }} className="h-8">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {coreVersion ? (
                <Badge variant="outline" className="text-xs font-mono gap-1">
                  <Cpu className="h-3 w-3" /> {coreVersion}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground italic">Sin definir</span>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditingCore(true)} className="h-7 px-2 gap-1 text-xs">
                <Pencil className="h-3 w-3" /> Editar
              </Button>
            </div>
          )}
        </div>

        {/* Modules */}
        <div>
          <p className="text-[10px] uppercase text-muted-foreground mb-1.5 font-semibold flex items-center gap-1">
            <Package className="h-3 w-3" /> Módulos Contratados ({(modules || []).length})
          </p>
          {modules && modules.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {modules.map(m => (
                <Badge key={m} variant="secondary" className="text-xs gap-1 pr-1">
                  {m}
                  <button onClick={() => removeModule(m)} className="hover:bg-destructive/20 rounded-sm p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic mb-2">Sin módulos definidos. Agrega los módulos contratados.</p>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={newModule}
              onChange={e => setNewModule(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addModule(); }}
              placeholder="Nombre del módulo (ej. CRM, Inventario)"
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={addModule} disabled={saving || !newModule.trim()} className="h-8 gap-1">
              <Plus className="h-3.5 w-3.5" /> Agregar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
