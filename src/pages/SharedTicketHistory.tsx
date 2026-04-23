import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Headset, AlertTriangle, Loader2, Calendar, Clock, User, Tag, FileText,
  Building2, Lock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TicketHistoryTimeline } from "@/components/support/TicketHistoryTimeline";
import type { TicketHistoryEvent } from "@/hooks/useTicketHistory";

// ─── Tipos ───────────────────────────────────────────────────────────────

interface TicketSnapshot {
  ticket_id: string;
  asunto: string;
  estado: string;
  prioridad: string;
  responsable: string | null;
  producto: string | null;
  tipo: string | null;
  created_at: string;
  updated_at?: string | null;
  fecha_entrega?: string | null;
}

interface SharedHistoryRow {
  id: string;
  title: string;
  client_name: string | null;
  include_internal_notes: boolean;
  include_system_views: boolean;
  history_snapshot: TicketHistoryEvent[];
  ticket_snapshot: TicketSnapshot;
  created_at: string;
  expires_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function stateColor(s: string) {
  const closed = ["CERRADA", "ENTREGADA", "ANULADA"];
  if (closed.includes(s)) return "bg-muted text-muted-foreground";
  if (s === "EN ATENCIÓN") return "bg-info/15 text-info border-info/30";
  if (s === "PENDIENTE") return "bg-warning/15 text-warning border-warning/30";
  return "bg-muted/40";
}

function priorityColor(p: string | null) {
  if (!p) return "bg-muted text-muted-foreground";
  if (/critica/i.test(p)) return "bg-destructive/15 text-destructive border-destructive/30";
  if (p === "Alta") return "bg-warning/15 text-warning border-warning/30";
  if (p === "Media") return "bg-info/15 text-info border-info/30";
  return "bg-muted text-muted-foreground";
}

// ─── Página ──────────────────────────────────────────────────────────────

export default function SharedTicketHistory() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedHistoryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data: row, error: fetchErr } = await (supabase
        .from("shared_ticket_history" as any)
        .select("id, title, client_name, include_internal_notes, include_system_views, history_snapshot, ticket_snapshot, created_at, expires_at")
        .eq("token", token)
        .maybeSingle() as any);

      if (fetchErr || !row) {
        setError("Enlace no encontrado.");
        setLoading(false);
        return;
      }

      if (new Date(row.expires_at) < new Date()) {
        setError("Este enlace ha expirado. Solicitá uno nuevo al equipo de soporte.");
        setLoading(false);
        return;
      }

      setData(row as SharedHistoryRow);
      setLoading(false);

      // Registrar la visita (best-effort, no bloquea el render si falla)
      supabase.rpc("bump_shared_ticket_history_view" as any, { p_token: token }).then(() => {});
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
            <h1 className="text-lg font-bold mb-1">No disponible</h1>
            <p className="text-sm text-muted-foreground">
              {error || "Este historial no existe o fue removido."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ticket = data.ticket_snapshot;
  const events = data.history_snapshot || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      {/* Header branded */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Headset className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Soporte SYSDE {data.client_name ? `· ${data.client_name}` : ""}
              </p>
              <h1 className="text-sm font-bold truncate">{data.title}</h1>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
            <Lock className="h-3 w-3" /> Solo lectura
          </Badge>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 md:py-10 space-y-6">
        {/* Ticket summary card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="p-4 md:p-6 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="font-mono text-xs font-bold">{ticket.ticket_id}</code>
                    {data.client_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {data.client_name}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg md:text-xl font-black leading-tight">{ticket.asunto}</h2>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Badge variant="outline" className={stateColor(ticket.estado)}>
                    {ticket.estado}
                  </Badge>
                  <Badge variant="outline" className={priorityColor(ticket.prioridad)}>
                    {/critica/i.test(ticket.prioridad || "") ? "Crítica" : ticket.prioridad}
                  </Badge>
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border/50">
                <MetaCell icon={Calendar} label="Creado" value={format(new Date(ticket.created_at), "d MMM yyyy", { locale: es })} />
                {ticket.responsable && (
                  <MetaCell icon={User} label="Responsable" value={ticket.responsable} />
                )}
                {ticket.producto && (
                  <MetaCell icon={Tag} label="Producto" value={ticket.producto} />
                )}
                {ticket.fecha_entrega && (
                  <MetaCell icon={Clock} label="Entrega" value={format(new Date(ticket.fecha_entrega), "d MMM yyyy", { locale: es })} />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">Cronología del caso</h3>
                <Badge variant="outline" className="text-[10px]">{events.length}</Badge>
              </div>

              {events.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8 italic">
                  Sin eventos para mostrar.
                </p>
              ) : (
                <TicketHistoryTimeline events={events} maxHeight="none" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Legend / footer info */}
        <div className="text-center text-[11px] text-muted-foreground space-y-1">
          <p>
            Generado el {format(new Date(data.created_at), "d MMMM yyyy 'a las' HH:mm", { locale: es })}
            {" · "}
            Válido hasta el {format(new Date(data.expires_at), "d MMMM yyyy", { locale: es })}
          </p>
          <p className="italic">
            Este enlace es solo lectura y fue generado por el equipo de soporte de SYSDE.
          </p>
        </div>
      </main>

      <footer className="border-t border-border bg-card/40">
        <div className="max-w-4xl mx-auto px-4 py-3 text-center text-[10px] text-muted-foreground">
          SYSDE Internacional · Soporte
        </div>
      </footer>
    </div>
  );
}

// ─── Helpers de renderizado ──────────────────────────────────────────────

function MetaCell({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="text-xs font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}
