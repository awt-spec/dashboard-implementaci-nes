import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Subtasks ───
export type SubtaskPriority = "baja" | "media" | "alta" | "critica";
export type SubtaskCategory = "estrategia" | "revision" | "comercial" | "backlog" | "general";

export interface TicketSubtask {
  id: string;
  ticket_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  due_date: string | null;
  priority: SubtaskPriority;
  completed: boolean;
  sort_order: number;
  category: SubtaskCategory;
  linked_work_item_id: string | null;
  created_at: string;
}

export function useTicketSubtasks(ticketId: string | null) {
  return useQuery({
    queryKey: ["ticket-subtasks", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("support_ticket_subtasks")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as TicketSubtask[];
    },
    enabled: !!ticketId,
  });
}

export function useCreateTicketSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      ticket_id: string;
      title: string;
      sort_order?: number;
      description?: string | null;
      assignee?: string | null;
      due_date?: string | null;
      priority?: SubtaskPriority;
      category?: SubtaskCategory;
      linked_work_item_id?: string | null;
    }) => {
      const { error } = await supabase.from("support_ticket_subtasks").insert([data]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["ticket-subtasks", v.ticket_id] }),
  });
}

export function useToggleTicketSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed, ticket_id }: { id: string; completed: boolean; ticket_id: string }) => {
      const { error } = await supabase.from("support_ticket_subtasks").update({ completed }).eq("id", id);
      if (error) throw error;
      return ticket_id;
    },
    // Optimistic: marca el check al instante; si falla la DB se revierte.
    onMutate: async ({ id, completed, ticket_id }) => {
      await qc.cancelQueries({ queryKey: ["ticket-subtasks", ticket_id] });
      const previous = qc.getQueryData<TicketSubtask[]>(["ticket-subtasks", ticket_id]);
      if (previous) {
        qc.setQueryData(["ticket-subtasks", ticket_id],
          previous.map((s) => s.id === id ? { ...s, completed } : s),
        );
      }
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["ticket-subtasks", vars.ticket_id], ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ["ticket-subtasks", v.ticket_id] }),
  });
}

export function useUpdateTicketSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ticket_id, updates }: {
      id: string;
      ticket_id: string;
      updates: Partial<Pick<TicketSubtask, "title" | "description" | "assignee" | "due_date" | "priority" | "completed" | "sort_order">>;
    }) => {
      const { error } = await supabase.from("support_ticket_subtasks").update(updates).eq("id", id);
      if (error) throw error;
      return ticket_id;
    },
    // Optimistic update: la UI refleja prioridad/asignado/fecha/descr al instante
    // sin esperar el refetch. Si la DB falla, se revierte al valor previo.
    onMutate: async ({ id, ticket_id, updates }) => {
      await qc.cancelQueries({ queryKey: ["ticket-subtasks", ticket_id] });
      const previous = qc.getQueryData<TicketSubtask[]>(["ticket-subtasks", ticket_id]);
      if (previous) {
        qc.setQueryData(["ticket-subtasks", ticket_id],
          previous.map((s) => s.id === id ? { ...s, ...updates } as TicketSubtask : s),
        );
      }
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["ticket-subtasks", vars.ticket_id], ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ["ticket-subtasks", v.ticket_id] }),
  });
}

export function useReorderTicketSubtasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticket_id, order }: { ticket_id: string; order: string[] }) => {
      // Optimistic: actualiza sort_order secuencialmente en Supabase.
      // No hay batch-update nativo; se mandan en paralelo.
      const updates = order.map((id, sort_order) =>
        supabase.from("support_ticket_subtasks").update({ sort_order }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      return ticket_id;
    },
    onMutate: async ({ ticket_id, order }) => {
      await qc.cancelQueries({ queryKey: ["ticket-subtasks", ticket_id] });
      const previous = qc.getQueryData<TicketSubtask[]>(["ticket-subtasks", ticket_id]);
      if (previous) {
        const byId = new Map(previous.map((s) => [s.id, s]));
        const optimistic = order
          .map((id, idx) => {
            const s = byId.get(id);
            return s ? { ...s, sort_order: idx } : null;
          })
          .filter(Boolean) as TicketSubtask[];
        qc.setQueryData(["ticket-subtasks", ticket_id], optimistic);
      }
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["ticket-subtasks", vars.ticket_id], ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ["ticket-subtasks", v.ticket_id] }),
  });
}

export function useDeleteTicketSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ticket_id }: { id: string; ticket_id: string }) => {
      const { error } = await supabase.from("support_ticket_subtasks").delete().eq("id", id);
      if (error) throw error;
      return ticket_id;
    },
    onSuccess: (ticket_id) => qc.invalidateQueries({ queryKey: ["ticket-subtasks", ticket_id] }),
  });
}

// ─── Tags ───
export interface TicketTag {
  id: string;
  ticket_id: string;
  tag: string;
  color: string;
  created_at: string;
}

