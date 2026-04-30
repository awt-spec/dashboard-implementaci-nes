import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReopenType } from "./useTicketReopens";

/**
 * Mutación combinada para REINCIDENCIAR un ticket.
 *
 * Patrón:
 *   1. RPC `set_reopen_metadata({ reason, reopen_type })` → guarda en
 *      session config `app.reopen_metadata` para que el trigger lo lea.
 *   2. UPDATE ticket: estado (+ responsable opcional). El trigger BEFORE
 *      UPDATE detecta la transición ENTREGADA/APROBADA → activo, lee la
 *      metadata, incrementa reopen_count, inserta fila en
 *      support_ticket_reopens y limpia la session config.
 *
 * Si el caller no llama a esta mutación y hace un UPDATE directo, el
 * trigger usa defaults ("(sin motivo registrado)" + "cliente_rechazo")
 * y registra la reincidencia igualmente — no perdemos histórico.
 */
export function useReopenTicket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      newState,
      reason,
      reopenType,
      newResponsible,
    }: {
      ticketId: string;
      newState: string;
      reason: string;
      reopenType: ReopenType;
      newResponsible?: string | null;
    }) => {
      if (!reason || reason.trim().length < 10) {
        throw new Error("El motivo de la reincidencia es obligatorio (mín 10 chars).");
      }
      if (reopenType === "historico") {
        throw new Error("El tipo 'historico' es solo para backfill.");
      }

      // 1) Pasar metadata al trigger vía session config
      const { error: rpcErr } = await (supabase.rpc as any)("set_reopen_metadata", {
        p_metadata: {
          reason: reason.trim(),
          reopen_type: reopenType,
        },
      });
      if (rpcErr) throw rpcErr;

      // 2) UPDATE del ticket — el trigger se dispara y crea la fila
      const updates: Record<string, unknown> = { estado: newState };
      if (newResponsible !== undefined) {
        updates.responsable = newResponsible;
      }
      const { data, error } = await supabase
        .from("support_tickets")
        .update(updates as any)
        .eq("id", ticketId)
        .select()
        .maybeSingle();
      if (error) throw error;

      // 3) Si cruzó el umbral de 3 reincidencias, dispara notificación
      //    a gerente_soporte + pm via edge function. Best-effort: si falla
      //    no rompe el flujo (el ticket ya quedó actualizado).
      const newReopenCount = (data as any)?.reopen_count ?? 0;
      if (newReopenCount >= 3) {
        try {
          await (supabase.functions.invoke as any)("notify-recurring-reopens", {
            body: { ticket_id: ticketId, threshold: 3 },
          });
        } catch (notifyErr) {
          // Log silencioso — la reincidencia se registró igual
          console.warn("[useReopenTicket] notify-recurring-reopens falló:", notifyErr);
        }
      }

      return data;
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
      qc.invalidateQueries({ queryKey: ["support-inbox"] });
      qc.invalidateQueries({ queryKey: ["ticket-history"] });
      qc.invalidateQueries({ queryKey: ["ticket-reopens", vars?.ticketId] });
      qc.invalidateQueries({ queryKey: ["reopens-summary"] });
      qc.invalidateQueries({ queryKey: ["top-reincidentes"] });
      qc.invalidateQueries({ queryKey: ["reopen-rate-90d"] });
    },
  });
}
