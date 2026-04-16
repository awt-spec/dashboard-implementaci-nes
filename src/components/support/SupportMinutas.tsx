import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FileText, Plus, Calendar, Sparkles, Loader2, ChevronDown, ChevronUp, Trash2,
  Users, CheckSquare, ArrowRight, Presentation, Edit3, Save, X, UserPlus, AlertTriangle, Share2,
  Mic, ClipboardPaste, MessageSquareText, Upload, File
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SupportMinutaPresentation } from "./SupportMinutaPresentation";
import { ShareSupportPresentationDialog } from "./ShareSupportPresentationDialog";
import { toast } from "sonner";
import type { SupportTicket } from "@/hooks/useSupportTickets";

interface Props {
  tickets: SupportTicket[];
  clientName: string;
  clientId: string;
  teamMembers?: string[];
  /** When provided, enables multi-client (general support) minuta mode */
  availableClients?: { id: string; name: string }[];
  /** All tickets across all clients (used in general view to source cases) */
  allTickets?: SupportTicket[];
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
  referenced_clients?: string[];
  created_at: string;
}

type GenerationMode = "cases" | "transcript";

export function SupportMinutas({ tickets, clientName, clientId, teamMembers = [], availableClients = [], allTickets = [] }: Props) {
  const isGeneralMode = clientId === "all" || !clientId;
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [shareMinutaId, setShareMinutaId] = useState<string | null>(null);
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
  // Transcript mode
  const [generationMode, setGenerationMode] = useState<GenerationMode>("cases");
  const [transcript, setTranscript] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Multi-client (general support) mode
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  const loadMinutas = useCallback(() => {
    setLoading(true);
    const query = isGeneralMode
      ? supabase.from("support_minutes").select("*")
      : supabase.from("support_minutes").select("*")
          .or(`client_id.eq.${clientId},referenced_clients.cs.{${clientId}}`);
    query.order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setMinutas(data as any);
        setLoading(false);
      });
  }, [clientId, isGeneralMode]);

  useEffect(() => { loadMinutas(); }, [loadMinutas]);

  // In general mode, source tickets from selected clients (or all if none selected)
  const sourceTickets = useMemo(() => {
    if (!isGeneralMode) return tickets;
    if (selectedClientIds.length === 0) return allTickets;
    return allTickets.filter(t => selectedClientIds.includes(t.client_id));
  }, [isGeneralMode, tickets, allTickets, selectedClientIds]);

  const activeTickets = useMemo(() =>
    sourceTickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)), [sourceTickets]);

  const criticalTickets = useMemo(() =>
    activeTickets.filter(t => t.prioridad === "Critica, Impacto Negocio" || t.prioridad === "Alta")
      .sort((a, b) => b.dias_antiguedad - a.dias_antiguedad), [activeTickets]);

  const handleGenerateMinuta = async () => {
    if (generationMode === "transcript" && !transcript.trim()) {
      toast.error("Pega la transcripción de la reunión para continuar");
      return;
    }
    if (isGeneralMode && selectedClientIds.length === 0) {
      toast.error("Selecciona al menos un cliente para la minuta general");
      return;
    }
    setGenerating(true);
    try {
      const effectiveClientName = isGeneralMode
        ? (selectedClientIds.length === 1
            ? (availableClients.find(c => c.id === selectedClientIds[0])?.name || "Cliente")
            : `Soporte General (${selectedClientIds.length} clientes)`)
        : clientName;

      const ticketsPool = isGeneralMode ? sourceTickets : tickets;
      let promptContent = "";

      if (generationMode === "transcript") {
        const casesToUse = selectedCaseIds.length > 0
          ? ticketsPool.filter(t => selectedCaseIds.includes(t.id))
          : activeTickets.slice(0, 15);
        const casesContext = casesToUse.map(t => {
          const cn = availableClients.find(c => c.id === t.client_id)?.name;
          return `[${t.ticket_id}]${cn && isGeneralMode ? ` (${cn})` : ""} ${t.asunto} | ${t.estado} | ${t.prioridad}`;
        }).join("\n");

        promptContent = `TRANSCRIPCIÓN DE REUNIÓN DE SOPORTE - ${effectiveClientName}
Fecha: ${new Date().toLocaleDateString("es")}
Participantes: ${selectedAttendees.join(", ") || "Por definir"}

Contexto de casos activos:
${casesContext}

TRANSCRIPCIÓN:
${transcript}

Analiza esta transcripción y genera: título, resumen ejecutivo, acuerdos tomados, acciones a seguir y próximos pasos. Identifica los casos mencionados.`;
      } else {
        const casesToUse = selectedCaseIds.length > 0
          ? ticketsPool.filter(t => selectedCaseIds.includes(t.id))
          : activeTickets.slice(0, 30);
        const casesSummary = casesToUse.map(t => {
          const cn = availableClients.find(c => c.id === t.client_id)?.name;
          return `[${t.ticket_id}]${cn && isGeneralMode ? ` (${cn})` : ""} ${t.asunto} | Estado: ${t.estado} | Prioridad: ${t.prioridad} | Días: ${t.dias_antiguedad} | Responsable: ${t.responsable || "N/A"} | Producto: ${t.producto} | Tipo: ${t.tipo} | Notas: ${t.notas || "N/A"} | IA: ${t.ai_summary || "N/A"}`;
        }).join("\n");

        promptContent = `MINUTA DE SOPORTE - ${effectiveClientName}
Fecha: ${new Date().toLocaleDateString("es")}
Participantes: ${selectedAttendees.join(", ") || "Por definir"}

Casos activos:
${casesSummary}

Genera una minuta ejecutiva de soporte con título, resumen, acuerdos y acciones a seguir.`;
      }

      const { data, error } = await supabase.functions.invoke("summarize-transcript", {
        body: { transcript: promptContent, clientName: effectiveClientName },
      });

      if (error) throw error;

      let parsed: any;
      try {
        const text = typeof data === "string" ? data : data?.summary || data?.text || JSON.stringify(data);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: "Minuta de Soporte", summary: text, agreements: [], action_items: [], cases_highlighted: [] };
      } catch {
        parsed = typeof data === "object" && data?.title ? data : { title: "Minuta de Soporte", summary: String(data), agreements: [], action_items: [], cases_highlighted: [] };
      }

      const casesToUse = selectedCaseIds.length > 0
        ? ticketsPool.filter(t => selectedCaseIds.includes(t.id))
        : activeTickets.slice(0, 30);

      // In general mode, primary client_id = first selected; remaining are referenced
      const primaryClientId = isGeneralMode ? selectedClientIds[0] : clientId;
      const referencedClients = isGeneralMode ? selectedClientIds : [];

      const now = new Date().toISOString();
      const minutaRow = {
        client_id: primaryClientId,
        title: newTitle || parsed.title || `Minuta de Soporte - ${effectiveClientName}`,
        date: now.split("T")[0],
        summary: parsed.summary || "",
        cases_referenced: parsed.cases_highlighted || casesToUse.map(t => t.ticket_id),
        action_items: [...manualActions, ...(parsed.actionItems || parsed.action_items || [])],
        agreements: [...manualAgreements, ...(parsed.agreements || [])],
        attendees: selectedAttendees.length > 0 ? selectedAttendees : (parsed.attendees || []),
        referenced_clients: referencedClients,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("support_minutes").insert([minutaRow] as any).select().single();
      if (insertErr) throw insertErr;

      setMinutas(prev => [inserted as any, ...prev]);
      setShowCreate(false);
      resetCreateForm();
      setPresentationId((inserted as any).id);
      toast.success("Minuta generada exitosamente");
    } catch (e: any) {
      toast.error(e.message || "Error generando minuta");
    } finally {
      setGenerating(false);
    }
  };

  const resetCreateForm = () => {
    setNewTitle("");
    setSelectedCaseIds([]);
    setSelectedAttendees([]);
    setManualAgreements([]);
    setManualActions([]);
    setNewAgreement("");
    setNewAction("");
    setTranscript("");
    setGenerationMode("cases");
    setUploadedFile(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setParsingFile(true);
    try {
      if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".vtt") || file.name.endsWith(".srt")) {
        const text = await file.text();
        setTranscript(text);
        toast.success(`Archivo cargado: ${file.name}`);
      } else if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        const text = await file.text();
        setTranscript(text);
        toast.success(`Archivo cargado: ${file.name} (texto extraído)`);
      } else {
        const text = await file.text();
        setTranscript(text);
        toast.success(`Archivo cargado: ${file.name}`);
      }
    } catch {
      toast.error("Error leyendo el archivo");
    } finally {
      setParsingFile(false);
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

  const presentingMinuta = minutas.find(m => m.id === presentationId);
  const shareMinuta = minutas.find(m => m.id === shareMinutaId);

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
          onMinutaUpdated={loadMinutas}
        />
      )}
      {shareMinuta && (
        <ShareSupportPresentationDialog
          minuta={shareMinuta}
          tickets={tickets}
          clientName={clientName}
          open={!!shareMinutaId}
          onClose={() => setShareMinutaId(null)}
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

                {/* Generation Mode Selector */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Fuente de datos</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGenerationMode("cases")}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs ${
                        generationMode === "cases"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      <FileText className="h-5 w-5" />
                      <span className="font-medium">Desde Casos</span>
                      <span className="text-[10px] opacity-70 text-center">IA analiza los casos activos</span>
                    </button>
                    <button
                      onClick={() => setGenerationMode("transcript")}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs ${
                        generationMode === "transcript"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      <MessageSquareText className="h-5 w-5" />
                      <span className="font-medium">Desde Transcripción</span>
                      <span className="text-[10px] opacity-70 text-center">Pega la transcripción de la reunión</span>
                    </button>
                  </div>
                </div>

                {/* Transcript Input */}
                {generationMode === "transcript" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <ClipboardPaste className="h-3.5 w-3.5" /> Transcripción de la reunión
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {transcript.length > 0 ? `${transcript.split(/\s+/).filter(Boolean).length} palabras` : ""}
                      </span>
                    </div>

                    {/* File Upload Area */}
                    <div
                      className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input ref={fileInputRef} type="file" className="hidden"
                        accept=".txt,.md,.vtt,.srt,.doc,.docx,.csv"
                        onChange={handleFileUpload} />
                      {parsingFile ? (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Procesando archivo...</span>
                        </div>
                      ) : uploadedFile ? (
                        <div className="flex items-center justify-center gap-2 py-1">
                          <File className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-foreground">{uploadedFile.name}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); setUploadedFile(null); setTranscript(""); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1 py-2">
                          <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
                          <p className="text-xs text-muted-foreground">Sube un archivo de transcripción</p>
                          <p className="text-[10px] text-muted-foreground/60">.txt, .md, .vtt, .srt, .doc, .docx</p>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border" />
                      <div className="relative flex justify-center">
                        <span className="bg-card px-2 text-[10px] text-muted-foreground">o pegar texto directamente</span>
                      </div>
                    </div>

                    <Textarea
                      placeholder="Pega aquí la transcripción de la reunión (de Teams, Zoom, Google Meet, etc.)..."
                      value={transcript}
                      onChange={e => setTranscript(e.target.value)}
                      className="text-xs min-h-[120px] leading-relaxed"
                    />
                    {transcript.length > 0 && (
                      <div className="flex items-center gap-2 text-[10px] text-emerald-400">
                        <CheckSquare className="h-3 w-3" />
                        <span>Transcripción lista • La IA extraerá resumen, acuerdos, acciones y participantes</span>
                      </div>
                    )}
                  </div>
                )}

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

                {/* Case selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {generationMode === "transcript" ? "Casos de contexto (opcional)" : "Casos a incluir"}{" "}
                      <Badge variant="secondary" className="text-[10px] ml-1">{selectedCaseIds.length > 0 ? `${selectedCaseIds.length} seleccionados` : "todos los activos"}</Badge>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Button size="sm" variant={selectedCaseIds.length === 0 ? "default" : "outline"} className="text-[10px] h-6 px-2"
                      onClick={() => setSelectedCaseIds([])}>Todos activos</Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-6 px-2"
                      onClick={() => setSelectedCaseIds(activeTickets.filter(t => t.prioridad.includes("Critica") || t.prioridad === "Alta").map(t => t.id))}>
                      <AlertTriangle className="h-3 w-3 mr-1" /> Solo críticos ({activeTickets.filter(t => t.prioridad.includes("Critica") || t.prioridad === "Alta").length})
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-6 px-2"
                      onClick={() => setSelectedCaseIds(activeTickets.map(t => t.id))}>
                      Seleccionar todos ({activeTickets.length})
                    </Button>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto space-y-1 border border-border rounded-md p-2">
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

                {/* Manual Agreements */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Acuerdos previos (opcional)</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {manualAgreements.map((a, i) => (
                      <Badge key={i} variant="outline" className="text-xs gap-1 pr-1 border-emerald-500/30 text-emerald-400">
                        {a}
                        <button onClick={() => setManualAgreements(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Ej: Se acuerda priorizar caso X..." value={newAgreement} onChange={e => setNewAgreement(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && newAgreement.trim()) { e.preventDefault(); setManualAgreements(prev => [...prev, newAgreement.trim()]); setNewAgreement(""); } }}
                      className="text-xs flex-1" />
                    <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0" disabled={!newAgreement.trim()}
                      onClick={() => { setManualAgreements(prev => [...prev, newAgreement.trim()]); setNewAgreement(""); }}>
                      <Plus className="h-3 w-3" /> Agregar
                    </Button>
                  </div>
                </div>

                {/* Manual Actions */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Acciones previas (opcional)</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {manualActions.map((a, i) => (
                      <Badge key={i} variant="outline" className="text-xs gap-1 pr-1 border-blue-500/30 text-blue-400">
                        {a}
                        <button onClick={() => setManualActions(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Ej: Enviar reporte a cliente..." value={newAction} onChange={e => setNewAction(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && newAction.trim()) { e.preventDefault(); setManualActions(prev => [...prev, newAction.trim()]); setNewAction(""); } }}
                      className="text-xs flex-1" />
                    <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0" disabled={!newAction.trim()}
                      onClick={() => { setManualActions(prev => [...prev, newAction.trim()]); setNewAction(""); }}>
                      <Plus className="h-3 w-3" /> Agregar
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 text-xs" onClick={handleGenerateMinuta} disabled={generating}>
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generating ? "Analizando con IA..." : generationMode === "transcript" ? "Analizar Transcripción" : "Generar con IA"}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => { setShowCreate(false); resetCreateForm(); }}>Cancelar</Button>
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
            <p className="text-xs text-muted-foreground mt-1">Genera una minuta con IA basada en los casos o una transcripción.</p>
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
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); setShareMinutaId(m.id); }}
                      title="Compartir con feedback">
                      <Share2 className="h-3.5 w-3.5 text-emerald-400" />
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
