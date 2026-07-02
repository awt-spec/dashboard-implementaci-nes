import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEpics, EPICS, type EpicKey, type EpicHU } from "@/hooks/useEpics";

export interface BacklogTaskNode {
  id: string;
  title: string;
  state: string | null;
  assigned_to: string | null;
  iteration: string | null;
  effort: number | null;
  progress: number;
}
export interface BacklogHUNode {
  hu: EpicHU;
  tasks: BacklogTaskNode[];
}
export interface BacklogFeatureNode {
  id: string;
  title: string;
  hus: BacklogHUNode[];
  total: number;
  done: number;
  progress: number;
}
export interface BacklogEpicNode {
  key: EpicKey;
  label: string;
  total: number;
  done: number;
  progress: number;
  features: BacklogFeatureNode[];
}

interface BacklogItem {
  id: string;
  item_type: "feature" | "task";
  epic: string | null;
  parent_hu_id: string | null;
  title: string;
  state: string | null;
  assigned_to: string | null;
  iteration: string | null;
  effort: number | null;
  progress: number | null;
  order_index: number | null;
}

/** Hash determinista de un id → entero, para repartir HU entre features. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const weighted = (hus: EpicHU[]) => {
  const total = hus.reduce((s, h) => s + (h.story_points || 1), 0);
  const done = hus.filter((h) => h.done).reduce((s, h) => s + (h.story_points || 1), 0);
  return total ? Math.round((done / total) * 100) : 0;
};

export function useBacklogTree(clientId?: string) {
  const epics = useEpics(clientId);

  const items = useQuery({
    queryKey: ["backlog-items", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("backlog_items" as any)
        .select("*")
        .eq("client_id", clientId) as any);
      if (error) throw error;
      return (data ?? []) as BacklogItem[];
    },
  });

  const isLoading = epics.isLoading || items.isLoading;

  let tree: BacklogEpicNode[] = [];
  if (epics.data && items.data) {
    const allItems = items.data;
    const tasksByHu = new Map<string, BacklogTaskNode[]>();
    for (const it of allItems) {
      if (it.item_type === "task" && it.parent_hu_id) {
        const arr = tasksByHu.get(it.parent_hu_id) ?? [];
        arr.push({
          id: it.id,
          title: it.title,
          state: it.state,
          assigned_to: it.assigned_to,
          iteration: it.iteration,
          effort: it.effort,
          progress: it.progress ?? 0,
        });
        tasksByHu.set(it.parent_hu_id, arr);
      }
    }
    const featuresByEpic = new Map<string, BacklogItem[]>();
    for (const it of allItems) {
      if (it.item_type === "feature" && it.epic) {
        const arr = featuresByEpic.get(it.epic) ?? [];
        arr.push(it);
        featuresByEpic.set(it.epic, arr);
      }
    }

    tree = EPICS.map((e) => {
      const summary = epics.data!.summaries.find((s) => s.key === e.key);
      const hus = summary?.hus ?? [];
      const feats = (featuresByEpic.get(e.key) ?? []).sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
      );
      const featureNodes: BacklogFeatureNode[] = feats.map((f) => ({
        id: f.id, title: f.title, hus: [], total: 0, done: 0, progress: 0,
      }));

      // Reparto determinista de cada HU a una feature de su épica.
      if (featureNodes.length > 0) {
        for (const hu of hus) {
          const idx = hashStr(hu.id) % featureNodes.length;
          featureNodes[idx].hus.push({ hu, tasks: tasksByHu.get(hu.id) ?? [] });
        }
      }
      featureNodes.forEach((fn) => {
        const fh = fn.hus.map((x) => x.hu);
        fn.total = fh.length;
        fn.done = fh.filter((h) => h.done).length;
        fn.progress = weighted(fh);
      });

      return {
        key: e.key,
        label: e.label,
        total: summary?.total ?? 0,
        done: summary?.done ?? 0,
        progress: summary?.progress ?? 0,
        features: featureNodes.filter((fn) => fn.total > 0),
      };
    }).filter((en) => en.total > 0);
  }

  return { isLoading, tree, overall: epics.data?.overall ?? 0 };
}