export function useTicketTags(ticketId: string | null) {
  return useQuery({
    queryKey: ["ticket-tags", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("support_ticket_tags")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as TicketTag[];
    },
    enabled: !!ticketId,
  });
}

export function useAddTicketTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { ticket_id: string; tag: string; color?: string }) => {
      const { error } = await supabase.from("support_ticket_tags").insert([{ ...data, color: data.color || "#6366f1" }]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["ticket-tags", v.ticket_id] }),
  });
}

export function useRemoveTicketTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ticket_id }: { id: string; ticket_id: string }) => {
      const { error } = await supabase.from("support_ticket_tags").delete().eq("id", id);
      if (error) throw error;
      return ticket_id;
    },
    onSuccess: (ticket_id) => qc.invalidateQueries({ queryKey: ["ticket-tags", ticket_id] }),
  });
}

// ─── Attachments ───
export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
}

export function useTicketAttachments(ticketId: string | null) {
  return useQuery({
    queryKey: ["ticket-attachments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("support_ticket_attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TicketAttachment[];
    },
    enabled: !!ticketId,
  });
}

export function useUploadTicketAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticket_id, file, uploaded_by }: { ticket_id: string; file: File; uploaded_by: string }) => {
      const path = `${ticket_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("support-ticket-attachments").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("support-ticket-attachments").getPublicUrl(path);
      const { error } = await supabase.from("support_ticket_attachments").insert([{
        ticket_id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        uploaded_by,
      }]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["ticket-attachments", v.ticket_id] }),
  });
}

export function useDeleteTicketAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ticket_id }: { id: string; ticket_id: string }) => {
      const { error } = await supabase.from("support_ticket_attachments").delete().eq("id", id);
      if (error) throw error;
      return ticket_id;
    },
    onSuccess: (ticket_id) => qc.invalidateQueries({ queryKey: ["ticket-attachments", ticket_id] }),
  });
}

// ─── Notes ───
export interface TicketNote {
  id: string;
  ticket_id: string;
  content: string;
  author_name: string;
  visibility: string;
  created_at: string;
}

export function useTicketNotes(ticketId: string | null) {
  return useQuery({
    queryKey: ["ticket-notes", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("support_ticket_notes")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TicketNote[];
    },
    enabled: !!ticketId,
  });
}

export function useCreateTicketNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { ticket_id: string; content: string; author_name: string; visibility?: string }) => {
      const { error } = await supabase.from("support_ticket_notes").insert([{ ...data, visibility: data.visibility || "interna" }]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["ticket-notes", v.ticket_id] }),
  });
}

export function useDeleteTicketNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ticket_id }: { id: string; ticket_id: string }) => {
      const { error } = await supabase.from("support_ticket_notes").delete().eq("id", id);
      if (error) throw error;
      return ticket_id;
    },
    onSuccess: (ticket_id) => qc.invalidateQueries({ queryKey: ["ticket-notes", ticket_id] }),
  });
}

// ─── Dependencies ───
export interface TicketDependency {
  id: string;
  ticket_id: string;
  depends_on_ticket_id: string;
  dependency_type: string;
  created_at: string;
  depends_on_ticket?: { id: string; ticket_id: string; asunto: string; estado: string };
}

export function useTicketDependencies(ticketId: string | null) {
  return useQuery({
    queryKey: ["ticket-dependencies", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("support_ticket_dependencies")
        .select("*")
        .eq("ticket_id", ticketId);
      if (error) throw error;
      const deps = (data || []) as TicketDependency[];
      if (deps.length === 0) return deps;
      const depIds = deps.map(d => d.depends_on_ticket_id);
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id, ticket_id, asunto, estado")
        .in("id", depIds);
      const ticketMap = new Map((tickets || []).map(t => [t.id, t]));
      return deps.map(d => ({ ...d, depends_on_ticket: ticketMap.get(d.depends_on_ticket_id) || undefined }));
    },
    enabled: !!ticketId,
  });
}

export function useAddTicketDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { ticket_id: string; depends_on_ticket_id: string; dependency_type: string }) => {
      const { error } = await supabase.from("support_ticket_dependencies").insert([data]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["ticket-dependencies", v.ticket_id] }),
  });
}

export function useRemoveTicketDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ticket_id }: { id: string; ticket_id: string }) => {
      const { error } = await supabase.from("support_ticket_dependencies").delete().eq("id", id);
      if (error) throw error;
      return ticket_id;
    },
    onSuccess: (ticket_id) => qc.invalidateQueries({ queryKey: ["ticket-dependencies", ticket_id] }),
  });
}

// ─── Available tickets for dependency picker ───
export function useAvailableTickets(clientId: string, excludeTicketId: string | null) {
  return useQuery({
    queryKey: ["available-tickets", clientId, excludeTicketId],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select("id, ticket_id, asunto, estado")
        .eq("client_id", clientId)
        .order("ticket_id");
      if (excludeTicketId) {
        query = query.neq("id", excludeTicketId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as { id: string; ticket_id: string; asunto: string; estado: string }[];
    },
    enabled: !!clientId,
  });
}
