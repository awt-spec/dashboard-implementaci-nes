import { useState } from "react";
import { type Risk } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldAlert, Plus, Trash2, AlertOctagon } from "lucide-react";
import { useCreateRisk, useDeleteRisk, useUpdateRisk } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RisksTabProps {
  risks: Risk[];
  clientId: string;
}

export function RisksTab({ risks, clientId }: RisksTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("medio");
  const [mitigation, setMitigation] = useState("");
  const [category, setCategory] = useState<"riesgo" | "obstaculo">("riesgo");
  const [filterCategory, setFilterCategory] = useState<"all" | "riesgo" | "obstaculo">("all");

  const createRisk = useCreateRisk();
  const deleteRisk = useDeleteRisk();
  const updateRisk = useUpdateRisk();

  const handleCreate = () => {
    if (!description.trim()) { toast.error("Descripción es obligatoria"); return; }
    createRisk.mutate({
      client_id: clientId, original_id: `R-${Date.now()}`, description: description.trim(),
      impact, status: "abierto", mitigation: mitigation.trim() || undefined, category,
    }, {
      onSuccess: () => { toast.success(category === "obstaculo" ? "Obstáculo creado" : "Riesgo creado"); setCreateOpen(false); setDescription(""); setMitigation(""); },
      onError: () => toast.error("Error al crear"),
    });
  };

  const handleDelete = async (risk: Risk) => {
    const { data } = await supabase.from("risks").select("id").eq("client_id", clientId).eq("original_id", risk.id).single();
    if (!data) return;
    deleteRisk.mutate(data.id, { onSuccess: () => toast.success("Eliminado"), onError: () => toast.error("Error") });
  };

  const handleStatusChange = async (risk: Risk, newStatus: string) => {
    const { data } = await supabase.from("risks").select("id").eq("client_id", clientId).eq("original_id", risk.id).single();
    if (!data) return;
    updateRisk.mutate({ id: data.id, updates: { status: newStatus } }, { onSuccess: () => toast.success("Estado actualizado") });
  };

  const filteredRisks = filterCategory === "all" ? risks : risks.filter(r => (r.category || "riesgo") === filterCategory);
  const riskCount = risks.filter(r => (r.category || "riesgo") === "riesgo").length;
  const obstacleCount = risks.filter(r => r.category === "obstaculo").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm">Riesgos y Obstáculos</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={filterCategory} onValueChange={v => setFilterCategory(v as any)}>
              <TabsList className="h-7">
                <TabsTrigger value="all" className="text-[10px] h-5 px-2">Todos ({risks.length})</TabsTrigger>
                <TabsTrigger value="riesgo" className="text-[10px] h-5 px-2">
                  <ShieldAlert className="h-3 w-3 mr-1" />Riesgos ({riskCount})
                </TabsTrigger>
                <TabsTrigger value="obstaculo" className="text-[10px] h-5 px-2">
                  <AlertOctagon className="h-3 w-3 mr-1" />Obstáculos ({obstacleCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-7 text-xs"><Plus className="h-3 w-3" /> Nuevo</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{category === "obstaculo" ? "Nuevo Obstáculo" : "Nuevo Riesgo"}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-medium text-foreground">Categoría</label>
                    <Select value={category} onValueChange={v => setCategory(v as any)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="riesgo">🛡️ Riesgo (potencial)</SelectItem>
                        <SelectItem value="obstaculo">🚧 Obstáculo (bloqueante activo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-xs font-medium text-foreground">Descripción *</label><Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1" /></div>
                  <div><label className="text-xs font-medium text-foreground">Impacto</label>
                    <Select value={impact} onValueChange={setImpact}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="alto">Alto</SelectItem><SelectItem value="medio">Medio</SelectItem><SelectItem value="bajo">Bajo</SelectItem></SelectContent></Select>
                  </div>
                  <div><label className="text-xs font-medium text-foreground">{category === "obstaculo" ? "Plan de resolución" : "Mitigación"}</label><Textarea value={mitigation} onChange={e => setMitigation(e.target.value)} className="mt-1" /></div>
                  <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={handleCreate}>Crear</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredRisks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {filterCategory === "obstaculo" ? "Sin obstáculos identificados" : filterCategory === "riesgo" ? "Sin riesgos identificados" : "Sin riesgos ni obstáculos identificados"}
          </p>
        ) : filteredRisks.map(risk => {
          const isObstacle = risk.category === "obstaculo";
          return (
            <div key={risk.id} className={`p-4 rounded-lg border group ${isObstacle ? "border-orange-500/30 bg-orange-500/5" : risk.impact === "alto" ? "border-destructive/30 bg-destructive/5" : risk.impact === "medio" ? "border-warning/30 bg-warning/5" : "border-border"}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  {isObstacle ? (
                    <AlertOctagon className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                  ) : (
                    <ShieldAlert className={`h-4 w-4 mt-0.5 shrink-0 ${risk.impact === "alto" ? "text-destructive" : risk.impact === "medio" ? "text-warning" : "text-muted-foreground"}`} />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${isObstacle ? "border-orange-500/30 text-orange-600" : ""}`}>
                        {isObstacle ? "Obstáculo" : "Riesgo"}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{risk.description}</p>
                  </div>
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
                      <SelectItem value="mitigado">{isObstacle ? "Resuelto" : "Mitigado"}</SelectItem>
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
                  <span className="font-medium">{isObstacle ? "Resolución:" : "Mitigación:"}</span> {risk.mitigation}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
