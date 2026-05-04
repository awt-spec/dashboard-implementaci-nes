import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  entry_id: string;
  changed_by: string;
  changed_by_email: string | null;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: any;
  created_at: string;
}

export interface WeeklyLock {
  id: string;
  week_start: string;
  locked_by: string;
  locked_at: string;
  notes: string | null;
}

export function useTimeAuditLog(rangeDays = 30) {
  return useQuery({
    queryKey: ["time-audit-log", rangeDays],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - rangeDays);
      const { data, error } = await (supabase
        .from("time_entry_audit_log" as any)
        .select("*")
        .gte("created_at", from.toISOString())
        .order("created_at", { ascending: false })
        .limit(500) as any);
      if (error) throw error;
      return (data as AuditLogEntry[]) || [];
    },
  });
}

export function useWeeklyLocks() {
  return useQuery({
    queryKey: ["weekly-locks"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("time_weekly_locks" as any)
        .select("*")
        .order("week_start", { ascending: false }) as any);
      if (error) throw error;
      return (data as WeeklyLock[]) || [];
    },
  });
}
