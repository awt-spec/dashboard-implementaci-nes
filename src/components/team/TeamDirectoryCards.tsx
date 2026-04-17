import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ExternalLink, Sparkles, ShieldCheck, Briefcase, Users2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useAllTeamSkills } from "@/hooks/useTeamSkills";

const initials = (name: string) => name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

const seniorityColor: Record<string, string> = {
  "Junior": "bg-blue-500/15 text-blue-500 border-blue-500/30",
  "Semi Senior": "bg-amber-500/15 text-amber-500 border-amber-500/30",
  "Senior": "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  "Lead": "bg-purple-500/15 text-purple-500 border-purple-500/30",
};

export function TeamDirectoryCards({ onCompare }: { onCompare?: () => void }) {
  const { data: members = [] } = useSysdeTeamMembers();
  const { data: allSkills = [] } = useAllTeamSkills();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [skillFilter, setSkillFilter] = useState<string>("all");

  const departments = useMemo(() => Array.from(new Set(members.map((m: any) => m.department).filter(Boolean))), [members]);
  const skillNames = useMemo(() => Array.from(new Set(allSkills.map(s => s.skill_name))).sort(), [allSkills]);

  const filtered = useMemo(() => {
    return members.filter((m: any) => {
      if (!m.is_active) return false;
      if (deptFilter !== "all" && m.department !== deptFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const cvSkills = (m.cv_skills || []).join(" ").toLowerCase();
        const memberSkills = allSkills.filter(s => s.member_id === m.id).map(s => s.skill_name).join(" ").toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.role?.toLowerCase().includes(q) && !cvSkills.includes(q) && !memberSkills.includes(q)) return false;
      }
      if (skillFilter !== "all") {
        const has = allSkills.some(s => s.member_id === m.id && s.skill_name === skillFilter && s.level >= 3);
        if (!has) return false;
      }
      return true;
    });
  }, [members, allSkills, search, deptFilter, skillFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, rol o skill..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los depts.</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Skill (nivel 3+)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier skill</SelectItem>
            {skillNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {onCompare && (
          <Button variant="outline" size="sm" onClick={onCompare} className="gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Recomendar para proyecto
          </Button>
        )}
        <Badge variant="secondary" className="gap-1"><Users2 className="h-3 w-3" /> {filtered.length}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((m: any, i: number) => {
          const memberSkills = allSkills.filter(s => s.member_id === m.id).sort((a, b) => b.level - a.level).slice(0, 4);
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="p-4 hover:border-primary/50 transition-all group h-full">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link to={`/team/${m.id}`} className="font-semibold text-sm hover:text-primary inline-flex items-center gap-1 truncate">
                      {m.name}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <div className="text-[11px] text-muted-foreground truncate">{m.role} · {m.department}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {m.cv_seniority && (
                    <Badge variant="outline" className={`text-[10px] ${seniorityColor[m.cv_seniority] || ""}`}>
                      {m.cv_seniority}
                    </Badge>
                  )}
                  {m.cv_years_experience > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Briefcase className="h-2.5 w-2.5" /> {m.cv_years_experience}y
                    </Badge>
                  )}
                  {m.user_id && (
                    <Badge className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                      <ShieldCheck className="h-2.5 w-2.5" /> Acceso
                    </Badge>
                  )}
                </div>
                {memberSkills.length > 0 ? (
                  <div className="space-y-1 pt-2 border-t border-border/50">
                    {memberSkills.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground truncate">{s.skill_name}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} className={`h-1.5 w-3 rounded-sm ${n <= s.level ? "bg-primary" : "bg-muted"}`} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">Sin skills registradas</div>
                )}
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
            No hay miembros que coincidan con los filtros.
          </Card>
        )}
      </div>
    </div>
  );
}
