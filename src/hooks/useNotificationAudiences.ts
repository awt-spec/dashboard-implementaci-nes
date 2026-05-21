import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AudienceChannel = "email" | "in_app" | "both";

export interface NotificationAudience {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  channel: AudienceChannel;
  event_filters: Record<string, boolean>;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudienceMember {
  audience_id: string;
  user_id: string;
  added_at: string;
  added_by: string | null;
}

export interface AudienceRecipient {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

export interface AudienceWithMembers extends NotificationAudience {
  members: AudienceMember[];
}

// ────────────────────────────────────────────────────────────────────────────
// QUERIES
// ────────────────────────────────────────────────────────────────────────────

export function useClientAudiences(clientId: string | undefined) {
  return useQuery({
    queryKey: ["notification-audiences", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await (
        supabase
          .from("notification_audiences" as any)
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }) as any
      );
      if (error) throw error;
      return (data || []) as NotificationAudience[];
    },
  });
}

export function useAudienceMembers(audienceId: string | undefined) {
  return useQuery({
    queryKey: ["audience-members", audienceId],
    enabled: !!audienceId,
    queryFn: async () => {
      if (!audienceId) return [];
      const { data, error } = await (
        supabase
          .from("notification_audience_members" as any)
          .select("*")
          .eq("audience_id", audienceId) as any
      );
      if (error) throw error;
      return (data || []) as AudienceMember[];
    },
  });
}

/** RPC: resuelve destinatarios activos (con email + nombre) — usable por un edge fn que dispare notif. */
export function useAudienceRecipients(audienceId: string | undefined) {
  return useQuery({
    queryKey: ["audience-recipients", audienceId],
    enabled: !!audienceId,
    queryFn: async () => {
      if (!audienceId) return [];
      const { data, error } = await supabase.rpc(
        "get_audience_recipients" as any,
        { _audience_id: audienceId } as any,
      );
      if (error) throw error;
      return (data ?? []) as AudienceRecipient[];
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MUTATIONS — audience
// ────────────────────────────────────────────────────────────────────────────

export interface UpsertAudienceInput {
  id?: string;
  client_id: string;
  name: string;
  description?: string | null;
  channel?: AudienceChannel;
  event_filters?: Record<string, boolean>;
  is_active?: boolean;
}

export function useUpsertAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertAudienceInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const payload: any = {
        client_id:     input.client_id,
        name:          input.name.trim(),
        description:   input.description?.trim() ?? null,
        channel:       input.channel ?? "both",
        event_filters: input.event_filters ?? {},
        is_active:     input.is_active ?? true,
        created_by:    userId,
      };
      if (input.id) {
        const { error } = await (
          supabase.from("notification_audiences" as any).update(payload).eq("id", input.id) as any
        );
        if (error) throw error;
        return input.id;
      } else {
        const { data, error } = await (
          supabase.from("notification_audiences" as any).insert([payload]).select("id").single() as any
        );
        if (error) throw error;
        return (data as any).id as string;
      }
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["notification-audiences", vars.client_id] });
    },
  });
}

export function useDeleteAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; clientId: string }) => {
      const { error } = await (
        supabase.from("notification_audiences" as any).delete().eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["notification-audiences", vars.clientId] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MUTATIONS — members
// ────────────────────────────────────────────────────────────────────────────

/** Lista usuarios cliente activos para un client_id. Usado en multi-select de audiencias. */
export interface ClientUserOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
  permission_level: string;
}

export function useClientUsersForAudience(clientId: string | undefined) {
  return useQuery({
    queryKey: ["audience-client-users", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await (
        supabase
          .from("cliente_company_assignments" as any)
          .select("user_id, permission_level, profiles:user_id(full_name,email)")
          .eq("client_id", clientId) as any
      );
      if (error) {
        // Fallback: el join puede fallar por RLS; intentar lookup separado
        const { data: assigns, error: e2 } = await (
          supabase
            .from("cliente_company_assignments" as any)
            .select("user_id, permission_level")
            .eq("client_id", clientId) as any
        );
        if (e2) throw e2;
        const ids = ((assigns ?? []) as Array<{ user_id: string; permission_level: string }>).map(r => r.user_id);
        if (ids.length === 0) return [];
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", ids);
        const profById = new Map<string, { full_name: string | null; email: string | null }>();
        for (const p of (profs ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>) {
          profById.set(p.user_id, { full_name: p.full_name, email: p.email });
        }
        return ((assigns ?? []) as Array<{ user_id: string; permission_level: string }>).map(a => ({
          user_id: a.user_id,
          permission_level: a.permission_level,
          full_name: profById.get(a.user_id)?.full_name ?? null,
          email: profById.get(a.user_id)?.email ?? null,
        })) as ClientUserOption[];
      }
      return ((data ?? []) as any[]).map(r => ({
        user_id: r.user_id,
        permission_level: r.permission_level,
        full_name: r.profiles?.full_name ?? null,
        email: r.profiles?.email ?? null,
      })) as ClientUserOption[];
    },
  });
}

export function useSetAudienceMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ audienceId, userIds }: { audienceId: string; userIds: string[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      const addedBy = userData?.user?.id ?? null;

      // Diff con miembros actuales
      const { data: current, error: readErr } = await (
        supabase.from("notification_audience_members" as any).select("user_id").eq("audience_id", audienceId) as any
      );
      if (readErr) throw readErr;
      const currentIds = new Set(((current ?? []) as Array<{ user_id: string }>).map(r => r.user_id));
      const incomingIds = new Set(userIds);

      const toAdd = userIds.filter(id => !currentIds.has(id));
      const toRemove = Array.from(currentIds).filter(id => !incomingIds.has(id));

      if (toRemove.length > 0) {
        const { error } = await (
          supabase
            .from("notification_audience_members" as any)
            .delete()
            .eq("audience_id", audienceId)
            .in("user_id", toRemove) as any
        );
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map(uid => ({ audience_id: audienceId, user_id: uid, added_by: addedBy }));
        const { error } = await (
          supabase.from("notification_audience_members" as any).insert(rows) as any
        );
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["audience-members", vars.audienceId] });
      qc.invalidateQueries({ queryKey: ["audience-recipients", vars.audienceId] });
    },
  });
}
