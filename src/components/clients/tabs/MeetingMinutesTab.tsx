import { useState } from "react";
import { type MeetingMinute, type Client } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Calendar, Users, FileText, ChevronDown, ChevronUp, CheckSquare,
  ArrowRight, Plus, Trash2, Presentation, Sparkles, Share2, Eye, EyeOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useDeleteMeetingMinute } from "@/hooks/useClients";
import { MinutaPresentation } from "../MinutaPresentation";
import { CreateMinutaWizard } from "../CreateMinutaWizard";
import { SharePresentationDialog } from "../SharePresentationDialog";

interface MeetingMinutesTabProps {
  meetingMinutes: MeetingMinute[];
  clientId: string;
  client?: Client;
}

export function MeetingMinutesTab({ meetingMinutes, clientId, client }: MeetingMinutesTabProps) {
  const [expandedMinute, setExpandedMinute] = useState<string | null>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationClient, setPresentationClient] = useState<Client | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const deleteMinute = useDeleteMeetingMinute();

  const handleDelete = async (m: MeetingMinute) => {
    const { data } = await supabase.from("meeting_minutes").select("id").eq("client_id", clientId).eq("original_id", m.id).maybeSingle();
    if (!data) return;
    deleteMinute.mutate(data.id, { onSuccess: () => toast.success("Minuta eliminada"), onError: () => toast.error("Error") });
  };

  return (
    <>
      {/* Fullscreen Presentation */}
      {presentationClient && (
        <MinutaPresentation
          client={presentationClient}
          open={presentationOpen}
          onClose={() => { setPresentationOpen(false); setPresentationClient(null); }}
          onContinue={() => { setPresentationOpen(false); setPresentationClient(null); setWizardOpen(true); }}
        />
      )}

      {/* Share Dialog */}
      {client && (
        <SharePresentationDialog client={client} open={shareOpen} onClose={() => setShareOpen(false)} />
      )}

      {/* Create Wizard */}
      {client && (
        <CreateMinutaWizard
          client={client}
          clientId={clientId}
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Minutas de Sesión ({meetingMinutes.length})</CardTitle>
            <div className="flex gap-2">
              {client && (
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setShareOpen(true)}>
                  <Share2 className="h-3 w-3" /> Compartir
                </Button>
              )}
              {client && (
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => { setPresentationClient(client); setPresentationOpen(true); }}>
                  <Presentation className="h-3 w-3" /> Presentación
                </Button>
              )}
              <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setWizardOpen(true)}>
                <Sparkles className="h-3 w-3" /> Nueva Minuta
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {meetingMinutes.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Sin minutas registradas</p>
              <p className="text-xs text-muted-foreground/70">Crea una nueva minuta con transcripción y resumen IA</p>
            </div>
          ) : meetingMinutes.map(minute => {
            const isExpanded = expandedMinute === minute.id;
            return (
              <motion.div
                key={minute.id}
                layout
                className="rounded-xl border border-border group hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center justify-between p-4">
                  <button
                    onClick={() => setExpandedMinute(isExpanded ? null : minute.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{minute.title}</p>
                      <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {minute.date}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {minute.attendees.length} asistentes</span>
                        {minute.agreements.length > 0 && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{minute.agreements.length} acuerdos</Badge>
                        )}
                        {minute.nextMeeting && (
                          <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3" /> {minute.nextMeeting}</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {minute.presentationSnapshot && (
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={e => { e.stopPropagation(); setPresentationClient(minute.presentationSnapshot!); setPresentationOpen(true); }}>
                          <Presentation className="h-3 w-3" /> Ver Presentación
                        </Button>
                      </motion.div>
                    )}
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all" onClick={() => handleDelete(minute)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border pt-3 space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Asistentes</p>
                          <div className="flex flex-wrap gap-1.5">
                            {minute.attendees.map(a => (
                              <div key={a} className="flex items-center gap-1.5 bg-secondary rounded-full px-2.5 py-1">
                                <Avatar className="h-5 w-5"><AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">{a.split(" ").map(w => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                                <span className="text-[11px] text-foreground">{a}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Resumen</p>
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{minute.summary}</p>
                        </div>
                        {minute.agreements.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Acuerdos</p>
                            <ul className="space-y-1">
                              {minute.agreements.map((agreement, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                  <CheckSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />{agreement}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {minute.actionItems.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Pendientes</p>
                            <ul className="space-y-1">
                              {minute.actionItems.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                  <ArrowRight className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />{item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
