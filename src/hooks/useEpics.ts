import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Épicas canónicas del proyecto de implementación (orden de ejecución). */
export const EPICS = [
  { key: "administracion", label: "Administración" },
  { key: "infraestructura", label: "Infraestructura" },
  { key: "parametrizacion", label: "Parametrización" },
  { key: "capacitaciones", label: "Capacitaciones" },
  { key: "desarrollos", label: "Desarrollos" },
] as const;
export type EpicKey = (typeof EPICS)[number]["key"];
export const EPIC_LABEL: Record<EpicKey, string> = Object.fromEntries(
  EPICS.map((e) => [e.key, e.label]),
) as Record<EpicKey, string>;

/** Estados de facturación por HU. "lista_para_facturar" es el disparador clave. */
export const BILLING_STATUS = {
  sin_estado: { label: "Sin estado", tone: "muted" as const },
  en_asignacion: { label: "En asignación", tone: "info" as const },
  en_desarrollo: { label: "En desarrollo", tone: "warning" as const },
  lista_para_facturar: { label: "Lista para facturar", tone: "success" as const },
  facturada: { label: "Facturada", tone: "primary" as const },
};
export type BillingStatus = keyof typeof BILLING_STATUS;
export const BILLING_ORDER: BillingStatus[] = [
  "en_asignacion",
  "en_desarrollo",
  "lista_para_facturar",
  "facturada",
  "sin_estado",
];

export interface EpicHU {
  id: string;
  hu_code: string | null;
  title: string;
  status: string;
  scrum_status: string | null;
  story_points: number | null;
  epic: EpicKey | null;
  billing_status: BillingStatus;
  owner: string | null;
  priority: string | null;
  done: boolean;
}

export interface EpicSummary {
  key: EpicKey;
  label: string;
  total: number;
  done: number;
  /** % de avance ponderado por story points (o por conteo si no hay puntos). */
  progress: number;
  hus: EpicHU[];
}

const isDone = (t: { status?: string; scrum_status?: string | null }) =>
  t.status === "completada" || t.scrum_status === "done";

const weightedProgress = (hus: EpicHU[]) => {
  const total = hus.reduce((s, h) => s + (h.story_points || 1), 0);
  const done = hus.filter((h) => h.done).reduce((s, h) => s + (h.story_points || 1), 0);
  return total ? Math.round((done / total) * 100) : 0;
};

export interface EpicTaskSummary {
  key: EpicKey;
  label: string;
  total: number;
  doneCount: number;
  /** % ponderado por story points (o por conteo si no hay puntos). */
  progress: number;
}

/**
 * Resumen de avance por épica a partir de tareas/HU en formato camelCase
 * (ClientTask). Reutilizable en reportes y presentaciones (sincrónico, sin hook).
 */
export function summarizeEpicsFromTasks(
  tasks: Array<{ epic?: string | null; storyPoints?: number | null; status?: string; scrumStatus?: string | null }>,
): { summaries: EpicTaskSummary[]; overall: number } {
  const norm = tasks.map((t) => ({
    epic: ((t.epic ?? "parametrizacion") as EpicKey),
    points: t.storyPoints || 1,
    done: t.status === "completada" || t.scrumStatus === "done",
  }));
  const summaries: EpicTaskSummary[] = EPICS.map((e) => {
    const items = norm.filter((n) => n.epic === e.key);
    const total = items.reduce((s, i) => s + i.points, 0);
    const done = items.filter((i) => i.done).reduce((s, i) => s + i.points, 0);
    return {
      key: e.key,
      label: e.label,
      total: items.length,
      doneCount: items.filter((i) => i.done).length,
      progress: total ? Math.round((done / total) * 100) : 0,
    };
  });
  const gTotal = norm.reduce((s, i) => s + i.points, 0);
  const gDone = norm.filter((i) => i.done).reduce((s, i) => s + i.points, 0);
  return { summaries, overall: gTotal ? Math.round((gDone / gTotal) * 100) : 0 };
}

export function useEpics(clientId?: string) {
  return useQuery({
    queryKey: ["epics", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("tasks")
        .select("id, original_id, title, status, scrum_status, story_points, epic, hu_code, billing_status, owner, priority")
        .eq("client_id", clientId) as any);
      if (error) throw error;

      const hus: EpicHU[] = (data ?? []).map((t: any) => ({
        id: t.id,
        hu_code: t.hu_code ?? (t.original_id != null ? `HU${String(t.original_id).padStart(3, "0")}` : null),
        title: t.title,
        status: t.status,
        scrum_status: t.scrum_status ?? null,
        story_points: t.story_points ?? null,
        epic: (t.epic ?? null) as EpicKey | null,
        billing_status: (t.billing_status ?? "sin_estado") as BillingStatus,
        owner: t.owner ?? null,
        priority: t.priority ?? null,
        done: isDone(t),
      }));

      const summaries: EpicSummary[] = EPICS.map((e) => {
        const items = hus.filter((h) => h.epic === e.key);
        return {
          key: e.key,
          label: e.label,
          total: items.length,
          done: items.filter((h) => h.done).length,
          progress: weightedProgress(items),
          hus: items.sort((a, b) => (a.hu_code ?? "").localeCompare(b.hu_code ?? "")),
        };
      });

      const overall = weightedProgress(hus);
      // Disparadores de facturación que Eduardo vigila: listas para facturar y en asignación.
      const billingTriggers = hus
        .filter((h) => h.billing_status === "lista_para_facturar" || h.billing_status === "en_asignacion")
        .sort(
          (a, b) =>
            BILLING_ORDER.indexOf(a.billing_status) - BILLING_ORDER.indexOf(b.billing_status) ||
            (a.hu_code ?? "").localeCompare(b.hu_code ?? ""),
        );

      return { summaries, overall, hus, billingTriggers };
    },
  });
}

export function useUpdateHuBilling(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, billing_status }: { id: string; billing_status: BillingStatus }) => {
      const { error } = await (supabase.from("tasks").update({ billing_status } as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["epics", clientId] }),
  });
}
