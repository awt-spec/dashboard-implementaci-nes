import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, GraduationCap, Briefcase, AlertCircle, Sparkles } from "lucide-react";
import { useKudos, useMemberBadges, useEnrollments } from "@/hooks/useTeamEngagement";
import { useMemberPerformance } from "@/hooks/useMemberProfile";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ActivityItem {
  id: string;
  date: string;
  type: "kudo" | "badge" | "course" | "task" | "ticket";
  icon: any;
  title: string;
  detail?: string;
  color: string;
}

export function MemberActivityTimeline({ memberId, memberName }: { memberId: string; memberName?: string }) {
  const { data: kudos = [] } = useKudos(memberId);
  const { data: badges = [] } = useMemberBadges(memberId);
  const { data: enrollments = [] } = useEnrollments(memberId);
  const { data: perf } = useMemberPerformance(memberName);

  const items = useMemo<ActivityItem[]>(() => {
    const arr: ActivityItem[] = [];

    kudos.forEach((k: any) => arr.push({
      id: `kudo-${k.id}`, date: k.created_at, type: "kudo",
      icon: Sparkles, color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
      title: `Recibió un kudo ${k.emoji || "👏"}`,
      detail: k.message,
    }));

    badges.forEach((b: any) => arr.push({
      id: `badge-${b.id}`, date: b.awarded_at, type: "badge",
      icon: Award, color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
      title: `Insignia: ${b.team_badges?.icon || "🏅"} ${b.team_badges?.name || "Badge"}`,
      detail: b.reason || b.team_badges?.description,
    }));

    enrollments.forEach((e: any) => {
      if (e.completed_at) {
        arr.push({
          id: `course-c-${e.id}`, date: e.completed_at, type: "course",
          icon: GraduationCap, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
          title: `Completó: ${e.learning_courses?.title || "Curso"}`,
          detail: `${e.hours_logged}h registradas`,
        });
      } else if (e.started_at) {
        arr.push({
          id: `course-s-${e.id}`, date: e.started_at, type: "course",
          icon: GraduationCap, color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
          title: `Inició: ${e.learning_courses?.title || "Curso"}`,
          detail: `${e.progress_pct}% de avance`,
        });
      }
    });

    const doneStatuses = ["done", "completado", "cerrado", "resuelto"];
    (perf?.tasks || []).slice(0, 20).forEach((t: any) => {
      if (doneStatuses.some(s => (t.status || "").toLowerCase().includes(s))) {
        arr.push({
          id: `task-${t.id}`, date: t.updated_at || t.created_at, type: "task",
          icon: Briefcase, color: "text-info bg-info/10 border-info/30",
          title: "Tarea completada",
          detail: t.title || t.id,
        });
      }
    });
    (perf?.tickets || []).slice(0, 20).forEach((t: any) => {
      if (doneStatuses.some(s => (t.estado || "").toLowerCase().includes(s) || t.scrum_status === "done")) {
        arr.push({
          id: `tk-${t.id}`, date: t.updated_at || t.created_at, type: "ticket",
          icon: AlertCircle, color: "text-warning bg-warning/10 border-warning/30",
          title: "Ticket resuelto",
          detail: t.asunto || t.ticket_id,
        });
      }
    });

    return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);
  }, [kudos, badges, enrollments, perf]);

  if (items.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
      </Card>
    );
  }

  return (
    <div className="relative pl-6 space-y-3">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="relative">
            <div className={`absolute -left-[22px] h-7 w-7 rounded-full border-2 flex items-center justify-center ${item.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <Card className="p-3 ml-2 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.detail && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.detail}</p>}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 whitespace-nowrap">
                  {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: es })}
                </Badge>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
