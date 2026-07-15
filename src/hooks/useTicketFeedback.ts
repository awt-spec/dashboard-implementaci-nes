import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// CSAT / feedback por ticket (rol CSR y demás soporte). Tabla nueva
// support_ticket_feedback: rating 1-5, sentiment, comentario.

export type Sentiment = "positivo" | "neutral" | "negativo";

export interface TicketFeedback {
  id: string;
  ticket_id: string;
  client_id: string | null;
  rating: number | null;
  sentiment: Sentiment | null;
  comment: string | null;
  captured_by: string | null;
  created_at: string;
}

export function useTicketFeedback(ticketId?: string | null) {
  return useQuery({
    queryKey: ["ticket-feedback", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_feedback")
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TicketFeedback[];
    },
  });
}

export function useCaptureTicketFeedback(ticketId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rating: number; sentiment: Sentiment; comment?: string; clientId?: string | null }) => {
      if (!ticketId) throw new Error("ticketId requerido");
      const { error } = await supabase
        .from("support_ticket_feedback")
        .insert({
          ticket_id: ticketId,
          client_id: args.clientId ?? null,
          rating: args.rating,
          sentiment: args.sentiment,
          comment: args.comment?.trim() || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-feedback", ticketId] }),
  });
}
