import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Client, Phase, Deliverable, ClientTask, Comment, Risk, ActionItem, MeetingMinute, EmailNotification, DeliverableDetail, TaskAssignee } from "@/data/projectData";

// Types for database rows
interface DbClient {
  id: string;
  name: string;
  country: string;
  industry: string;
  contact_name: string;
  contact_email: string;
  contract_start: string;
  contract_end: string;
  status: string;
  progress: number;
  team_assigned: string[];
}

interface DbPhase {
  id: string;
  client_id: string;
  name: string;
  status: string;
  progress: number;
  start_date: string;
  end_date: string;
}

interface DbDeliverable {
  id: string;
  client_id: string;
  original_id: string;
  name: string;
  type: string;
  status: string;
  due_date: string;
  delivered_date: string | null;
  approved_by: string | null;
  version: string;
  detail: DeliverableDetail | null;
}

interface DbTask {
  id: string;
  client_id: string;
  original_id: number;
  title: string;
  status: string;
  owner: string;
  due_date: string;
  priority: string;
  assignees: TaskAssignee[];
  description: string | null;
  visibility: string;
}

interface DbActionItem {
  id: string;
  client_id: string;
  original_id: string;
  title: string;
  assignee: string;
  due_date: string;
  status: string;
  source: string;
  priority: string;
}

interface DbMeetingMinute {
  id: string;
  client_id: string;
  original_id: string;
  title: string;
  date: string;
  attendees: string[];
  summary: string;
  agreements: string[];
  action_items: string[];
  next_meeting: string | null;
  visible_to_client: boolean;
}

interface DbEmailNotification {
  id: string;
  client_id: string;
  original_id: string;
  subject: string;
  to: string[];
  from: string;
  date: string;
  status: string;
  type: string;
  preview: string;
}

interface DbComment {
  id: string;
  client_id: string;
  original_id: string;
  user: string;
  avatar: string;
  message: string;
  date: string;
  type: string;
}

interface DbRisk {
  id: string;
  client_id: string;
  original_id: string;
  description: string;
  impact: string;
  status: string;
  mitigation: string | null;
  category: string;
}

// Fetch all clients with related data
async function fetchClients(): Promise<Client[]> {
  const [
    { data: clients, error: clientsError },
    { data: phases },
    { data: deliverables },
    { data: tasks },
    { data: actionItems },
    { data: meetingMinutes },
    { data: emailNotifications },
    { data: comments },
    { data: risks },
  ] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("phases").select("*"),
    supabase.from("deliverables").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("action_items").select("*"),
    supabase.from("meeting_minutes").select("*"),
    supabase.from("email_notifications").select("*"),
    supabase.from("comments").select("*"),
    supabase.from("risks").select("*"),
  ]);

  if (clientsError) throw clientsError;

  // If DB has no clients, return empty to trigger static fallback via ?? operator
  if (!clients || clients.length === 0) return [] as Client[];

  const clientsData = clients as unknown as DbClient[];
  const phasesData = (phases || []) as unknown as DbPhase[];
  const deliverablesData = (deliverables || []) as unknown as DbDeliverable[];
  const tasksData = (tasks || []) as unknown as DbTask[];
  const actionItemsData = (actionItems || []) as unknown as DbActionItem[];
  const meetingMinutesData = (meetingMinutes || []) as unknown as DbMeetingMinute[];
  const emailNotificationsData = (emailNotifications || []) as unknown as DbEmailNotification[];
  const commentsData = (comments || []) as unknown as DbComment[];
  const risksData = (risks || []) as unknown as DbRisk[];

  return clientsData.map((c): Client => {
    return {
      id: c.id,
      name: c.name,
      country: c.country,
      industry: c.industry,
      contactName: c.contact_name,
      contactEmail: c.contact_email,
      contractStart: c.contract_start,
      contractEnd: c.contract_end,
      status: c.status as Client["status"],
      progress: c.progress,
      teamAssigned: c.team_assigned,
      phases: phasesData
        .filter(p => p.client_id === c.id)
        .map((p): Phase => ({
          name: p.name,
          status: p.status as Phase["status"],
          progress: p.progress,
          startDate: p.start_date,
          endDate: p.end_date,
        })),
      deliverables: deliverablesData
        .filter(d => d.client_id === c.id)
        .map((d): Deliverable => ({
          id: d.original_id,
          name: d.name,
          type: d.type as Deliverable["type"],
          status: d.status as Deliverable["status"],
          dueDate: d.due_date,
          deliveredDate: d.delivered_date || undefined,
          approvedBy: d.approved_by || undefined,
          version: d.version,
          detail: d.detail || undefined,
          responsibleParty: (d as any).responsible_party || undefined,
          responsibleTeam: (d as any).responsible_team || undefined,
          linkedTaskId: (d as any).linked_task_id || undefined,
        })),
      tasks: tasksData
        .filter(t => t.client_id === c.id)
        .map((t): ClientTask => ({
          id: t.original_id,
          title: t.title,
          status: t.status as ClientTask["status"],
          owner: t.owner,
          dueDate: t.due_date,
          priority: t.priority as ClientTask["priority"],
          assignees: t.assignees,
          description: t.description || undefined,
          visibility: t.visibility || "externa",
        })),
      actionItems: actionItemsData
        .filter(a => a.client_id === c.id)
        .map((a): ActionItem => ({
          id: a.original_id,
          title: a.title,
          assignee: a.assignee,
          dueDate: a.due_date,
          status: a.status as ActionItem["status"],
          source: a.source,
          priority: a.priority as ActionItem["priority"],
          responsibleParty: (a as any).responsible_party || undefined,
          responsibleTeam: (a as any).responsible_team || undefined,
          linkedTaskId: (a as any).linked_task_id || undefined,
        })),
      meetingMinutes: meetingMinutesData
        .filter(m => m.client_id === c.id)
        .map((m): MeetingMinute => ({
          id: m.original_id,
          title: m.title,
          date: m.date,
          attendees: m.attendees,
          summary: m.summary,
          agreements: m.agreements,
          actionItems: m.action_items,
          nextMeeting: m.next_meeting || undefined,
          presentationSnapshot: (m as any).presentation_snapshot || undefined,
          visibleToClient: m.visible_to_client,
        })),
      emailNotifications: emailNotificationsData
        .filter(e => e.client_id === c.id)
        .map((e): EmailNotification => ({
          id: e.original_id,
          subject: e.subject,
          to: e.to,
          from: e.from,
          date: e.date,
          status: e.status as EmailNotification["status"],
          type: e.type as EmailNotification["type"],
          preview: e.preview,
        })),
      comments: commentsData
        .filter(cm => cm.client_id === c.id)
        .map((cm): Comment => ({
          id: cm.original_id,
          user: cm.user,
          avatar: cm.avatar,
          message: cm.message,
          date: cm.date,
          type: cm.type as Comment["type"],
        })),
      risks: risksData
        .filter(r => r.client_id === c.id)
        .map((r): Risk => ({
          id: r.original_id,
          description: r.description,
          impact: r.impact as Risk["impact"],
          status: r.status as Risk["status"],
          mitigation: r.mitigation || undefined,
          category: (r.category as Risk["category"]) || "riesgo",
        })),
    };
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });
}

