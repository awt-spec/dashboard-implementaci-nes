import { supabase } from "@/integrations/supabase/client";
import type { ClientTask } from "@/data/projectData";

/**
 * Ensures a static task exists in the DB. If not found, creates it.
 * Returns the DB uuid of the task.
 */
export async function ensureTaskInDb(task: ClientTask, clientId: string): Promise<string | null> {
  // Try to find existing
  const { data } = await supabase
    .from("tasks")
    .select("id")
    .eq("client_id", clientId)
    .eq("original_id", task.id)
    .maybeSingle();

  if (data) return data.id;

  // Auto-create from static data
  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      client_id: clientId,
      original_id: task.id,
      title: task.title,
      status: task.status,
      owner: task.owner,
      due_date: task.dueDate,
      priority: task.priority,
      description: task.description || null,
      assignees: task.assignees as any,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating task in DB:", error);
    return null;
  }

  return created.id;
}
