import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NotificationKind =
  | "ticket_assigned"
  | "ticket_status_changed"
  | "note_added"
  | "subtask_assigned"
  | "minute_shared"
  | "mention"
  | "system";

export interface UserNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export function useMyNotifications(limit = 20) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-notifications", user?.id, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("user_notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit) as any);
      if (error) throw error;
      return (data || []) as UserNotification[];
    },
    refetchInterval: 60000, // revalida cada 60s
  });
}

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-notifications-unread", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await (supabase
        .from("user_notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("is_read", false) as any);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("user_notifications" as any)
        .update({ is_read: true })
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-notifications"] });
      qc.invalidateQueries({ queryKey: ["user-notifications-unread"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await (supabase
        .from("user_notifications" as any)
        .update({ is_read: true })
        .eq("is_read", false)
        .eq("user_id", user.id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-notifications"] });
      qc.invalidateQueries({ queryKey: ["user-notifications-unread"] });
    },
  });
}

/**
 * Escucha realtime las notificaciones del usuario actual e invalida el cache
 * para que la campana se actualice al instante.
 */
export function useNotificationRealtime() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-notif-${user.id}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["user-notifications"] });
          qc.invalidateQueries({ queryKey: ["user-notifications-unread"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);
}
