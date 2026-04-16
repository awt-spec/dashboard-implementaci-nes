import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const HEARTBEAT_MS = 60_000; // 1 min
const SESSION_KEY = "sysde_active_session_id";

/**
 * Tracks user sessions: opens row in user_sessions on mount,
 * heartbeats every minute, closes on unload.
 * Also exposes logActivity() for ad-hoc events.
 */
export function useActivityTracker() {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  const logActivity = useCallback(async (
    action: string,
    opts: { entity_type?: string; entity_id?: string; client_id?: string; metadata?: Record<string, unknown> } = {}
  ) => {
    if (!user) return;
    await (supabase.from("user_activity_log" as any).insert([{
      user_id: user.id,
      action,
      entity_type: opts.entity_type ?? null,
      entity_id: opts.entity_id ?? null,
      client_id: opts.client_id ?? null,
      metadata: opts.metadata ?? {},
    }] as any) as any);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.from("user_sessions" as any).insert([{
        user_id: user.id,
        user_agent: navigator.userAgent.slice(0, 200),
      }] as any).select("id").single() as any);
      if (cancelled || error || !data) return;
      sessionIdRef.current = (data as any).id;
      sessionStorage.setItem(SESSION_KEY, (data as any).id);

      await logActivity("login");

      heartbeatRef.current = window.setInterval(async () => {
        if (!sessionIdRef.current) return;
        await (supabase.from("user_sessions" as any)
          .update({ last_heartbeat: new Date().toISOString() } as any)
          .eq("id", sessionIdRef.current) as any);
      }, HEARTBEAT_MS);
    })();

    const closeSession = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      // Use sendBeacon-style fire-and-forget update
      (supabase.from("user_sessions" as any)
        .update({ ended_at: new Date().toISOString(), last_heartbeat: new Date().toISOString() } as any)
        .eq("id", sid) as any).then(() => {});
      sessionStorage.removeItem(SESSION_KEY);
    };

    window.addEventListener("beforeunload", closeSession);

    return () => {
      cancelled = true;
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      window.removeEventListener("beforeunload", closeSession);
      closeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { logActivity };
}

/** Time tracking hook — start/stop a timer per work item. */
export function useWorkTimer() {
  const { user } = useAuth();
  const activeRef = useRef<{ id: string; startedAt: number } | null>(null);

  const start = useCallback(async (item: { source: "task" | "ticket"; id: string; client_id?: string }) => {
    if (!user) return null;
    // Auto-stop previous if any
    if (activeRef.current) await stop();
    const { data, error } = await (supabase.from("work_time_entries" as any).insert([{
      user_id: user.id,
      source: item.source,
      item_id: item.id,
      client_id: item.client_id ?? null,
    }] as any).select("id").single() as any);
    if (error || !data) return null;
    activeRef.current = { id: (data as any).id, startedAt: Date.now() };
    sessionStorage.setItem("sysde_active_timer", JSON.stringify({ entry_id: (data as any).id, item }));
    return (data as any).id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const stop = useCallback(async () => {
    const active = activeRef.current;
    if (!active) return;
    const seconds = Math.round((Date.now() - active.startedAt) / 1000);
    await (supabase.from("work_time_entries" as any)
      .update({ ended_at: new Date().toISOString(), duration_seconds: seconds } as any)
      .eq("id", active.id) as any);
    activeRef.current = null;
    sessionStorage.removeItem("sysde_active_timer");
  }, []);

  return { start, stop, getActive: () => activeRef.current };
}
