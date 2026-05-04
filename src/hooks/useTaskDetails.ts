import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Subtasks ───
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

export function useSubtasks(taskId: string | null) {
  return useQuery({
    queryKey: ["task-subtasks", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_subtasks")
        .select("*")
        .eq("task_id", taskId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Subtask[];
    },
    enabled: !!taskId,
  });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { task_id: string; title: string; sort_order?: number }) => {
      const { error } = await supabase.from("task_subtasks").insert([data]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["task-subtasks", v.task_id] }),
  });
}

export function useToggleSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed, task_id }: { id: string; completed: boolean; task_id: string }) => {
      const { error } = await supabase.from("task_subtasks").update({ completed }).eq("id", id);
      if (error) throw error;
      return task_id;
    },
    onSuccess: (task_id) => qc.invalidateQueries({ queryKey: ["task-subtasks", task_id] }),
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, task_id }: { id: string; task_id: string }) => {
      const { error } = await supabase.from("task_subtasks").delete().eq("id", id);
      if (error) throw error;
      return task_id;
    },
    onSuccess: (task_id) => qc.invalidateQueries({ queryKey: ["task-subtasks", task_id] }),
  });
}

// ─── Dependencies ───
export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  created_at: string;
  depends_on_task?: { id: string; title: string; original_id: number; status: string };
}

export function useTaskDependencies(taskId: string | null) {
  return useQuery({
    queryKey: ["task-dependencies", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .eq("task_id", taskId);
      if (error) throw error;
      // Fetch the dependent task info
      const deps = (data || []) as TaskDependency[];
      if (deps.length === 0) return deps;
      const depIds = deps.map(d => d.depends_on_task_id);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, original_id, status")
        .in("id", depIds);
      const taskMap = new Map((tasks || []).map(t => [t.id, t]));
      return deps.map(d => ({ ...d, depends_on_task: taskMap.get(d.depends_on_task_id) || undefined }));
    },
    enabled: !!taskId,
  });
}

export function useAddDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { task_id: string; depends_on_task_id: string; dependency_type: string }) => {
      const { error } = await supabase.from("task_dependencies").insert([data]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["task-dependencies", v.task_id] }),
  });
}

export function useRemoveDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, task_id }: { id: string; task_id: string }) => {
      const { error } = await supabase.from("task_dependencies").delete().eq("id", id);
      if (error) throw error;
      return task_id;
    },
    onSuccess: (task_id) => qc.invalidateQueries({ queryKey: ["task-dependencies", task_id] }),
  });
}

// ─── Tags ───
export interface TaskTag {
  id: string;
  task_id: string;
  tag: string;
  color: string;
  created_at: string;
}

export function useTaskTags(taskId: string | null) {
  return useQuery({
    queryKey: ["task-tags", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_tags")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as TaskTag[];
    },
    enabled: !!taskId,
  });
}

export function useAddTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { task_id: string; tag: string; color?: string }) => {
      const { error } = await supabase.from("task_tags").insert([{ ...data, color: data.color || "#6366f1" }]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["task-tags", v.task_id] }),
  });
}

export function useRemoveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, task_id }: { id: string; task_id: string }) => {
      const { error } = await supabase.from("task_tags").delete().eq("id", id);
      if (error) throw error;
      return task_id;
    },
    onSuccess: (task_id) => qc.invalidateQueries({ queryKey: ["task-tags", task_id] }),
  });
}

// ─── Attachments ───
export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
}

export function useTaskAttachments(taskId: string | null) {
  return useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TaskAttachment[];
    },
    enabled: !!taskId,
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task_id, file, uploaded_by }: { task_id: string; file: File; uploaded_by: string }) => {
      const path = `${task_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("task-attachments").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(path);
      const { error } = await supabase.from("task_attachments").insert([{
        task_id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        uploaded_by,
      }]);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["task-attachments", v.task_id] }),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, task_id }: { id: string; task_id: string }) => {
      const { error } = await supabase.from("task_attachments").delete().eq("id", id);
      if (error) throw error;
      return task_id;
    },
    onSuccess: (task_id) => qc.invalidateQueries({ queryKey: ["task-attachments", task_id] }),
  });
}

// ─── Available tasks for dependency picker ───
export function useAvailableTasks(clientId: string, excludeTaskId: string | null) {
  return useQuery({
    queryKey: ["available-tasks", clientId, excludeTaskId],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("id, title, original_id, status")
        .eq("client_id", clientId)
        .order("original_id");
      if (excludeTaskId) {
        query = query.neq("id", excludeTaskId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as { id: string; title: string; original_id: number; status: string }[];
    },
    enabled: !!clientId,
  });
}
