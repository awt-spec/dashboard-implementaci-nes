import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WidgetLayoutItem {
  i: string;       // widget id
  x: number; y: number; w: number; h: number;
  minW?: number; minH?: number;
}

export interface WidgetConfig {
  id: string;          // unique instance id
  type: string;        // widget type key (registry)
  enabled: boolean;
  settings?: Record<string, unknown>;
}

export interface ColaboradorLayoutPayload {
  layout: WidgetLayoutItem[];
  widgets: WidgetConfig[];
}

const DEFAULTS: ColaboradorLayoutPayload = {
  widgets: [
    { id: "hero", type: "hero", enabled: true },
    { id: "focus", type: "focus", enabled: true },
    { id: "sprint", type: "sprint", enabled: true },
    { id: "agent", type: "agent", enabled: true },
    { id: "board", type: "board", enabled: true },
    { id: "calendar", type: "calendar", enabled: true },
  ],
  layout: [
    { i: "hero",     x: 0, y: 0,  w: 12, h: 4, minW: 6, minH: 3 },
    { i: "focus",    x: 0, y: 4,  w: 4,  h: 6, minW: 3, minH: 4 },
    { i: "sprint",   x: 4, y: 4,  w: 4,  h: 6, minW: 3, minH: 4 },
    { i: "agent",    x: 8, y: 4,  w: 4,  h: 6, minW: 3, minH: 4 },
    { i: "board",    x: 0, y: 10, w: 12, h: 10, minW: 6, minH: 6 },
    { i: "calendar", x: 0, y: 20, w: 12, h: 6,  minW: 6, minH: 4 },
  ],
};

export function useColaboradorLayout() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["colab-layout", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ColaboradorLayoutPayload> => {
      const { data, error } = await (supabase
        .from("colaborador_dashboard_layouts" as any)
        .select("layout, widgets")
        .eq("user_id", user!.id)
        .maybeSingle() as any);
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return DEFAULTS;
      return {
        layout: (data.layout as WidgetLayoutItem[]) || DEFAULTS.layout,
        widgets: (data.widgets as WidgetConfig[]) || DEFAULTS.widgets,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: async (payload: ColaboradorLayoutPayload) => {
      if (!user?.id) throw new Error("No user");
      const { error } = await (supabase
        .from("colaborador_dashboard_layouts" as any)
        .upsert({ user_id: user.id, layout: payload.layout, widgets: payload.widgets }, { onConflict: "user_id" }) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colab-layout", user?.id] }),
  });

  const reset = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user");
      const { error } = await (supabase
        .from("colaborador_dashboard_layouts" as any)
        .upsert({ user_id: user.id, ...DEFAULTS }, { onConflict: "user_id" }) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colab-layout", user?.id] }),
  });

  return { ...query, save, reset, defaults: DEFAULTS };
}
