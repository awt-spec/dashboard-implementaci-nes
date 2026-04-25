import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ViewScope = "insights" | "operacion" | "scrum" | "executive";

export interface SavedView {
  id: string;
  user_id: string;
  scope: ViewScope;
  name: string;
  preset_key: string;
  config: Record<string, any>;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export function useSavedViews(scope: ViewScope) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-saved-views", scope, user?.id ?? "anon"],
    queryFn: async () => {
      if (!user) return [] as SavedView[];
      const { data, error } = await supabase
        .from("user_saved_views" as any)
        .select("*")
        .eq("scope", scope)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SavedView[];
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useSaveView() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: {
      scope: ViewScope;
      name: string;
      preset_key: string;
      config: Record<string, any>;
    }) => {
      if (!user) throw new Error("Sin sesión");
      const { data, error } = await supabase
        .from("user_saved_views" as any)
        .upsert(
          {
            user_id: user.id,
            scope: args.scope,
            name: args.name,
            preset_key: args.preset_key,
            config: args.config,
          },
          { onConflict: "user_id,scope,name" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SavedView;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["user-saved-views", args.scope] });
    },
  });
}

export function useDeleteView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_saved_views" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-saved-views"] });
    },
  });
}

export function useTogglePinView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; pinned: boolean }) => {
      const { error } = await supabase
        .from("user_saved_views" as any)
        .update({ is_pinned: args.pinned })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-saved-views"] });
    },
  });
}
