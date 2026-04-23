import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TicketHistoryKind = "create" | "update" | "view" | "decrypt" | "delete" | "note" | "status" | "assign";

export interface TicketHistoryEvent {
  id: string;
  ticket_id: string;
  kind: TicketHistoryKind;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  summary: string;      // línea de headline ("Juan cambió el estado a EN ATENCIÓN")
  detail?: string;      // detalle opcional (contenido de nota, etc.)
  metadata?: any;
}

interface RawAuditRow {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  metadata: any;
  created_at: string;
}

interface RawNoteRow {
  id: string;
  ticket_id: string;
  author_name: string | null;
  content: string;
  visibility: string | null;
  created_at: string;
}

/**
 * Retorna el historial combinado de un ticket:
 *   - Eventos del ticket_access_log (create / update / decrypt / view / delete)
 *   - Notas del support_ticket_notes
 *   - Eventos sintéticos derivados del mismo ticket (fecha_registro, fecha_entrega)
 *
 * Ordenado cronológicamente del más reciente al más viejo.
 * Tolerante: si alguna tabla no existe (ej: pre-migración), la omite.
 */
export function useTicketHistory(ticketId: string | null | undefined) {
  return useQuery({
    queryKey: ["ticket-history", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      if (!ticketId) return [] as TicketHistoryEvent[];

      // Audit log (puede no existir si migración 20260422160000 no se aplicó)
      const auditPromise = (supabase
        .from("ticket_access_log" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(200) as any).then((r: any) => ({ data: r.data || [], error: r.error }));

      // Notas del ticket
      const notesPromise = (supabase
        .from("support_ticket_notes" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(200) as any).then((r: any) => ({ data: r.data || [], error: r.error }));

      const [audit, notes] = await Promise.all([auditPromise, notesPromise]);

      // Obtener nombres de usuario para el audit log
      const userIds = Array.from(new Set(
        (audit.data as RawAuditRow[])
          .map(a => a.user_id)
          .filter((x): x is string => !!x)
      ));
      const userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase
          .from("profiles")
          .select("user_id, full_name") as any)
          .in("user_id", userIds);
        (profiles || []).forEach((p: any) => userMap.set(p.user_id, p.full_name || "Sistema"));
      }

      const events: TicketHistoryEvent[] = [];

      // 1. Audit events
      for (const a of audit.data as RawAuditRow[]) {
        const who = (a.user_id && userMap.get(a.user_id)) || "Sistema";
        const meta = a.metadata || {};
        let summary = "";
        let kind: TicketHistoryKind = a.action as any;

        switch (a.action) {
          case "create":
            summary = `${who} creó el caso`;
            if (meta.prioridad) summary += ` (prioridad ${meta.prioridad})`;
            if (meta.fuente === "cliente") summary += " · desde portal cliente";
            break;
          case "update":
            if (meta.kind === "critical_notification") {
              kind = "update";
              const ch = meta.channels || {};
              const sent: string[] = [];
              if (ch.notification) sent.push("notif");
              if (ch.slack) sent.push("Slack");
              if (ch.email) sent.push("email");
              summary = `Alertas de caso crítico enviadas: ${sent.join(", ") || "ninguna"}`;
            } else if (meta.from && meta.to) {
              const changes: string[] = [];
              for (const key of Object.keys(meta.to)) {
                if (meta.from[key] !== meta.to[key]) {
                  const label = key === "estado" ? "estado" :
                                key === "prioridad" ? "prioridad" :
                                key === "responsable" ? "responsable" : key;
                  changes.push(`${label}: ${meta.from[key] || "—"} → ${meta.to[key] || "—"}`);
                }
              }
              summary = `${who} actualizó ${changes.join(", ")}`;
              kind = meta.from.estado !== meta.to.estado ? "status"
                   : meta.from.responsable !== meta.to.responsable ? "assign"
                   : "update";
            } else {
              summary = `${who} actualizó el caso`;
            }
            break;
          case "decrypt":
            summary = `${who} descifró el contenido confidencial`;
            break;
          case "view":
            summary = `${who} visualizó el caso`;
            break;
          case "delete":
            summary = `${who} eliminó el caso`;
            break;
          default:
            summary = `${who} · ${a.action}`;
        }

        events.push({
          id: `audit-${a.id}`,
          ticket_id: a.ticket_id,
          kind,
          created_at: a.created_at,
          user_id: a.user_id,
          user_name: who,
          summary,
          metadata: meta,
        });
      }

      // 2. Notes
      for (const n of notes.data as RawNoteRow[]) {
        const vis = n.visibility === "externa" ? "externa" : "interna";
        events.push({
          id: `note-${n.id}`,
          ticket_id: n.ticket_id,
          kind: "note",
          created_at: n.created_at,
          user_id: null,
          user_name: n.author_name || "Anónimo",
          summary: `${n.author_name || "Anónimo"} agregó una nota ${vis}`,
          detail: n.content,
          metadata: { visibility: vis },
        });
      }

      return events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });
}
