import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DevOpsConnection {
  id: string;
  client_id: string;
  organization: string;
  project: string;
  team: string | null;
  default_work_item_type: string;
  state_mapping: Record<string, string>;
  priority_mapping: Record<string, string>;
  auto_sync: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  is_active: boolean;
}

export interface DevOpsSyncLog {
  id: string;
  client_id: string;
  direction: string;
  status: string;
  items_pulled: number;
  items_pushed: number;
  items_failed: number;
  duration_ms: number;
  error_message: string | null;
  triggered_by: string | null;
  created_at: string;
}

export interface DevOpsSyncMapping {
  id: string;
  client_id: string;
  entity_type: string;
  local_id: string;
  devops_id: string;
  devops_url: string | null;
  last_synced_at: string;
  last_direction: string | null;
}

export function useDevOpsConnection(clientId?: string) {
  return useQuery({
    queryKey: ["devops-connection", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devops_connections")
        .select("*")
        .eq("client_id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data as DevOpsConnection | null;
    },
  });
}

export function useDevOpsSyncLogs(clientId?: string) {
  return useQuery({
    queryKey: ["devops-sync-logs", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devops_sync_logs")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as DevOpsSyncLog[];
    },
  });
}

export function useDevOpsMappings(clientId?: string) {
  return useQuery({
    queryKey: ["devops-mappings", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devops_sync_mappings")
        .select("*")
        .eq("client_id", clientId!)
        .order("last_synced_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DevOpsSyncMapping[];
    },
  });
}

export function useSaveDevOpsConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conn: Partial<DevOpsConnection> & { client_id: string }) => {
      const { data: existing } = await supabase
        .from("devops_connections")
        .select("id")
        .eq("client_id", conn.client_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("devops_connections")
          .update(conn as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("devops_connections")
          .insert(conn as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["devops-connection", vars.client_id] });
    },
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, direction }: { clientId: string; direction: string }) => {
      const { data, error } = await supabase.functions.invoke("sync-devops", {
        body: { action: "sync", client_id: clientId, direction },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["devops-sync-logs", vars.clientId] });
      qc.invalidateQueries({ queryKey: ["devops-mappings", vars.clientId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
    },
  });
}

export function useTestDevOpsConnection() {
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-devops", {
        body: { action: "test", client_id: clientId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
}
