import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuoteStatus = "draft" | "sent" | "approved" | "rejected" | "expired" | "cancelled";
export type QuoteItemType = "horas" | "servicios" | "licencias" | "consultoria" | "otros";

export interface Quote {
  id: string;
  quote_number: string;
  ticket_id: string | null;
  client_id: string;
  title: string;
  description: string | null;
  terms: string | null;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: QuoteStatus;
  valid_until: string | null;
  created_by: string;
  sent_at: string | null;
  sent_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  item_type: QuoteItemType;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  position: number;
  created_at: string;
}

export interface QuoteAttachment {
  id: string;
  quote_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface QuoteWithRelations extends Quote {
  items: QuoteItem[];
  attachments: QuoteAttachment[];
}

export interface QuotePendingApproval {
  id: string;
  quote_number: string;
  client_id: string;
  ticket_id: string | null;
  title: string;
  description: string | null;
  total_amount: number;
  currency: string;
  valid_until: string | null;
  sent_at: string | null;
  created_at: string;
  client_name: string | null;
  ticket_code: string | null;
  ticket_subject: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// QUERIES
// ────────────────────────────────────────────────────────────────────────────

export function useQuotes(filters?: { ticketId?: string; clientId?: string; status?: QuoteStatus }) {
  return useQuery({
    queryKey: ["quotes", filters],
    queryFn: async () => {
      let q = (supabase.from("quotes").select("*") as any);
      if (filters?.ticketId) q = q.eq("ticket_id", filters.ticketId);
      if (filters?.clientId) q = q.eq("client_id", filters.clientId);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Quote[];
    },
  });
}

export function useQuote(quoteId: string | null) {
  return useQuery({
    queryKey: ["quote", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      if (!quoteId) return null;
      const [quoteRes, itemsRes, attachmentsRes] = await Promise.all([
        (supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle() as any),
        (supabase.from("quote_items").select("*").eq("quote_id", quoteId).order("position", { ascending: true }) as any),
        (supabase.from("quote_attachments").select("*").eq("quote_id", quoteId).order("created_at", { ascending: false }) as any),
      ]);
      if (quoteRes.error) throw quoteRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (attachmentsRes.error) throw attachmentsRes.error;
      if (!quoteRes.data) return null;
      return {
        ...(quoteRes.data as Quote),
        items: (itemsRes.data || []) as QuoteItem[],
        attachments: (attachmentsRes.data || []) as QuoteAttachment[],
      } as QuoteWithRelations;
    },
  });
}

export function useQuotesPendingApproval(clientId?: string) {
  return useQuery({
    queryKey: ["quotes-pending-approval", clientId],
    queryFn: async () => {
      let q = (supabase.from("quotes_pending_approval").select("*") as any);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q.order("sent_at", { ascending: false });
      if (error) throw error;
      return (data || []) as QuotePendingApproval[];
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MUTATIONS — quote (header)
// ────────────────────────────────────────────────────────────────────────────

export interface CreateQuoteInput {
  ticket_id?: string | null;
  client_id: string;
  title: string;
  description?: string | null;
  terms?: string | null;
  currency?: string;
  tax_rate?: number;
  valid_until?: string | null;
  items?: Array<{
    item_type: QuoteItemType;
    description: string;
    quantity: number;
    unit_price: number;
    position?: number;
  }>;
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateQuoteInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("No autenticado");

      const { items, ...header } = input;
      const { data: quote, error } = await (
        supabase
          .from("quotes")
          .insert([{ ...header, created_by: userId }])
          .select()
          .single() as any
      );
      if (error) throw error;

      if (items && items.length > 0) {
        const itemsToInsert = items.map((it, i) => ({
          quote_id: (quote as any).id,
          item_type: it.item_type,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          position: it.position ?? i,
        }));
        const { error: itemsErr } = await (
          supabase.from("quote_items").insert(itemsToInsert) as any
        );
        if (itemsErr) throw itemsErr;
      }
      return quote as Quote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes-pending-approval"] });
    },
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Quote> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await (
        supabase.from("quotes").update(patch).eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", vars.id] });
      qc.invalidateQueries({ queryKey: ["quotes-pending-approval"] });
    },
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("quotes").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes-pending-approval"] });
    },
  });
}

// Workflow: draft → sent (staff lo envía al cliente)
export function useSendQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("No autenticado");
      const { error } = await (
        supabase
          .from("quotes")
          .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: userId })
          .eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", id] });
      qc.invalidateQueries({ queryKey: ["quotes-pending-approval"] });
    },
  });
}

// Workflow: sent → approved (cliente aprueba)
export function useApproveQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("No autenticado");
      const { error } = await (
        supabase
          .from("quotes")
          .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: userId })
          .eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", id] });
      qc.invalidateQueries({ queryKey: ["quotes-pending-approval"] });
    },
  });
}

// Workflow: sent → rejected (cliente rechaza con motivo)
export function useRejectQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("No autenticado");
      const { error } = await (
        supabase
          .from("quotes")
          .update({
            status: "rejected",
            rejected_at: new Date().toISOString(),
            rejected_by: userId,
            rejection_reason: reason,
          })
          .eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", vars.id] });
      qc.invalidateQueries({ queryKey: ["quotes-pending-approval"] });
    },
  });
}

// Workflow: draft/sent → cancelled (staff la mata)
export function useCancelQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await (
        supabase
          .from("quotes")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason ?? null,
          })
          .eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", vars.id] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MUTATIONS — quote items
// ────────────────────────────────────────────────────────────────────────────

export function useUpsertQuoteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      item: Partial<QuoteItem> & { quote_id: string; description: string; quantity: number; unit_price: number; item_type: QuoteItemType },
    ) => {
      if (item.id) {
        const { error } = await (
          supabase.from("quote_items").update(item).eq("id", item.id) as any
        );
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("quote_items").insert([item]) as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quote", vars.quote_id] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export function useDeleteQuoteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; quoteId: string }) => {
      const { error } = await (supabase.from("quote_items").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quote", vars.quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MUTATIONS — attachments
// ────────────────────────────────────────────────────────────────────────────

export function useUploadQuoteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, file }: { quoteId: string; file: File }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("No autenticado");

      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `quotes/${quoteId}/${ts}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("support-ticket-attachments")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await (
        supabase.from("quote_attachments").insert([{
          quote_id: quoteId,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: userId,
        }]) as any
      );
      if (insertErr) throw insertErr;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quote", vars.quoteId] });
    },
  });
}

export function useDeleteQuoteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string; quoteId: string }) => {
      const { error: storageErr } = await supabase.storage
        .from("support-ticket-attachments")
        .remove([filePath]);
      if (storageErr) console.warn("Could not delete from storage:", storageErr);
      const { error } = await (supabase.from("quote_attachments").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quote", vars.quoteId] });
    },
  });
}

export async function getQuoteAttachmentUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("support-ticket-attachments")
    .createSignedUrl(filePath, 60 * 60); // 1 hora
  if (error) return null;
  return data?.signedUrl ?? null;
}
