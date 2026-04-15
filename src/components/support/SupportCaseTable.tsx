import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Brain, Calendar, User, Tag, FileText, AlertTriangle } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SupportTicket } from "@/hooks/useSupportTickets";
import { motion, AnimatePresence } from "framer-motion";

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
}

export function SupportCaseTable({ tickets, clientName }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
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
            return (
              <>
                <tr
                  key={t.id}
                  className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${isClosed ? "opacity-50" : ""} ${isExpanded ? "bg-muted/20" : ""}`}
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <td className="p-2 text-center">
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground inline" /> : <ChevronDown className="h-3 w-3 text-muted-foreground inline" />}
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
                          <div className="p-4 bg-muted/10 border-b border-border">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Left: Main info */}
                              <div className="space-y-3">
                                <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-primary" />
                                  Detalle del Caso
                                </h4>
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <Tag className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">ID:</span>
                                    <span className="font-mono font-bold">{t.ticket_id}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Responsable:</span>
                                    <span className="font-medium">{t.responsable || "Sin asignar"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Registro:</span>
                                    <span>{t.fecha_registro ? new Date(t.fecha_registro).toLocaleDateString("es") : "—"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Entrega:</span>
                                    <span>{t.fecha_entrega ? new Date(t.fecha_entrega).toLocaleDateString("es") : "—"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Antigüedad:</span>
                                    <span className={`font-bold ${t.dias_antiguedad > 365 ? "text-destructive" : t.dias_antiguedad > 90 ? "text-warning" : ""}`}>
                                      {t.dias_antiguedad} días
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Center: Subject & Notes */}
                              <div className="space-y-3">
                                <h4 className="font-bold text-sm text-foreground">Asunto Completo</h4>
                                <p className="text-xs text-foreground bg-card rounded-md p-2 border border-border/50">{t.asunto}</p>
                                {t.notas && (
                                  <>
                                    <h4 className="font-bold text-sm text-foreground">Notas</h4>
                                    <p className="text-xs text-muted-foreground bg-card rounded-md p-2 border border-border/50">{t.notas}</p>
                                  </>
                                )}
                              </div>

                              {/* Right: AI Analysis */}
                              <div className="space-y-3">
                                <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                  <Brain className="h-3.5 w-3.5 text-violet-400" />
                                  Análisis IA
                                </h4>
                                {t.ai_classification ? (
                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Categoría:</span>
                                      <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-400">{t.ai_classification}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Riesgo:</span>
                                      <Badge variant="outline" className={`text-[10px] ${aiRiskColors[t.ai_risk_level || ""] || ""}`}>
                                        {aiRiskLabels[t.ai_risk_level || ""] || t.ai_risk_level || "—"}
                                      </Badge>
                                    </div>
                                    {t.ai_summary && (
                                      <div>
                                        <span className="text-muted-foreground">Resumen:</span>
                                        <p className="text-foreground mt-1 bg-card rounded-md p-2 border border-violet-500/20">{t.ai_summary}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">No clasificado aún. Use "Clasificar con IA" para analizar.</p>
                                )}
                              </div>
                            </div>
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
