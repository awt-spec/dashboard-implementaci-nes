import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ChevronDown, Brain, Calendar, User, Tag, FileText,
  AlertTriangle, Save, Loader2, CheckSquare, ArrowRight, Clock,
  Package, Wrench, Search, Filter, X, Plus, Trash2
} from "lucide-react";
import type { SupportTicket } from "@/hooks/useSupportTickets";
import { useUpdateSupportTicket } from "@/hooks/useSupportTickets";
import { motion } from "framer-motion";
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
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editNotas, setEditNotas] = useState("");
  const [editAiSummary, setEditAiSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [minutas, setMinutas] = useState<any[]>([]);
  const updateTicket = useUpdateSupportTicket();

  // Case-specific agreements/actions
  const [newCaseAgreement, setNewCaseAgreement] = useState("");
  const [newCaseAction, setNewCaseAction] = useState("");

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [responsableFilter, setResponsableFilter] = useState("all");
  const [prioridadFilter, setPrioridadFilter] = useState("all");

  const tipos = useMemo(() => [...new Set(tickets.map(t => t.tipo))].sort(), [tickets]);
  const responsables = useMemo(() => [...new Set(tickets.map(t => t.responsable).filter(Boolean))].sort() as string[], [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (searchFilter && !t.asunto.toLowerCase().includes(searchFilter.toLowerCase()) && !t.ticket_id.toLowerCase().includes(searchFilter.toLowerCase())) return false;
      if (estadoFilter !== "all" && t.estado !== estadoFilter) return false;
      if (tipoFilter !== "all" && t.tipo !== tipoFilter) return false;
      if (responsableFilter !== "all" && (t.responsable || "") !== responsableFilter) return false;
      if (prioridadFilter !== "all" && t.prioridad !== prioridadFilter) return false;
      return true;
    });
  }, [tickets, searchFilter, estadoFilter, tipoFilter, responsableFilter, prioridadFilter]);

  const activeFilters = [estadoFilter, tipoFilter, responsableFilter, prioridadFilter].filter(f => f !== "all").length + (searchFilter ? 1 : 0);

  useEffect(() => {
    if (!tickets.length) return;
    const clientIds = [...new Set(tickets.map(t => t.client_id))];
    if (clientIds.length === 0) return;
    supabase.from("support_minutes").select("id,title,date,agreements,action_items,cases_referenced")
      .in("client_id", clientIds)
      .then(({ data }) => { if (data) setMinutas(data); });
  }, [tickets]);

  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
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

  const handleAddCaseAgreement = (t: SupportTicket) => {
    if (!newCaseAgreement.trim()) return;
    const updated = [...(t.case_agreements || []), newCaseAgreement.trim()];
    updateTicket.mutate(
      { id: t.id, updates: { case_agreements: updated } },
      { onSuccess: () => { toast.success("Acuerdo agregado"); setNewCaseAgreement(""); } }
    );
  };

  const handleRemoveCaseAgreement = (t: SupportTicket, idx: number) => {
    const updated = (t.case_agreements || []).filter((_, i) => i !== idx);
    updateTicket.mutate(
      { id: t.id, updates: { case_agreements: updated } },
      { onSuccess: () => toast.success("Acuerdo eliminado") }
    );
  };

  const handleAddCaseAction = (t: SupportTicket) => {
    if (!newCaseAction.trim()) return;
    const updated = [...(t.case_actions || []), newCaseAction.trim()];
    updateTicket.mutate(
      { id: t.id, updates: { case_actions: updated } },
      { onSuccess: () => { toast.success("Acción agregada"); setNewCaseAction(""); } }
    );
  };

  const handleRemoveCaseAction = (t: SupportTicket, idx: number) => {
    const updated = (t.case_actions || []).filter((_, i) => i !== idx);
    updateTicket.mutate(
      { id: t.id, updates: { case_actions: updated } },
      { onSuccess: () => toast.success("Acción eliminada") }
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

  const clearFilters = () => {
    setSearchFilter("");
    setEstadoFilter("all");
    setTipoFilter("all");
    setResponsableFilter("all");
    setPrioridadFilter("all");
  };

  const renderEditableText = (t: SupportTicket, field: "notas" | "ai_summary", value: string, editValue: string, setEditValue: (v: string) => void, placeholder: string) => {
    const isEditing = editingField === field;
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{field === "notas" ? "Notas" : "Resumen IA"}</span>
          {isEditing ? (
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6" disabled={saving}
                onClick={() => handleSaveText(t.id, field, editValue)}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 text-primary" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => setEditingField(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-primary"
              onClick={() => { setEditingField(field); setEditValue(value || ""); }}>
              Editar
            </Button>
          )}
        </div>
        {isEditing ? (
          <Textarea value={editValue} onChange={e => setEditValue(e.target.value)}
            className="text-xs min-h-[80px]" placeholder={placeholder} />
        ) : (
          <p className={`text-xs rounded-lg p-3 border ${value ? "text-foreground bg-card border-border/50" : "text-muted-foreground italic bg-muted/20 border-border/30"}`}>
            {value || placeholder}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="relative flex-1 min-w-[160px] max-w-[250px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input className="pl-7 h-7 text-xs" placeholder="Buscar ID o asunto..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
        </div>
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
          <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p.replace(", Impacto Negocio", "")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {responsables.length > 0 && (
          <Select value={responsableFilter} onValueChange={setResponsableFilter}>
            <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Responsable" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {responsables.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3 w-3" /> Limpiar ({activeFilters})
          </Button>
        )}
        <Badge variant="outline" className="text-[10px] ml-auto">{filteredTickets.length} de {tickets.length}</Badge>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
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
            {filteredTickets.map(t => {
              const isClosed = ["CERRADA", "ANULADA"].includes(t.estado);
              return (
                <tr
                  key={t.id}
                  className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${isClosed ? "opacity-50" : ""}`}
                  onClick={() => { setSelectedTicket(t); setEditingField(null); setNewCaseAgreement(""); setNewCaseAction(""); }}
                >
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Sheet/Popup */}
      <Sheet open={!!selectedTicket} onOpenChange={open => { if (!open) setSelectedTicket(null); }}>
        <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto p-0">
          {selectedTicket && (() => {
            const t = selectedTicket;
            const relatedItems = getRelatedItems(t);
            const caseAgreements = t.case_agreements || [];
            const caseActions = t.case_actions || [];
            const totalItems = relatedItems.length + caseAgreements.length + caseActions.length;
            return (
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-5 border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-black text-base">{t.ticket_id}</span>
                        <Badge variant="outline" className={`text-[10px] ${estadoColors[t.estado] || ""}`}>{t.estado}</Badge>
                        <Badge className={`text-[10px] ${prioridadColors[t.prioridad] || "bg-muted"}`}>{t.prioridad}</Badge>
                      </div>
                      <p className="text-sm text-foreground font-medium leading-snug">{t.asunto}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Package className="h-3 w-3" />{t.producto}</span>
                    <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{t.tipo}</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.responsable || "Sin asignar"}</span>
                    <span className={`flex items-center gap-1 font-bold ${t.dias_antiguedad > 365 ? "text-destructive" : t.dias_antiguedad > 90 ? "text-warning" : ""}`}>
                      <Clock className="h-3 w-3" />{t.dias_antiguedad} días
                    </span>
                    {t.ai_classification && (
                      <Badge variant="outline" className={`text-[9px] ${aiRiskColors[t.ai_risk_level || ""] || "border-violet-500/40 text-violet-400"}`}>
                        <Brain className="h-2.5 w-2.5 mr-0.5" />{t.ai_classification}
                      </Badge>
                    )}
                    {totalItems > 0 && (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                        <CheckSquare className="h-2.5 w-2.5 mr-0.5" />{totalItems} items
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content Tabs */}
                <div className="flex-1 p-5">
                  <Tabs defaultValue="info" className="w-full">
                    <TabsList className="w-full h-8 bg-muted/50">
                      <TabsTrigger value="info" className="text-[11px] h-6 px-3 gap-1 flex-1"><FileText className="h-3 w-3" />Gestión</TabsTrigger>
                      <TabsTrigger value="notas" className="text-[11px] h-6 px-3 gap-1 flex-1"><Tag className="h-3 w-3" />Notas & IA</TabsTrigger>
                      <TabsTrigger value="acuerdos" className="text-[11px] h-6 px-3 gap-1 flex-1">
                        <CheckSquare className="h-3 w-3" />Acuerdos
                        {totalItems > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{totalItems}</Badge>}
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab: Gestión */}
                    <TabsContent value="info" className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estado</span>
                          <Select value={t.estado} onValueChange={v => handleUpdate(t.id, { estado: v }, "Estado actualizado")}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prioridad</span>
                          <Select value={t.prioridad} onValueChange={v => handleUpdate(t.id, { prioridad: v }, "Prioridad actualizada")}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Responsable</span>
                          {teamMembers.length > 0 ? (
                            <Select value={t.responsable || "__none__"} onValueChange={v => handleUpdate(t.id, { responsable: v === "__none__" ? null : v }, "Responsable actualizado")}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Asignar..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin asignar</SelectItem>
                                {teamMembers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-xs font-medium h-8 flex items-center">{t.responsable || "Sin asignar"}</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cliente</span>
                          <p className="text-xs font-medium h-8 flex items-center">{clientName(t.client_id)}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fechas</span>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Registro</p>
                              <p className="font-medium">{t.fecha_registro ? new Date(t.fecha_registro).toLocaleDateString("es") : "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Entrega</p>
                              <p className="font-medium">{t.fecha_entrega ? new Date(t.fecha_entrega).toLocaleDateString("es") : "—"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Tab: Notas & IA */}
                    <TabsContent value="notas" className="mt-4 space-y-4">
                      {renderEditableText(t, "notas", t.notas || "", editNotas, setEditNotas, "Sin notas")}
                      <div className="space-y-2">
                        {t.ai_classification && (
                          <div className="flex items-center gap-2 flex-wrap">
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
                    </TabsContent>

                    {/* Tab: Acuerdos y Acciones */}
                    <TabsContent value="acuerdos" className="mt-4 space-y-4">
                      {/* Case-specific agreements */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckSquare className="h-3 w-3" /> Acuerdos del Caso
                          </span>
                          <Badge variant="secondary" className="text-[9px]">{caseAgreements.length}</Badge>
                        </div>
                        <div className="space-y-1.5 mb-2">
                          {caseAgreements.map((a, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 group">
                              <CheckSquare className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                              <span className="flex-1 text-foreground">{a}</span>
                              <button onClick={() => handleRemoveCaseAgreement(t, idx)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <Input className="text-xs h-7 flex-1" placeholder="Agregar acuerdo..." value={newCaseAgreement}
                            onChange={e => setNewCaseAgreement(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleAddCaseAgreement(t); }} />
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            disabled={!newCaseAgreement.trim()} onClick={() => handleAddCaseAgreement(t)}>
                            <Plus className="h-3 w-3" /> Agregar
                          </Button>
                        </div>
                      </div>

                      {/* Case-specific actions */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                            <ArrowRight className="h-3 w-3" /> Acciones del Caso
                          </span>
                          <Badge variant="secondary" className="text-[9px]">{caseActions.length}</Badge>
                        </div>
                        <div className="space-y-1.5 mb-2">
                          {caseActions.map((a, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 group">
                              <ArrowRight className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
                              <span className="flex-1 text-foreground">{a}</span>
                              <button onClick={() => handleRemoveCaseAction(t, idx)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <Input className="text-xs h-7 flex-1" placeholder="Agregar acción..." value={newCaseAction}
                            onChange={e => setNewCaseAction(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleAddCaseAction(t); }} />
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            disabled={!newCaseAction.trim()} onClick={() => handleAddCaseAction(t)}>
                            <Plus className="h-3 w-3" /> Agregar
                          </Button>
                        </div>
                      </div>

                      {/* Minutas-linked items */}
                      {relatedItems.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2 mt-3">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="h-3 w-3" /> Desde Minutas
                            </span>
                            <Badge variant="outline" className="text-[9px]">{relatedItems.length}</Badge>
                          </div>
                          <div className="space-y-1.5">
                            {relatedItems.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-card border border-border/50">
                                <span className={`mt-0.5 shrink-0 ${item.type === "acuerdo" ? "text-emerald-400" : "text-blue-400"}`}>
                                  {item.type === "acuerdo" ? <CheckSquare className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-foreground">{item.text}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                        </div>
                      )}

                      {totalItems === 0 && (
                        <div className="text-center py-6">
                          <CheckSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">No hay acuerdos ni acciones. Agrega uno arriba.</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}
