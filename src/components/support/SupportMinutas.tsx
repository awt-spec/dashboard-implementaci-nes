import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Calendar, Sparkles, Loader2, ChevronDown, ChevronUp, Trash2, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SupportTicket } from "@/hooks/useSupportTickets";

interface Props {
  tickets: SupportTicket[];
  clientName: string;
  clientId: string;
}

interface Minuta {
  id: string;
  title: string;
  date: string;
  summary: string;
  cases_referenced: string[];
  action_items: string[];
  agreements: string[];
  created_at: string;
}

export function SupportMinutas({ tickets, clientName, clientId }: Props) {
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);

  const activeTickets = useMemo(() =>
    tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)),
    [tickets]
  );

  const criticalTickets = useMemo(() =>
    activeTickets.filter(t => t.prioridad === "Critica, Impacto Negocio" || t.prioridad === "Alta")
      .sort((a, b) => b.dias_antiguedad - a.dias_antiguedad),
    [activeTickets]
  );

  const handleGenerateMinuta = async () => {
    setGenerating(true);
    try {
      const casesToUse = selectedCaseIds.length > 0
        ? tickets.filter(t => selectedCaseIds.includes(t.id))
        : activeTickets.slice(0, 30);

      const casesSummary = casesToUse.map(t =>
        `[${t.ticket_id}] ${t.asunto} | Estado: ${t.estado} | Prioridad: ${t.prioridad} | Días: ${t.dias_antiguedad} | Responsable: ${t.responsable || "N/A"} | Notas: ${t.notas || "N/A"} | IA: ${t.ai_summary || "N/A"}`
      ).join("\n");

      const { data, error } = await supabase.functions.invoke("summarize-transcript", {
        body: {
          transcript: `MINUTA DE SOPORTE - ${clientName}\nFecha: ${new Date().toLocaleDateString("es")}\n\nCasos activos del cliente:\n${casesSummary}`,
          systemPrompt: `Eres un gerente de soporte técnico. Genera una minuta ejecutiva de soporte basada en los casos del cliente.
La minuta debe incluir:
1. Título descriptivo de la sesión
2. Resumen ejecutivo del estado actual del soporte
3. Casos críticos y su estado
4. Acuerdos y compromisos recomendados
5. Acciones a seguir con responsables

Responde en formato JSON con esta estructura exacta:
{"title":"...","summary":"...","agreements":["..."],"action_items":["..."],"cases_highlighted":["ticket_id1","ticket_id2"]}

Responde SOLO con JSON válido, sin markdown.`,
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

      const minuta: Minuta = {
        id: crypto.randomUUID(),
        title: newTitle || parsed.title || `Minuta de Soporte - ${clientName}`,
        date: new Date().toISOString().split("T")[0],
        summary: parsed.summary || "",
        cases_referenced: parsed.cases_highlighted || casesToUse.map(t => t.ticket_id),
        action_items: parsed.action_items || [],
        agreements: parsed.agreements || [],
        created_at: new Date().toISOString(),
      };

      setMinutas(prev => [minuta, ...prev]);
      setShowCreate(false);
      setNewTitle("");
      setSelectedCaseIds([]);
      setExpandedId(minuta.id);
      toast.success("Minuta generada exitosamente");
    } catch (e: any) {
      toast.error(e.message || "Error generando minuta");
    } finally {
      setGenerating(false);
    }
  };

  const toggleCase = (id: string) => {
    setSelectedCaseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold">Minutas de Soporte — {clientName}</h3>
          <Badge variant="outline" className="text-xs">{minutas.length} minutas</Badge>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3.5 w-3.5" />
          Nueva Minuta
        </Button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Generar Minuta con IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Título de la minuta (opcional, IA generará uno)"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="text-xs"
                />

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Seleccionar casos a incluir ({selectedCaseIds.length > 0 ? `${selectedCaseIds.length} seleccionados` : "todos los activos por defecto"})
                  </p>
                  <div className="max-h-[200px] overflow-y-auto space-y-1 border border-border rounded-md p-2">
                    {activeTickets.slice(0, 50).map(t => (
                      <label key={t.id} className="flex items-center gap-2 text-xs hover:bg-muted/30 p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.includes(t.id)}
                          onChange={() => toggleCase(t.id)}
                          className="rounded"
                        />
                        <span className="font-mono font-bold">{t.ticket_id}</span>
                        <span className="truncate flex-1">{t.asunto}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">{t.estado}</Badge>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 text-xs" onClick={handleGenerateMinuta} disabled={generating}>
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generating ? "Generando..." : "Generar con IA"}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowCreate(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Critical cases summary */}
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

      {/* Minutas list */}
      {minutas.length === 0 && !showCreate && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay minutas aún.</p>
            <p className="text-xs text-muted-foreground mt-1">Presiona "Nueva Minuta" para generar una con IA basada en los casos del cliente.</p>
          </CardContent>
        </Card>
      )}

      {minutas.map(m => {
        const isExpanded = expandedId === m.id;
        return (
          <motion.div key={m.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={isExpanded ? "border-primary/30" : ""}>
              <CardContent className="p-0">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3 w-3" /> {new Date(m.date).toLocaleDateString("es")}
                      <span>•</span>
                      {m.cases_referenced.length} casos referenciados
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={e => {
                      e.stopPropagation();
                      setMinutas(prev => prev.filter(x => x.id !== m.id));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4 border-t border-border/50">
                        <div className="pt-3">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">Resumen Ejecutivo</h4>
                          <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/20 rounded-md p-3">{m.summary}</p>
                        </div>

                        {m.agreements.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">Acuerdos</h4>
                            <ul className="space-y-1">
                              {m.agreements.map((a, i) => (
                                <li key={i} className="text-xs flex items-start gap-2">
                                  <span className="text-primary mt-0.5">✓</span>
                                  <span>{a}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {m.action_items.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">Acciones a Seguir</h4>
                            <ul className="space-y-1">
                              {m.action_items.map((a, i) => (
                                <li key={i} className="text-xs flex items-start gap-2">
                                  <span className="text-warning mt-0.5">→</span>
                                  <span>{a}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div>
                          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">Casos Referenciados</h4>
                          <div className="flex flex-wrap gap-1">
                            {m.cases_referenced.map(c => (
                              <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                            ))}
                          </div>
                        </div>
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
  );
}
