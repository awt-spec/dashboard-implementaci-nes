import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronDown, ChevronUp, Brain, Calendar, User, Tag, FileText,
  AlertTriangle, Save, Loader2, CheckSquare, ArrowRight, Clock,
  Package, Wrench
} from "lucide-react";
import type { SupportTicket } from "@/hooks/useSupportTickets";
import { useUpdateSupportTicket } from "@/hooks/useSupportTickets";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const prioridadColors: Record<string, string> = {
  "Critica, Impacto Negocio": "bg-red-600 text-white",
  "Alta": "bg-destructive text-destructive-foreground",
  "Media": "bg-warning text-warning-foreground",
  "Baja": "bg-muted text-muted-foreground",
};

const estadoColors: Record<string, string> = {
  "EN ATENCIÓN": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "ENTREGADA": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "PENDIENTE": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "POR CERRAR": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "CERRADA": "bg-green-500/20 text-green-400 border-green-500/30",
  "ANULADA": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "COTIZADA": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "APROBADA": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "ON HOLD": "bg-slate-500/20 text-slate-400 border-slate-500/30",
  "VALORACIÓN": "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const ESTADOS = ["EN ATENCIÓN", "ENTREGADA", "PENDIENTE", "POR CERRAR", "CERRADA", "ANULADA", "COTIZADA", "APROBADA", "ON HOLD", "VALORACIÓN"];
const PRIORIDADES = ["Critica, Impacto Negocio", "Alta", "Media", "Baja"];

const aiRiskColors: Record<string, string> = {
  critical: "bg-red-600/20 text-red-400 border-red-600/40",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  low: "bg-green-500/20 text-green-400 border-green-500/40",
};

const aiRiskLabels: Record<string, string> = {
  critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo",
};

interface Props {
  tickets: SupportTicket[];
  clientName: (id: string) => string;
  teamMembers?: string[];
}

export function SupportCaseTable({ tickets, clientName, teamMembers = [] }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [editNotas, setEditNotas] = useState("");
  const [editAiSummary, setEditAiSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [minutas, setMinutas] = useState<any[]>([]);
  const updateTicket = useUpdateSupportTicket();

  useEffect(() => {
    if (!tickets.length) return;
    const clientIds = [...new Set(tickets.map(t => t.client_id))];
    if (clientIds.length === 0) return;
    supabase.from("support_minutes").select("id,title,date,agreements,action_items,cases_referenced")
      .in("client_id", clientIds)
      .then(({ data }) => { if (data) setMinutas(data); });
  }, [tickets]);

  const handleUpdate = (ticketId: string, updates: Record<string, any>, msg: string) => {
    updateTicket.mutate(
      { id: ticketId, updates },
      { onSuccess: () => { toast.success(msg); setEditingField(null); } }
    );
  };

  const handleSaveText = async (ticketId: string, field: string, value: string) => {
    setSaving(true);
    updateTicket.mutate(
      { id: ticketId, updates: { [field]: value || null } },
      {
        onSuccess: () => { toast.success("Guardado"); setEditingField(null); setSaving(false); },
        onError: () => { toast.error("Error al guardar"); setSaving(false); },
      }
    );
  };

  const getRelatedItems = (t: SupportTicket) => {
    const related = minutas.filter(m =>
      (m.cases_referenced || []).includes(t.ticket_id) || (m.cases_referenced || []).includes(t.id)
    );
    const items: { text: string; type: string; minuta: string; date: string }[] = [];
    related.forEach(m => {
      (m.agreements || []).forEach((a: string) => items.push({ text: a, type: "acuerdo", minuta: m.title, date: m.date }));
      (m.action_items || []).forEach((a: string) => items.push({ text: a, type: "acción", minuta: m.title, date: m.date }));
    });
    return items;
  };

  const renderEditableText = (t: SupportTicket, field: "notas" | "ai_summary", value: string, editValue: string, setEditValue: (v: string) => void, placeholder: string) => {
    const isEditing = editingField?.id === t.id && editingField?.field === field;
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{field === "notas" ? "Notas" : "Resumen IA"}</span>
          {isEditing ? (
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-5 w-5" disabled={saving}
                onClick={e => { e.stopPropagation(); handleSaveText(t.id, field, editValue); }}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 text-primary" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-5 w-5"
                onClick={e => { e.stopPropagation(); setEditingField(null); }}>
                <span className="text-xs">✕</span>
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-primary"
              onClick={e => { e.stopPropagation(); setEditingField({ id: t.id, field }); setEditValue(value || ""); }}>
              Editar
            </Button>
          )}
        </div>
        {isEditing ? (
          <Textarea value={editValue} onChange={e => setEditValue(e.target.value)}
            className="text-xs min-h-[60px]" onClick={e => e.stopPropagation()} placeholder={placeholder} />
        ) : (
          <p className={`text-xs rounded-lg p-2.5 border ${value ? "text-foreground bg-card border-border/50" : "text-muted-foreground italic bg-muted/20 border-border/30"}`}>
            {value || placeholder}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="border-b border-border">
            <th className="w-8 p-2"></th>
            <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
            <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>
            <th className="text-left p-2 font-medium text-muted-foreground">Producto</th>
            <th className="text-left p-2 font-medium text-muted-foreground">Asunto</th>
            <th className="text-left p-2 font-medium text-muted-foreground">Tipo</th>
            <th className="text-left p-2 font-medium text-muted-foreground">Prioridad</th>
            <th className="text-left p-2 font-medium text-muted-foreground">Estado</th>
            <th className="text-left p-2 font-medium text-muted-foreground">IA</th>
            <th className="text-right p-2 font-medium text-muted-foreground">Días</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(t => {
            const isExpanded = expandedId === t.id;
            const isClosed = ["CERRADA", "ANULADA"].includes(t.estado);
            const relatedItems = isExpanded ? getRelatedItems(t) : [];
            return (
              <> 
                <tr
                  key={t.id}
                  className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${isClosed ? "opacity-50" : ""} ${isExpanded ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <td className="p-2 text-center">
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-primary inline" /> : <ChevronDown className="h-3 w-3 text-muted-foreground inline" />}
                  </td>
                  <td className="p-2 font-mono font-bold whitespace-nowrap">{t.ticket_id}</td>
                  <td className="p-2 whitespace-nowrap">{clientName(t.client_id)}</td>
                  <td className="p-2 whitespace-nowrap">{t.producto}</td>
                  <td className="p-2 max-w-[220px] truncate">{t.asunto}</td>
                  <td className="p-2 whitespace-nowrap">{t.tipo}</td>
                  <td className="p-2"><Badge className={`text-[10px] ${prioridadColors[t.prioridad] || "bg-muted"}`}>{t.prioridad}</Badge></td>
                  <td className="p-2"><Badge variant="outline" className={`text-[10px] ${estadoColors[t.estado] || ""}`}>{t.estado}</Badge></td>
                  <td className="p-2">
                    {t.ai_classification ? (
                      <Badge variant="outline" className={`text-[10px] ${aiRiskColors[t.ai_risk_level || ""] || "border-violet-500/40 text-violet-400"}`}>
                        {t.ai_classification}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2 text-right font-mono">{t.dias_antiguedad}</td>
                </tr>
                {isExpanded && (
                  <tr key={`${t.id}-detail`}>
                    <td colSpan={10} className="p-0">
                      <AnimatePresence>
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 bg-gradient-to-b from-primary/5 to-transparent border-b border-primary/20">
                            {/* Header with key info */}
                            <div className="flex items-start gap-4 mb-4">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-black text-sm">{t.ticket_id}</span>
                                  <Badge variant="outline" className={`text-[10px] ${estadoColors[t.estado] || ""}`}>{t.estado}</Badge>
                                  <Badge className={`text-[10px] ${prioridadColors[t.prioridad] || "bg-muted"}`}>{t.prioridad}</Badge>
                                  {t.ai_classification && (
                                    <Badge variant="outline" className={`text-[10px] ${aiRiskColors[t.ai_risk_level || ""] || "border-violet-500/40 text-violet-400"}`}>
                                      <Brain className="h-2.5 w-2.5 mr-1" />{t.ai_classification}
                                    </Badge>
                                  )}
                                  {relatedItems.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                                      <CheckSquare className="h-2.5 w-2.5 mr-1" />{relatedItems.length} acuerdos
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-foreground mt-1">{t.asunto}</p>
                                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1"><Package className="h-3 w-3" />{t.producto}</span>
                                  <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{t.tipo}</span>
                                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.responsable || "Sin asignar"}</span>
                                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{t.fecha_registro ? new Date(t.fecha_registro).toLocaleDateString("es") : "—"}</span>
                                  <span className={`flex items-center gap-1 font-bold ${t.dias_antiguedad > 365 ? "text-destructive" : t.dias_antiguedad > 90 ? "text-warning" : ""}`}>
                                    <Clock className="h-3 w-3" />{t.dias_antiguedad} días
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Tabs for detail sections */}
                            <Tabs defaultValue="info" className="w-full">
                              <TabsList className="h-7 bg-muted/50">
                                <TabsTrigger value="info" className="text-[10px] h-5 px-2.5 gap-1"><FileText className="h-3 w-3" />Gestión</TabsTrigger>
                                <TabsTrigger value="notas" className="text-[10px] h-5 px-2.5 gap-1"><Tag className="h-3 w-3" />Notas & IA</TabsTrigger>
                                <TabsTrigger value="acuerdos" className="text-[10px] h-5 px-2.5 gap-1">
                                  <CheckSquare className="h-3 w-3" />Acuerdos
                                  {relatedItems.length > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{relatedItems.length}</Badge>}
                                </TabsTrigger>
                              </TabsList>

                              {/* Tab: Gestión */}
                              <TabsContent value="info" className="mt-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estado</span>
                                    <Select value={t.estado} onValueChange={v => handleUpdate(t.id, { estado: v }, "Estado actualizado")}>
                                      <SelectTrigger className="h-7 text-xs" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prioridad</span>
                                    <Select value={t.prioridad} onValueChange={v => handleUpdate(t.id, { prioridad: v }, "Prioridad actualizada")}>
                                      <SelectTrigger className="h-7 text-xs" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Responsable</span>
                                    {teamMembers.length > 0 ? (
                                      <Select value={t.responsable || "__none__"} onValueChange={v => handleUpdate(t.id, { responsable: v === "__none__" ? null : v }, "Responsable actualizado")}>
                                        <SelectTrigger className="h-7 text-xs" onClick={e => e.stopPropagation()}><SelectValue placeholder="Asignar..." /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">Sin asignar</SelectItem>
                                          {teamMembers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <p className="text-xs font-medium h-7 flex items-center">{t.responsable || "Sin asignar"}</p>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fechas</span>
                                    <div className="text-xs space-y-0.5">
                                      <p className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-2.5 w-2.5" />Registro: {t.fecha_registro ? new Date(t.fecha_registro).toLocaleDateString("es") : "—"}</p>
                                      <p className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-2.5 w-2.5" />Entrega: {t.fecha_entrega ? new Date(t.fecha_entrega).toLocaleDateString("es") : "—"}</p>
                                    </div>
                                  </div>
                                </div>
                              </TabsContent>

                              {/* Tab: Notas & IA */}
                              <TabsContent value="notas" className="mt-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-3">
                                    {renderEditableText(t, "notas", t.notas || "", editNotas, setEditNotas, "Sin notas")}
                                  </div>
                                  <div className="space-y-3">
                                    {t.ai_classification && (
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-400">
                                          <Brain className="h-2.5 w-2.5 mr-1" />{t.ai_classification}
                                        </Badge>
                                        <Badge variant="outline" className={`text-[10px] ${aiRiskColors[t.ai_risk_level || ""] || ""}`}>
                                          Riesgo: {aiRiskLabels[t.ai_risk_level || ""] || t.ai_risk_level || "—"}
                                        </Badge>
                                      </div>
                                    )}
                                    {renderEditableText(t, "ai_summary", t.ai_summary || "", editAiSummary, setEditAiSummary, "Sin resumen IA")}
                                  </div>
                                </div>
                              </TabsContent>

                              {/* Tab: Acuerdos */}
                              <TabsContent value="acuerdos" className="mt-3">
                                {relatedItems.length === 0 ? (
                                  <div className="text-center py-6">
                                    <CheckSquare className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                                    <p className="text-xs text-muted-foreground">No hay acuerdos ni acciones vinculados a este caso.</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">Se vincularán automáticamente al incluir este caso en una minuta.</p>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                    {relatedItems.map((item, idx) => (
                                      <div key={idx} className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-card border border-border/50 hover:border-primary/20 transition-colors">
                                        <span className={`mt-0.5 shrink-0 ${item.type === "acuerdo" ? "text-emerald-400" : "text-blue-400"}`}>
                                          {item.type === "acuerdo" ? <CheckSquare className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-foreground leading-relaxed">{item.text}</p>
                                          <div className="flex items-center gap-2 mt-1.5">
                                            <Badge variant="outline" className={`text-[9px] ${item.type === "acuerdo" ? "border-emerald-500/30 text-emerald-400" : "border-blue-500/30 text-blue-400"}`}>
                                              {item.type}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                              <Calendar className="h-2.5 w-2.5" />{new Date(item.date).toLocaleDateString("es")}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate">{item.minuta}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TabsContent>
                            </Tabs>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
