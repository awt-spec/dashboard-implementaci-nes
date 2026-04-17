import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Activity, Users, Trophy, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useAllTeamSkills } from "@/hooks/useTeamSkills";
import { useKudos, useMemberBadges, useTimeOff } from "@/hooks/useTeamEngagement";
import { Link } from "react-router-dom";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const initials = (n: string) => n.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();

function useAllCapacity() {
  return useQuery({
    queryKey: ["all-capacity"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("team_member_capacity" as any).select("*") as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function TeamAnalytics() {
  const { data: members = [] } = useSysdeTeamMembers();
  const { data: skills = [] } = useAllTeamSkills();
  const { data: kudos = [] } = useKudos();
  const { data: badges = [] } = useMemberBadges();
  const { data: timeOff = [] } = useTimeOff();
  const { data: capacity = [] } = useAllCapacity();

  const stats = useMemo(() => {
    const active = members.filter((m: any) => m.is_active);
    const today = new Date().toISOString().slice(0, 10);
    const oooToday = (timeOff as any[]).filter(t => t.status === "approved" && t.start_date <= today && t.end_date >= today);
    const avgAlloc = capacity.length
      ? Math.round(capacity.reduce((s, c) => s + (c.current_allocation_pct || 0), 0) / capacity.length)
      : 0;
    const overloaded = capacity.filter(c => (c.current_allocation_pct || 0) > 100).length;
    const underused = capacity.filter(c => (c.current_allocation_pct || 0) < 30 && c.current_allocation_pct != null).length;
    const avgSkillsPerMember = active.length ? (skills.length / active.length).toFixed(1) : "0";

    return {
      total: active.length,
      oooToday: oooToday.length,
      avgAlloc,
      overloaded,
      underused,
      totalKudos: kudos.length,
      totalBadges: badges.length,
      avgSkills: avgSkillsPerMember,
    };
  }, [members, capacity, timeOff, skills, kudos, badges]);

  // Top performers (by kudos + badges)
  const topPerformers = useMemo(() => {
    const counts: Record<string, { kudos: number; badges: number }> = {};
    kudos.forEach((k: any) => {
      counts[k.to_member_id] = counts[k.to_member_id] || { kudos: 0, badges: 0 };
      counts[k.to_member_id].kudos++;
    });
    badges.forEach((b: any) => {
      counts[b.member_id] = counts[b.member_id] || { kudos: 0, badges: 0 };
      counts[b.member_id].badges++;
    });
    return members
      .map((m: any) => ({ ...m, ...counts[m.id], score: (counts[m.id]?.kudos || 0) + (counts[m.id]?.badges || 0) * 3 }))
      .filter((m: any) => m.is_active && m.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5);
  }, [members, kudos, badges]);

  // At-risk: overloaded OR no skills OR no recent activity
  const atRisk = useMemo(() => {
    return members
      .filter((m: any) => m.is_active)
      .map((m: any) => {
        const cap = capacity.find(c => c.member_id === m.id);
        const memberSkills = skills.filter(s => s.member_id === m.id).length;
        const reasons: string[] = [];
        if ((cap?.current_allocation_pct || 0) > 100) reasons.push("Sobrecargado");
        if (memberSkills === 0) reasons.push("Sin skills registrados");
        if (!m.cv_url) reasons.push("Sin CV");
        const oooDays = (timeOff as any[]).filter(t => t.member_id === m.id && t.status === "approved").length;
        if (oooDays > 5) reasons.push("Mucho tiempo OOO");
        return { ...m, reasons, allocation: cap?.current_allocation_pct || 0 };
      })
      .filter(m => m.reasons.length > 0)
      .slice(0, 5);
  }, [members, capacity, skills, timeOff]);

  const healthData = [{ name: "health", value: Math.max(0, 100 - stats.overloaded * 15 - atRisk.length * 5) }];

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Activos</span>
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{stats.oooToday} fuera hoy</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Carga promedio</span>
            <Activity className="h-3.5 w-3.5 text-info" />
          </div>
          <p className="text-2xl font-bold">{stats.avgAlloc}%</p>
          <Progress value={Math.min(100, stats.avgAlloc)} className="h-1 mt-1.5" />
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Reconocimientos</span>
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold">{stats.totalKudos}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{stats.totalBadges} badges otorgadas</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Alertas</span>
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          </div>
          <p className="text-2xl font-bold text-destructive">{stats.overloaded + atRisk.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{stats.overloaded} sobrecarga · {atRisk.length} en riesgo</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health gauge */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Health Score del equipo</h3>
            <Badge variant="outline" className="text-[10px]">live</Badge>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart innerRadius="65%" outerRadius="95%" data={healthData} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={10} fill="hsl(var(--primary))" />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center -mt-32 mb-12">
            <p className="text-3xl font-bold">{healthData[0].value}</p>
            <p className="text-[11px] text-muted-foreground">/ 100</p>
          </div>
          <div className="text-[11px] text-muted-foreground text-center mt-4">
            Basado en carga, alertas y skill coverage
          </div>
        </Card>

        {/* Top performers */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Trophy className="h-4 w-4 text-amber-500" /> Top performers</h3>
          </div>
          <div className="space-y-2">
            {topPerformers.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Sin reconocimientos aún</p>}
            {topPerformers.map((m: any, i: number) => (
              <Link key={m.id} to={`/team/${m.id}`} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/60 transition">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-zinc-400 text-white" : i === 2 ? "bg-orange-700 text-white" : "bg-muted text-foreground"}`}>{i + 1}</span>
                <Avatar className="h-7 w-7">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                  <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{m.name}</div>
                  <div className="text-[10px] text-muted-foreground">{m.kudos || 0} kudos · {m.badges || 0} badges</div>
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              </Link>
            ))}
          </div>
        </Card>

        {/* At-risk */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-destructive" /> Necesitan atención</h3>
          </div>
          <div className="space-y-2">
            {atRisk.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">¡Todo el equipo está bien! 🎉</p>}
            {atRisk.map((m: any) => (
              <Link key={m.id} to={`/team/${m.id}`} className="block p-2 rounded-md bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{m.name}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {m.reasons.map((r: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[9px] py-0 h-4 bg-destructive/10 text-destructive border-destructive/30">{r}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