export function useClient(clientId: string | undefined) {
  const { data: clients } = useClients();
  return clients?.find(c => c.id === clientId);
}

// Update client
export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; updates: Partial<DbClient> }) => {
      const { error } = await supabase.from("clients").update(data.updates).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// Create client
export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<DbClient, "id"> & { id: string }) => {
      const { error } = await supabase.from("clients").insert(data);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// Delete client
export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// Create task
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      client_id: string; title: string; description: string | null;
      priority: string; status: string; owner: string; due_date: string;
      original_id: number; assignees: Record<string, string>[];
      visibility?: string;
    }) => {
      const { error } = await supabase.from("tasks").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// Delete task
export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// Update task
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("tasks").update(data.updates).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// --- CRUD for Deliverables ---
export function useCreateDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { client_id: string; original_id: string; name: string; type: string; status: string; due_date: string; version?: string; delivered_date?: string; approved_by?: string; detail?: any; responsible_party?: string; responsible_team?: string; linked_task_id?: number }) => {
      const { error } = await supabase.from("deliverables").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useUpdateDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("deliverables").update(data.updates).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useDeleteDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deliverables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// --- CRUD for Risks ---
export function useCreateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { client_id: string; original_id: string; description: string; impact: string; status: string; mitigation?: string }) => {
      const { error } = await supabase.from("risks").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useUpdateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("risks").update(data.updates).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useDeleteRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("risks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// --- CRUD for Meeting Minutes ---
export function useCreateMeetingMinute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { client_id: string; original_id: string; title: string; date: string; attendees: string[]; summary: string; agreements: string[]; action_items: string[]; next_meeting?: string | null; presentation_snapshot?: any }) => {
      const { error } = await supabase.from("meeting_minutes").insert([{
        client_id: data.client_id,
        original_id: data.original_id,
        title: data.title,
        date: data.date,
        attendees: data.attendees,
        summary: data.summary,
        agreements: data.agreements,
        action_items: data.action_items,
        next_meeting: data.next_meeting ?? null,
        presentation_snapshot: data.presentation_snapshot ?? null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useDeleteMeetingMinute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meeting_minutes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// --- CRUD for Comments ---
export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { client_id: string; original_id: string; user: string; avatar: string; message: string; date: string; type: string }) => {
      const { error } = await supabase.from("comments").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

// --- CRUD for Action Items ---
export function useCreateActionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { client_id: string; original_id: string; title: string; assignee: string; due_date: string; status: string; source: string; priority: string; responsible_party?: string; responsible_team?: string; linked_task_id?: number }) => {
      const { error } = await supabase.from("action_items").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useUpdateActionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("action_items").update(data.updates).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useDeleteActionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); },
  });
}
