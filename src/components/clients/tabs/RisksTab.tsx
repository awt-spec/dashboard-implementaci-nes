import { useState } from "react";
import { type Risk } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldAlert, Plus, Trash2 } from "lucide-react";
import { useCreateRisk, useDeleteRisk, useUpdateRisk } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface RisksTabProps {
  risks: Risk[];
  clientId: string;
}

export function RisksTab({ risks, clientId }: RisksTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("medio");
  const [mitigation, setMitigation] = useState("");

  const createRisk = useCreateRisk();
  const deleteRisk = useDeleteRisk();
  const updateRisk = useUpdateRisk();

  const handleCreate = () => {
    if (!description.trim()) { toast.error("Descripción es obligatoria"); return; }
    createRisk.mutate({
      client_id: clientId, original_id: `R-${Date.now()}`, description: description.trim(),
      impact, status: "abierto", mitigation: mitigation.trim() || undefined,
    }, {
      onSuccess: () => { toast.success("Riesgo creado"); setCreateOpen(false); setDescription(""); setMitigation(""); },
      onError: () => toast.error("Error al crear"),
    });
  };

  const handleDelete = async (risk: Risk) => {
    const { data } = await supabase.from("risks").select("id").eq("client_id", clientId).eq("original_id", risk.id).single();
    if (!data) return;
    deleteRisk.mutate(data.id, { onSuccess: () => toast.success("Riesgo eliminado"), onError: () => toast.error("Error") });
  };

  const handleStatusChange = async (risk: Risk, newStatus: string) => {
    const { data } = await supabase.from("risks").select("id").eq("client_id", clientId).eq("original_id", risk.id).single();
    if (!data) return;
    updateRisk.mutate({ id: data.id, updates: { status: newStatus } }, { onSuccess: () => toast.success("Estado actualizado") });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Riesgos y Alertas</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-7 text-xs"><Plus className="h-3 w-3" /> Nuevo Riesgo</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Nuevo Riesgo</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><label className="text-xs font-medium text-foreground">Descripción *</label><Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-foreground">Impacto</label>
                  <Select value={impact} onValueChange={setImpact}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="alto">Alto</SelectItem><SelectItem value="medio">Medio</SelectItem><SelectItem value="bajo">Bajo</SelectItem></SelectContent></Select>
                </div>
                <div><label className="text-xs font-medium text-foreground">Mitigación</label><Textarea value={mitigation} onChange={e => setMitigation(e.target.value)} className="mt-1" /></div>
                <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={handleCreate}>Crear</Button></div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {risks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin riesgos identificados</p>
        ) : risks.map(risk => (
          <div key={risk.id} className={`p-4 rounded-lg border group ${risk.impact === "alto" ? "border-destructive/30 bg-destructive/5" : risk.impact === "medio" ? "border-warning/30 bg-warning/5" : "border-border"}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-start gap-2 min-w-0">
                <ShieldAlert className={`h-4 w-4 mt-0.5 shrink-0 ${risk.impact === "alto" ? "text-destructive" : risk.impact === "medio" ? "text-warning" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium text-foreground">{risk.description}</p>
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                <Badge variant={risk.impact === "alto" ? "destructive" : "secondary"}>
                  {risk.impact.charAt(0).toUpperCase() + risk.impact.slice(1)}
                </Badge>
                <Select value={risk.status} onValueChange={v => handleStatusChange(risk, v)}>
                  <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none w-auto">
                    <Badge variant={risk.status === "abierto" ? "outline" : "secondary"}>
                      {risk.status.charAt(0).toUpperCase() + risk.status.slice(1)}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abierto">Abierto</SelectItem>
                    <SelectItem value="mitigado">Mitigado</SelectItem>
                    <SelectItem value="cerrado">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
                <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all" onClick={() => handleDelete(risk)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </motion.div>
              </div>
            </div>
            {risk.mitigation && (
              <p className="text-xs text-muted-foreground ml-6">
                <span className="font-medium">Mitigación:</span> {risk.mitigation}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
