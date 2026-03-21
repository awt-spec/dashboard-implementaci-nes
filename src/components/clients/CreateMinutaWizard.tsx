import { useState } from "react";
import { type Client, type ClientTask } from "@/data/projectData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Sparkles, Loader2, ChevronRight, ChevronLeft, Check,
  ClipboardPaste, ListChecks, Users, CheckSquare, ArrowRight,
  AlertTriangle, CircleDot, Clock, CheckCircle2, X, Calendar, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCreateMeetingMinute, useUpdateTask } from "@/hooks/useClients";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateMinutaWizardProps {
  client: Client;
  clientId: string;
  open: boolean;
  onClose: () => void;
}

interface AISummary {
  title: string;
  summary: string;
  agreements: string[];
  actionItems: string[];
  attendees: string[];
  taskUpdates: { taskTitle: string; suggestedStatus: string; note: string }[];
}

interface TaskUpdate {
  task: ClientTask;
  dbId?: string;
  newStatus: string;
  note: string;
  enabled: boolean;
}

const STEPS = [
  { id: 0, label: "Transcripción", icon: ClipboardPaste, desc: "Pega el texto" },
  { id: 1, label: "Resumen IA", icon: Sparkles, desc: "Revisa y edita" },
  { id: 2, label: "Gestiones", icon: ListChecks, desc: "Actualiza tareas" },
  { id: 3, label: "Confirmar", icon: Check, desc: "Guarda la minuta" },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  "completada": { label: "Completada", color: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
  "en-progreso": { label: "Progreso", color: "bg-info/15 text-info border-info/30", icon: Clock },
  "pendiente": { label: "Pendiente", color: "bg-warning/15 text-warning border-warning/30", icon: CircleDot },
  "bloqueada": { label: "Bloqueada", color: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle },
};

export function CreateMinutaWizard({ client, clientId, open, onClose }: CreateMinutaWizardProps) {
  const [step, setStep] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [summary, setSummary] = useState("");
  const [agreements, setAgreements] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [nextMeeting, setNextMeeting] = useState("");
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);

  const createMinute = useCreateMeetingMinute();
  const updateTask = useUpdateTask();

  const handleAnalyze = async () => {
    if (!transcript.trim()) { toast.error("Pega la transcripción primero"); return; }
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-transcript", {
        body: { transcript: transcript.trim(), clientName: client.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data as AISummary;
      setAiSummary(result);
      setTitle(result.title || "");
      setSummary(result.summary || "");
      setAgreements(result.agreements || []);
      setActionItems(result.actionItems || []);
      setAttendees(result.attendees || []);

      const updates: TaskUpdate[] = [];
      for (const tu of result.taskUpdates || []) {
        const match = client.tasks.find(t =>
          t.title.toLowerCase().includes(tu.taskTitle.toLowerCase()) ||
          tu.taskTitle.toLowerCase().includes(t.title.toLowerCase().substring(0, 20))
        );
        if (match) {
          const { data: dbTask } = await supabase
            .from("tasks").select("id").eq("client_id", clientId).eq("original_id", match.id).maybeSingle();
          updates.push({ task: match, dbId: dbTask?.id, newStatus: tu.suggestedStatus, note: tu.note, enabled: true });
        }
      }
      for (const t of client.tasks) {
        if (!updates.find(u => u.task.id === t.id)) {
          const { data: dbTask } = await supabase
            .from("tasks").select("id").eq("client_id", clientId).eq("original_id", t.id).maybeSingle();
          updates.push({ task: t, dbId: dbTask?.id, newStatus: t.status, note: "", enabled: false });
        }
      }
      setTaskUpdates(updates);
      setStep(1);
      toast.success("Transcripción analizada");
    } catch (e: any) {
      toast.error(e.message || "Error al analizar");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !summary.trim()) { toast.error("Título y resumen son obligatorios"); return; }
    const enabledUpdates = taskUpdates.filter(u => u.enabled && u.dbId && u.newStatus !== u.task.status);
    for (const u of enabledUpdates) {
      try { await updateTask.mutateAsync({ id: u.dbId!, updates: { status: u.newStatus } }); } catch { /* continue */ }
    }
    // Build snapshot of current client state
    const snapshot = JSON.parse(JSON.stringify(client));

    createMinute.mutate({
      client_id: clientId, original_id: `MM-${Date.now()}`, title: title.trim(), date,
      attendees, summary: summary.trim(), agreements, action_items: actionItems,
      next_meeting: nextMeeting || null,
      presentation_snapshot: snapshot,
    }, {
      onSuccess: () => {
        toast.success(`Minuta creada${enabledUpdates.length > 0 ? ` · ${enabledUpdates.length} tareas actualizadas` : ""}`);
        resetAndClose();
      },
      onError: (err) => {
        console.error("Error creating minuta:", err);
        toast.error(`Error al crear minuta: ${err.message || "desconocido"}`);
      },
    });
  };

  const resetAndClose = () => {
    setStep(0); setTranscript(""); setAiSummary(null);
    setTitle(""); setSummary(""); setAgreements([]); setActionItems([]); setAttendees([]); setNextMeeting("");
    setTaskUpdates([]); onClose();
  };

  if (!open) return null;

  const enabledChanges = taskUpdates.filter(u => u.enabled && u.newStatus !== u.task.status);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) resetAndClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col"
          style={{ maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Nueva Minuta</h2>
                <p className="text-[11px] text-muted-foreground">{client.name}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={resetAndClose} className="h-8 w-8 rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Stepper - horizontal progress */}
          <div className="px-5 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-0">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => { if (i <= step || (i === 1 && aiSummary)) setStep(i); }}
                    className="flex items-center gap-2 group"
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0",
                      step === i ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" :
                      i < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className={cn("text-[11px] font-semibold leading-tight", step === i ? "text-foreground" : "text-muted-foreground")}>{s.label}</p>
                      <p className="text-[9px] text-muted-foreground/70">{s.desc}</p>
                    </div>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("flex-1 h-[2px] mx-3 rounded-full transition-colors", i < step ? "bg-primary/40" : "bg-border")} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0 p-6">
            <AnimatePresence mode="wait">

              {/* Step 0: Transcription */}
              {step === 0 && (
                <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 h-full flex flex-col">
                  <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ClipboardPaste className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-bold text-foreground">Pega la transcripción</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Copia y pega el texto completo. La IA extraerá resumen, acuerdos, asistentes y actualizaciones.
                    </p>
                  </div>
                  <Textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder="Pega aquí la transcripción completa de la reunión..."
                    className="flex-1 min-h-[200px] font-mono text-xs leading-relaxed resize-none rounded-xl"
                  />
                  {transcript.length > 0 && (
                    <p className="text-[10px] text-muted-foreground text-right">
                      {transcript.split(/\s+/).filter(Boolean).length} palabras
                    </p>
                  )}
                </motion.div>
              )}

              {/* Step 1: AI Summary */}
              {step === 1 && aiSummary && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  
                  {/* Success banner */}
                  <div className="rounded-xl bg-success/10 border border-success/20 p-4 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Análisis completado</p>
                      <p className="text-xs text-muted-foreground">Revisa y edita la información extraída antes de continuar.</p>
                    </div>
                  </div>

                  {/* Title + Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-2 block">Título de la reunión</label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} className="text-sm h-10 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" /> Fecha
                        </label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm h-10 rounded-xl" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Próxima reunión
                        </label>
                        <Input type="date" value={nextMeeting} onChange={e => setNextMeeting(e.target.value)} className="text-sm h-10 rounded-xl" />
                      </div>
                    </div>
                  </div>

                  {/* Attendees */}
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Asistentes</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">{attendees.length}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attendees.map((a, i) => (
                        <Badge key={i} variant="secondary" className="gap-1.5 text-xs py-1 px-2.5 rounded-lg">
                          {a}
                          <button onClick={() => setAttendees(attendees.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Input
                        placeholder="+ Agregar asistente"
                        className="h-7 w-36 text-xs border-dashed rounded-lg"
                        onKeyDown={e => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                            setAttendees([...attendees, (e.target as HTMLInputElement).value.trim()]);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Resumen de la reunión</span>
                    </div>
                    <Textarea value={summary} onChange={e => setSummary(e.target.value)} className="min-h-[100px] text-sm leading-relaxed resize-none rounded-xl bg-muted/30 border-muted focus-visible:ring-1" />
                  </div>

                  {/* Agreements + Action Items side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckSquare className="h-4 w-4 text-success" />
                        <span className="text-xs font-semibold text-foreground">Acuerdos</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">{agreements.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {agreements.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 group">
                            <div className="h-2 w-2 rounded-full bg-success shrink-0" />
                            <Input
                              value={a}
                              onChange={e => setAgreements(agreements.map((ag, j) => j === i ? e.target.value : ag))}
                              className="h-8 text-sm flex-1 rounded-lg bg-muted/30 border-transparent focus-visible:border-border"
                            />
                            <button onClick={() => setAgreements(agreements.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <button onClick={() => setAgreements([...agreements, ""])} className="text-xs text-primary hover:underline font-medium">+ Agregar acuerdo</button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowRight className="h-4 w-4 text-warning" />
                        <span className="text-xs font-semibold text-foreground">Pendientes</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">{actionItems.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {actionItems.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 group">
                            <div className="h-2 w-2 rounded-full bg-warning shrink-0" />
                            <Input
                              value={a}
                              onChange={e => setActionItems(actionItems.map((ai, j) => j === i ? e.target.value : ai))}
                              className="h-8 text-sm flex-1 rounded-lg bg-muted/30 border-transparent focus-visible:border-border"
                            />
                            <button onClick={() => setActionItems(actionItems.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <button onClick={() => setActionItems([...actionItems, ""])} className="text-xs text-primary hover:underline font-medium">+ Agregar pendiente</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Task Updates */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                  <div className="rounded-xl bg-info/5 border border-info/15 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ListChecks className="h-4 w-4 text-info" />
                      <h3 className="text-sm font-bold text-foreground">Actualizar Tareas</h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Las sugerencias de la IA están habilitadas. Activa o desactiva según corresponda.
                    </p>
                  </div>

                  {/* AI suggested first, then others */}
                  {taskUpdates.filter(u => u.enabled).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" /> Sugeridas por IA
                      </p>
                      {taskUpdates.filter(u => u.enabled).map((tu, i) => (
                        <TaskUpdateRow key={tu.task.id} tu={tu} index={i} taskUpdates={taskUpdates} setTaskUpdates={setTaskUpdates} />
                      ))}
                    </div>
                  )}

                  {taskUpdates.filter(u => !u.enabled).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2">Otras tareas</p>
                      {taskUpdates.filter(u => !u.enabled).map((tu, i) => (
                        <TaskUpdateRow key={tu.task.id} tu={tu} index={i} taskUpdates={taskUpdates} setTaskUpdates={setTaskUpdates} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Confirm */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="rounded-2xl border border-border overflow-hidden">
                    {/* Confirm header */}
                    <div className="bg-primary/5 px-4 py-3 border-b border-border">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground">{title}</h3>
                        <Badge variant="outline" className="text-[10px] rounded-lg">{date}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {attendees.map((a, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] rounded-md">{a}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Resumen</p>
                        <p className="text-xs text-foreground leading-relaxed">{summary}</p>
                      </div>

                      {agreements.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Acuerdos</p>
                          <ul className="space-y-1">
                            {agreements.map((a, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                <CheckSquare className="h-3 w-3 text-success shrink-0 mt-0.5" />{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {actionItems.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pendientes</p>
                          <ul className="space-y-1">
                            {actionItems.map((a, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                <ArrowRight className="h-3 w-3 text-warning shrink-0 mt-0.5" />{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {enabledChanges.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Tareas a actualizar ({enabledChanges.length})
                          </p>
                          <div className="space-y-1">
                            {enabledChanges.map(u => (
                              <div key={u.task.id} className="flex items-center gap-2 text-xs rounded-lg bg-muted/50 px-2 py-1.5">
                                <span className="font-mono text-muted-foreground text-[10px]">#{u.task.id}</span>
                                <span className="text-foreground truncate flex-1">{u.task.title}</span>
                                <Badge variant="outline" className={cn("text-[9px] py-0 h-4 rounded-md", statusConfig[u.task.status]?.color)}>
                                  {statusConfig[u.task.status]?.label}
                                </Badge>
                                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                                <Badge variant="outline" className={cn("text-[9px] py-0 h-4 rounded-md", statusConfig[u.newStatus]?.color)}>
                                  {statusConfig[u.newStatus]?.label}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer - always visible */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-between shrink-0 bg-card">
            <div>
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep(step - 1)} className="gap-1 text-xs h-8">
                  <ChevronLeft className="h-3.5 w-3.5" /> Atrás
                </Button>
              ) : (
                <Button variant="ghost" onClick={resetAndClose} className="text-xs h-8">Cancelar</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step === 0 && (
                <Button onClick={handleAnalyze} disabled={!transcript.trim() || isAnalyzing} className="gap-2 h-8 text-xs rounded-lg">
                  {isAnalyzing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analizando...</> : <><Sparkles className="h-3.5 w-3.5" /> Analizar con IA</>}
                </Button>
              )}
              {step === 1 && (
                <Button onClick={() => setStep(2)} className="gap-1 h-8 text-xs rounded-lg">
                  Gestiones <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
              {step === 2 && (
                <Button onClick={() => setStep(3)} className="gap-1 h-8 text-xs rounded-lg">
                  Confirmar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
              {step === 3 && (
                <Button onClick={handleCreate} disabled={createMinute.isPending} className="gap-2 h-8 text-xs rounded-lg">
                  {createMinute.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...</> : <><Check className="h-3.5 w-3.5" /> Crear Minuta</>}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* Extracted row component for task updates */
function TaskUpdateRow({ tu, index, taskUpdates, setTaskUpdates }: {
  tu: TaskUpdate; index: number; taskUpdates: TaskUpdate[]; setTaskUpdates: (v: TaskUpdate[]) => void;
}) {
  const realIndex = taskUpdates.findIndex(u => u.task.id === tu.task.id);
  const currentStatus = statusConfig[tu.task.status];
  const changed = tu.newStatus !== tu.task.status;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={cn(
        "rounded-xl border p-2.5 transition-all flex items-center gap-3",
        tu.enabled && changed ? "border-primary/30 bg-primary/5" : "border-border hover:border-border/80"
      )}
    >
      <button
        onClick={() => setTaskUpdates(taskUpdates.map((u, j) => j === realIndex ? { ...u, enabled: !u.enabled } : u))}
        className={cn(
          "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
          tu.enabled ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
        )}
      >
        {tu.enabled && <Check className="h-3 w-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground">#{tu.task.id}</span>
          <p className="text-[11px] font-medium text-foreground truncate">{tu.task.title}</p>
        </div>
        {tu.enabled && tu.note && (
          <p className="text-[10px] text-muted-foreground mt-0.5 italic truncate">💡 {tu.note}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className={cn("text-[9px] py-0 h-5 rounded-md", currentStatus?.color)}>
          {currentStatus?.label || tu.task.status}
        </Badge>
        {tu.enabled && (
          <>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Select
              value={tu.newStatus}
              onValueChange={v => setTaskUpdates(taskUpdates.map((u, j) => j === realIndex ? { ...u, newStatus: v } : u))}
            >
              <SelectTrigger className={cn("h-5 w-auto text-[9px] gap-1 rounded-md border px-1.5", statusConfig[tu.newStatus]?.color)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </motion.div>
  );
}
