import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, TrendingUp, User } from "lucide-react";
import { format, startOfMonth, isAfter } from "date-fns";
import { es } from "date-fns/locale";

interface WorkEntry {
  id: string;
  user_id: string;
  source: "task" | "ticket" | string;
  item_id: string;
  client_id: string | null;
  duration_seconds: number | null;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  description?: string | null;
  work_date?: string | null;
}

interface Props {
  clientId: string;
}

function fmtHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function ClientHoursPanel({ clientId }: Props) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["client-hours", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_time_entries")
        .select("id, user_id, source, item_id, client_id, duration_seconds, started_at, ended_at, note, description, work_date")
        .eq("client_id", clientId)
        .not("duration_seconds", "is", null)
        .order("started_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as WorkEntry[];
    },
  });

  // Nombres de quienes trabajaron (para mostrar atribución sin exponer user_id)
  const userIds = useMemo(() => Array.from(new Set(entries.map(e => e.user_id))), [entries]);
  const { data: profilesMap = new Map<string, string>() } = useQuery({
    queryKey: ["profiles-names", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return new Map<string, string>();
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const m = new Map<string, string>();
      (data || []).forEach((p: any) => m.set(p.user_id, p.full_name || "Equipo SYSDE"));
      return m;
    },
    enabled: userIds.length > 0,
  });

  const { totalSeconds, thisMonthSeconds, byTicket, byUser } = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    let total = 0;
    let thisMonth = 0;
    const ticketAgg = new Map<string, { item_id: string; seconds: number; last: string }>();
    const userAgg = new Map<string, number>();

    entries.forEach(e => {
      const secs = e.duration_seconds ?? 0;
      total += secs;
      if (isAfter(new Date(e.started_at), monthStart)) thisMonth += secs;

      if (e.source === "ticket") {
        const current = ticketAgg.get(e.item_id) ?? { item_id: e.item_id, seconds: 0, last: e.started_at };
        current.seconds += secs;
        if (new Date(e.started_at) > new Date(current.last)) current.last = e.started_at;
        ticketAgg.set(e.item_id, current);
      }

      userAgg.set(e.user_id, (userAgg.get(e.user_id) ?? 0) + secs);
    });

    const byTicket = Array.from(ticketAgg.values()).sort((a, b) => b.seconds - a.seconds);
    const byUser = Array.from(userAgg.entries())
      .map(([user_id, seconds]) => ({ user_id, seconds }))
      .sort((a, b) => b.seconds - a.seconds);

    return { totalSeconds: total, thisMonthSeconds: thisMonth, byTicket, byUser };
  }, [entries]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold mb-1">Sin horas registradas</p>
          <p className="text-[11px] text-muted-foreground">
            El equipo SYSDE todavía no ha cargado tiempo contra tus casos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total histórico</p>
            </div>
            <p className="text-2xl font-black tabular-nums">{fmtHours(totalSeconds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {format(new Date(), "MMMM", { locale: es })}
              </p>
            </div>
            <p className="text-2xl font-black tabular-nums">{fmtHours(thisMonthSeconds)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Hours by ticket */}
      {byTicket.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold">Horas por caso</p>
              <Badge variant="outline" className="text-[10px]">{byTicket.length}</Badge>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {byTicket.slice(0, 15).map(t => {
                const pct = totalSeconds > 0 ? (t.seconds / totalSeconds) * 100 : 0;
                return (
                  <div key={t.item_id} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-mono truncate">{t.item_id}</p>
                      <p className="text-[11px] font-semibold tabular-nums shrink-0">{fmtHours(t.seconds)}</p>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hours by team member */}
      {byUser.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-bold mb-1">Por miembro del equipo</p>
            <div className="space-y-1">
              {byUser.slice(0, 10).map(u => {
                const name = profilesMap.get(u.user_id) ?? "Equipo SYSDE";
                return (
                  <div key={u.user_id} className="flex items-center gap-2 text-[11px]">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{name}</span>
                    <span className="font-semibold tabular-nums shrink-0">{fmtHours(u.seconds)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
