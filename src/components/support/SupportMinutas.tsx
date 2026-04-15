import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FileText, Plus, Calendar, Sparkles, Loader2, ChevronDown, ChevronUp, Trash2,
  Users, CheckSquare, ArrowRight, Presentation, Edit3, Save, X, UserPlus, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SupportMinutaPresentation } from "./SupportMinutaPresentation";
import { toast } from "sonner";
import type { SupportTicket } from "@/hooks/useSupportTickets";

interface Props {
  tickets: SupportTicket[];
  clientName: string;
  clientId: string;
  teamMembers?: string[];
}

interface Minuta {
  id: string;
  client_id: string;
  title: string;
  date: string;
  summary: string;
  cases_referenced: string[];
  action_items: string[];
  agreements: string[];
  attendees: string[];
  created_at: string;
}

export function SupportMinutas({ tickets, clientName, clientId, teamMembers = [] }: Props) {
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [newAttendee, setNewAttendee] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Minuta>>({});
  const [manualAgreements, setManualAgreements] = useState<string[]>([]);
  const [manualActions, setManualActions] = useState<string[]>([]);
  const [newAgreement, setNewAgreement] = useState("");
  const [newAction, setNewAction] = useState("");

  useEffect(() => {
    setLoading(true);
    supabase.from("support_minutes").select("*").eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setMinutas(data as any);
        setLoading(false);
      });
  }, [clientId]);

  const activeTickets = useMemo(() =>
    tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)), [tickets]);

  const criticalTickets = useMemo(() =>
    activeTickets.filter(t => t.prioridad === "Critica, Impacto Negocio" || t.prioridad === "Alta")
      .sort((a, b) => b.dias_antiguedad - a.dias_antiguedad), [activeTickets]);

  const handleGenerateMinuta = async () => {
    setGenerating(true);
    try {
      const casesToUse = selectedCaseIds.length > 0
        ? tickets.filter(t => selectedCaseIds.includes(t.id))
        : activeTickets.slice(0, 30);

      const casesSummary = casesToUse.map(t =>
        `[${t.ticket_id}] ${t.asunto} | Estado: ${t.estado} | Prioridad: ${t.prioridad} | Días: ${t.dias_antiguedad} | Responsable: ${t.responsable || "N/A"} | Producto: ${t.producto} | Tipo: ${t.tipo} | Notas: ${t.notas || "N/A"} | IA: ${t.ai_summary || "N/A"}`
      ).join("\n");

      const { data, error } = await supabase.functions.invoke("summarize-transcript", {
        body: {
          transcript: `MINUTA DE SOPORTE - ${clientName}\nFecha: ${new Date().toLocaleDateString("es")}\nParticipantes: ${selectedAttendees.join(", ") || "Por definir"}\n\nCasos activos del cliente:\n${casesSummary}\n\nGenera una minuta ejecutiva de soporte con título, resumen, acuerdos y acciones a seguir.`,
          clientName: clientName,
        },
      });

      if (error) throw error;

      let parsed: any;
      try {
        const text = typeof data === "string" ? data : data?.summary || data?.text || JSON.stringify(data);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: "Minuta de Soporte", summary: text, agreements: [], action_items: [], cases_highlighted: [] };
      } catch {
        parsed = { title: "Minuta de Soporte", summary: String(data), agreements: [], action_items: [], cases_highlighted: [] };
      }

      const now = new Date().toISOString();
      const minutaRow = {
        client_id: clientId,
        title: newTitle || parsed.title || `Minuta de Soporte - ${clientName}`,
        date: now.split("T")[0],
        summary: parsed.summary || "",
        cases_referenced: parsed.cases_highlighted || casesToUse.map(t => t.ticket_id),
        action_items: [...manualActions, ...(parsed.action_items || [])],
        agreements: [...manualAgreements, ...(parsed.agreements || [])],
        attendees: selectedAttendees,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("support_minutes").insert([minutaRow] as any).select().single();
      if (insertErr) throw insertErr;

      setMinutas(prev => [inserted as any, ...prev]);
      setShowCreate(false);
      setNewTitle("");
      setSelectedCaseIds([]);
      setSelectedAttendees([]);
      setManualAgreements([]);
      setManualActions([]);
      setNewAgreement("");
      setNewAction("");
      setPresentationId((inserted as any).id);
      toast.success("Minuta generada exitosamente");
    } catch (e: any) {
      toast.error(e.message || "Error generando minuta");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("support_minutes").delete().eq("id", id);
    if (error) { toast.error("Error eliminando"); return; }
    setMinutas(prev => prev.filter(x => x.id !== id));
    toast.success("Minuta eliminada");
  };

  const handleSaveEdit = async (id: string) => {
    const { error } = await supabase.from("support_minutes")
      .update(editData as any).eq("id", id);
    if (error) { toast.error("Error guardando"); return; }
    setMinutas(prev => prev.map(m => m.id === id ? { ...m, ...editData } as Minuta : m));
    setEditingId(null);
    setEditData({});
    toast.success("Minuta actualizada");
  };

  const startEdit = (m: Minuta) => {
    setEditingId(m.id);
    setEditData({ summary: m.summary, agreements: [...m.agreements], action_items: [...m.action_items], attendees: [...m.attendees] });
  };

  const addAttendeeToEdit = (name: string) => {
    if (!name.trim()) return;
    setEditData(prev => ({ ...prev, attendees: [...(prev.attendees || []), name.trim()] }));
  };

  const removeAttendeeFromEdit = (idx: number) => {
    setEditData(prev => ({ ...prev, attendees: (prev.attendees || []).filter((_, i) => i !== idx) }));
  };

  const toggleCase = (id: string) => {
    setSelectedCaseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addAttendee = (name: string) => {
    if (!name.trim() || selectedAttendees.includes(name.trim())) return;
    setSelectedAttendees(prev => [...prev, name.trim()]);
    setNewAttendee("");
  };

  // Presentation view for a specific minuta
  const presentingMinuta = minutas.find(m => m.id === presentationId);

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      {presentingMinuta && (
        <SupportMinutaPresentation
          minuta={presentingMinuta}
          tickets={tickets}
          clientName={clientName}
          open={!!presentationId}
          onClose={() => setPresentationId(null)}
        />
      )}
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold">Minutas de Soporte — {clientName}</h3>
          <Badge variant="outline" className="text-xs">{minutas.length}</Badge>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3.5 w-3.5" /> Nueva Minuta
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Generar Minuta con IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Título (opcional, IA generará uno)" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="text-xs" />

                {/* Participants */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Users className="h-3 w-3" /> Participantes</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedAttendees.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                        {a}
                        <button onClick={() => setSelectedAttendees(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Nombre del participante" value={newAttendee} onChange={e => setNewAttendee(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAttendee(newAttendee); } }}
                      className="text-xs flex-1" />
                    <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0" onClick={() => addAttendee(newAttendee)}>
                      <UserPlus className="h-3 w-3" /> Agregar
                    </Button>
                  </div>
                  {teamMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px] text-muted-foreground mr-1">Equipo:</span>
                      {teamMembers.filter(t => !selectedAttendees.includes(t)).map(t => (
                        <button key={t} onClick={() => addAttendee(t)} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded hover:bg-primary/10 transition-colors">{t}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Case selection - improved UX */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Casos a incluir <Badge variant="secondary" className="text-[10px] ml-1">{selectedCaseIds.length > 0 ? `${selectedCaseIds.length} seleccionados` : "todos los activos"}</Badge>
                    </p>
                  </div>
                  {/* Quick filter buttons */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Button size="sm" variant={selectedCaseIds.length === 0 ? "default" : "outline"} className="text-[10px] h-6 px-2"
                      onClick={() => setSelectedCaseIds([])}>
                      Todos activos
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-6 px-2"
                      onClick={() => setSelectedCaseIds(activeTickets.filter(t => t.prioridad.includes("Critica") || t.prioridad === "Alta").map(t => t.id))}>
                      <AlertTriangle className="h-3 w-3 mr-1" /> Solo críticos ({activeTickets.filter(t => t.prioridad.includes("Critica") || t.prioridad === "Alta").length})
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-6 px-2"
                      onClick={() => setSelectedCaseIds(activeTickets.filter(t => t.estado === "EN ATENCIÓN").map(t => t.id))}>
                      En atención ({activeTickets.filter(t => t.estado === "EN ATENCIÓN").length})
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-6 px-2"
                      onClick={() => setSelectedCaseIds(activeTickets.map(t => t.id))}>
                      Seleccionar todos ({activeTickets.length})
                    </Button>
                  </div>
                  {/* Search */}
                  <Input placeholder="Buscar por ID o asunto..." className="text-xs h-7 mb-2"
                    onChange={e => {
                      const q = e.target.value.toLowerCase();
                      if (!q) return;
                      // just filter visual, don't affect selection
                    }} />
                  <div className="max-h-[180px] overflow-y-auto space-y-1 border border-border rounded-md p-2">
                    {activeTickets.slice(0, 50).map(t => {
                      const isSelected = selectedCaseIds.includes(t.id);
                      const isCritical = t.prioridad.includes("Critica") || t.prioridad === "Alta";
                      return (
                        <label key={t.id} className={`flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/30"}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleCase(t.id)} className="rounded" />
                          <span className="font-mono font-bold shrink-0 text-[10px]">{t.ticket_id}</span>
                          {isCritical && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                          <span className="truncate flex-1">{t.asunto}</span>
                          <Badge variant="outline" className={`text-[9px] shrink-0 ${isCritical ? "border-destructive/30 text-destructive" : ""}`}>{t.estado}</Badge>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 text-xs" onClick={handleGenerateMinuta} disabled={generating}>
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generating ? "Generando..." : "Generar con IA"}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowCreate(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {criticalTickets.length > 0 && (
        <Card className="border-destructive/20">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-destructive mb-2">⚠ {criticalTickets.length} casos críticos/altos pendientes</p>
            <div className="flex flex-wrap gap-1.5">
              {criticalTickets.slice(0, 8).map(t => (
                <Badge key={t.id} variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                  {t.ticket_id} — {t.dias_antiguedad}d
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {minutas.length === 0 && !showCreate && (
        <Card>
          <CardContent className="p-8 text-center">
            <Presentation className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay minutas aún.</p>
            <p className="text-xs text-muted-foreground mt-1">Genera una minuta con IA basada en los casos del cliente.</p>
          </CardContent>
        </Card>
      )}

      {/* Minutas List */}
      {minutas.map(m => {
        const isExpanded = expandedId === m.id;
        const isEditing = editingId === m.id;
        return (
          <motion.div key={m.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={`group ${isExpanded ? "border-primary/30" : ""}`}>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{m.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(m.date).toLocaleDateString("es")}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {m.attendees?.length || 0} participantes</span>
                      <span>•</span>
                      <span>{m.cases_referenced.length} casos</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); setPresentationId(m.id); }}>
                      <Presentation className="h-3.5 w-3.5 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); startEdit(m); setExpandedId(m.id); }}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={e => { e.stopPropagation(); handleDelete(m.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-4">
                        {/* Participants */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Participantes</p>
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                {(editData.attendees || []).map((a, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                                    {a}
                                    <button onClick={() => removeAttendeeFromEdit(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Input placeholder="Agregar participante" className="text-xs h-7 flex-1"
                                  onKeyDown={e => { if (e.key === "Enter") { addAttendeeToEdit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
                              </div>
                              {teamMembers.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {teamMembers.filter(t => !(editData.attendees || []).includes(t)).map(t => (
                                    <button key={t} onClick={() => addAttendeeToEdit(t)} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded hover:bg-primary/10">{t}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {(m.attendees || []).map((a, i) => (
                                <div key={i} className="flex items-center gap-1.5 bg-secondary rounded-full px-2.5 py-1">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">
                                      {a.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[11px]">{a}</span>
                                </div>
                              ))}
                              {(!m.attendees || m.attendees.length === 0) && <span className="text-xs text-muted-foreground">Sin participantes</span>}
                            </div>
                          )}
                        </div>

                        {/* Summary */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Resumen</p>
                          {isEditing ? (
                            <Textarea className="text-xs min-h-[80px]" value={editData.summary || ""} onChange={e => setEditData(prev => ({ ...prev, summary: e.target.value }))} />
                          ) : (
                            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 rounded-md p-3">{m.summary}</p>
                          )}
                        </div>

                        {/* Agreements */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Acuerdos</p>
                          {isEditing ? (
                            <div className="space-y-1">
                              {(editData.agreements || []).map((a, i) => (
                                <div key={i} className="flex gap-1">
                                  <Input className="text-xs h-7 flex-1" value={a} onChange={e => {
                                    const updated = [...(editData.agreements || [])];
                                    updated[i] = e.target.value;
                                    setEditData(prev => ({ ...prev, agreements: updated }));
                                  }} />
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditData(prev => ({ ...prev, agreements: (prev.agreements || []).filter((_, j) => j !== i) }))}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setEditData(prev => ({ ...prev, agreements: [...(prev.agreements || []), ""] }))}>
                                <Plus className="h-3 w-3" /> Agregar acuerdo
                              </Button>
                            </div>
                          ) : (
                            <ul className="space-y-1">
                              {m.agreements.map((a, i) => (
                                <li key={i} className="text-xs flex items-start gap-2"><CheckSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />{a}</li>
                              ))}
                              {m.agreements.length === 0 && <span className="text-xs text-muted-foreground">Sin acuerdos</span>}
                            </ul>
                          )}
                        </div>

                        {/* Action Items */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Acciones a Seguir</p>
                          {isEditing ? (
                            <div className="space-y-1">
                              {(editData.action_items || []).map((a, i) => (
                                <div key={i} className="flex gap-1">
                                  <Input className="text-xs h-7 flex-1" value={a} onChange={e => {
                                    const updated = [...(editData.action_items || [])];
                                    updated[i] = e.target.value;
                                    setEditData(prev => ({ ...prev, action_items: updated }));
                                  }} />
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditData(prev => ({ ...prev, action_items: (prev.action_items || []).filter((_, j) => j !== i) }))}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setEditData(prev => ({ ...prev, action_items: [...(prev.action_items || []), ""] }))}>
                                <Plus className="h-3 w-3" /> Agregar acción
                              </Button>
                            </div>
                          ) : (
                            <ul className="space-y-1">
                              {m.action_items.map((a, i) => (
                                <li key={i} className="text-xs flex items-start gap-2"><ArrowRight className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />{a}</li>
                              ))}
                              {m.action_items.length === 0 && <span className="text-xs text-muted-foreground">Sin acciones</span>}
                            </ul>
                          )}
                        </div>

                        {/* Cases Referenced */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Casos Referenciados</p>
                          <div className="flex flex-wrap gap-1">
                            {m.cases_referenced.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                          </div>
                        </div>

                        {/* Edit controls */}
                        {isEditing && (
                          <div className="flex gap-2 pt-2 border-t border-border">
                            <Button size="sm" className="text-xs gap-1" onClick={() => handleSaveEdit(m.id)}>
                              <Save className="h-3 w-3" /> Guardar
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => { setEditingId(null); setEditData({}); }}>Cancelar</Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
    </>
  );
}
