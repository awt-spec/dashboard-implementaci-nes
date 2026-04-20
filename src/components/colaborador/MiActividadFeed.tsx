import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface MiActividadFeedProps { limit?: number }

export function MiActividadFeed({ limit = 8 }: MiActividadFeedProps) {
  const { data: activity = [] } = useQuery({
    queryKey: ["team-activity-feed", limit],
    queryFn: async () => {
      const { data: logs } = await (supabase
        .from("user_activity_log" as any)
        .select("id, action, metadata, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(limit) as any);
      const userIds = Array.from(new Set((logs || []).map((l: any) => l.user_id).filter(Boolean)));
      const { data: profs } = userIds.length > 0
        ? await (supabase.from("profiles").select("user_id, full_name").in("user_id", userIds as any) as any)
        : { data: [] };
      const nameMap = new Map<string, string>();
      (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.full_name));
      return (logs || []).map((l: any) => ({
        id: l.id,
        user_name: nameMap.get(l.user_id) || "Alguien",
        action: l.action,
        metadata: l.metadata,
        created_at: l.created_at,
      }));
    },
  });

  const describe = (a: any) => {
    const t = a.metadata?.title;
    switch (a.action) {
      case "move_item":
        if (a.metadata?.to === "done") return <>completó <strong>{t || "una tarea"}</strong></>;
        return <>movió <strong>{t || "una tarea"}</strong> a <em>{a.metadata?.to || "—"}</em></>;
      case "timer_start":
        return <>inició <strong>{t || "un timer"}</strong></>;
      case "timer_stop":
        return <>detuvo el timer de <strong>{t || "una tarea"}</strong></>;
      case "pull_to_sprint":
        return <>añadió al sprint <strong>{a.metadata?.sprint || "actual"}</strong></>;
      case "login":
        return <>inició sesión</>;
      default:
        return <>{a.action}</>;
    }
  };

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-bold mb-4">Mi actividad</h3>
        <div className="space-y-3">
          {activity.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-6">Sin actividad reciente</p>
          )}
          {activity.map(a => {
            const initials = a.user_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div key={a.id} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/20 shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed">
                    <strong className="font-semibold">{a.user_name}</strong> {describe(a)}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  hace {formatDistanceToNow(new Date(a.created_at), { locale: es })}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
