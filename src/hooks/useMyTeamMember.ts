import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface MyMember {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  department: string | null;
  employment_type?: "hourly" | "salaried";
  hourly_rate?: number;
  rate_currency?: string;
}

export function useMyTeamMember() {
  const { user, profile } = useAuth();
  const email = profile?.email || user?.email;
  return useQuery({
    queryKey: ["my-team-member", email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sysde_team_members" as any)
        .select("id, name, email, role, department, employment_type, hourly_rate, rate_currency")
        .ilike("email", email!)
        .maybeSingle() as any);
      if (error) throw error;
      return data as MyMember | null;
    },
  });
}
