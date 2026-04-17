import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trophy, Award } from "lucide-react";
import { toast } from "sonner";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useAllTeamSkills, useUpsertSkill, useDeleteSkill } from "@/hooks/useTeamSkills";

const heatColor = (level: number) => {
  if (level === 0) return "bg-muted/30 text-muted-foreground";
  if (level === 1) return "bg-red-500/20 text-red-500 border border-red-500/30";
  if (level === 2) return "bg-orange-500/20 text-orange-500 border border-orange-500/30";
  if (level === 3) return "bg-amber-500/25 text-amber-600 border border-amber-500/30";
  if (level === 4) return "bg-lime-500/25 text-lime-600 border border-lime-500/30";
  return "bg-emerald-500/30 text-emerald-500 border border-emerald-500/40";
};

const CATEGORIES = ["tecnica", "funcional", "soft", "idioma", "herramienta"];

export function SkillMatrix() {
  const { data: members = [] } = useSysdeTeamMembers();
  const { data: skills = [] } = useAllTeamSkills();
  const upsert = useUpsertSkill();
  const del = useDeleteSkill();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ member_id: "", skill_name: "", category: "tecnica", level: 3, years_experience: 0, is_certified: false });

  const activeMembers = useMemo(() => members.filter((m: any) => m.is_active), [members]);

  const filteredSkills = useMemo(() => {
    let list = skills;
    if (categoryFilter !== "all") list = list.filter(s => s.category === categoryFilter);
    if (search) list = list.filter(s => s.skill_name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [skills, search, categoryFilter]);

  const skillNames = useMemo(() => Array.from(new Set(filteredSkills.map(s => s.skill_name))).sort(), [filteredSkills]);

  const getLevel = (memberId: string, skillName: string) => {
    const s = skills.find(x => x.member_id === memberId && x.skill_name === skillName);
    return s?.level ?? 0;
  };

  const handleAdd = () => {
    if (!form.member_id || !form.skill_name.trim()) return;
    upsert.mutate(
      { ...form, skill_name: form.skill_name.trim() },
      { onSuccess: () => { toast.success("Skill registrada"); setOpen(false); setForm({ ...form, skill_name: "", level: 3 }); } }
    );
  };

  // Top skills by team coverage
  const topSkills = useMemo(() => {
    const counts: Record<string, { total: number; experts: number }> = {};
    skills.forEach(s => {
      counts[s.skill_name] ||= { total: 0, experts: 0 };
      counts[s.skill_name].total++;
      if (s.level >= 4) counts[s.skill_name].experts++;
    });
    return Object.entries(counts).sort((a, b) => b[1].experts - a[1].experts).slice(0, 5);
  }, [skills]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground mb-1">Skills únicas</div>
          <div className="text-2xl font-bold">{new Set(skills.map(s => s.skill_name)).size}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground mb-1">Expertise (nivel 4+)</div>
          <div className="text-2xl font-bold text-emerald-500">{skills.filter(s => s.level >= 4).length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground mb-1">Certificaciones</div>
          <div className="text-2xl font-bold text-primary">{skills.filter(s => s.is_certified).length}</div>
        </Card>
      </div>

      {topSkills.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5 text-amber-500" /> Top skills del equipo</div>
          <div className="flex flex-wrap gap-1.5">
            {topSkills.map(([name, c]) => (
              <Badge key={name} variant="outline" className="gap-1 text-[10px]">
                {name} <span className="text-emerald-500 font-bold">{c.experts}</span>/{c.total}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Matriz de Habilidades</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar skill..." className="pl-8 h-8 w-40 text-xs" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="h-8 gap-1"><Plus className="h-3.5 w-3.5" /> Skill</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar skill</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Select value={form.member_id} onValueChange={v => setForm({ ...form, member_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Colaborador" /></SelectTrigger>
                    <SelectContent>{activeMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Nombre de la skill (ej: React, SQL Server, AWS)" value={form.skill_name} onChange={e => setForm({ ...form, skill_name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={String(form.level)} onValueChange={v => setForm({ ...form, level: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Básico</SelectItem>
                        <SelectItem value="2">2 - Aprendiz</SelectItem>
                        <SelectItem value="3">3 - Competente</SelectItem>
                        <SelectItem value="4">4 - Avanzado</SelectItem>
                        <SelectItem value="5">5 - Experto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="number" placeholder="Años de experiencia" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: Number(e.target.value) })} />
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={form.is_certified} onChange={e => setForm({ ...form, is_certified: e.target.checked })} />
                    Certificación oficial
                  </label>
                  <Button onClick={handleAdd} disabled={upsert.isPending} className="w-full">Guardar skill</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {skillNames.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Sin skills registradas. Agrega la primera para construir la matriz.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/50 z-10 min-w-[160px]">Colaborador</th>
                  {skillNames.map(n => (
                    <th key={n} className="p-1.5 font-medium text-[10px] whitespace-nowrap min-w-[70px]">
                      <div className="rotate-[-25deg] origin-bottom-left h-12 flex items-end">{n}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((m: any) => (
                  <tr key={m.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 font-medium sticky left-0 bg-background z-10 truncate max-w-[160px]">{m.name}</td>
                    {skillNames.map(n => {
                      const lvl = getLevel(m.id, n);
                      const skillObj = skills.find(s => s.member_id === m.id && s.skill_name === n);
                      return (
                        <td key={n} className="p-1 text-center">
                          <button
                            onClick={() => {
                              const next = lvl >= 5 ? 0 : lvl + 1;
                              if (next === 0 && skillObj) {
                                del.mutate(skillObj.id);
                              } else {
                                upsert.mutate({ member_id: m.id, skill_name: n, category: skillObj?.category || "tecnica", level: next, years_experience: skillObj?.years_experience || 0, is_certified: skillObj?.is_certified || false });
                              }
                            }}
                            className={`w-9 h-7 rounded text-[10px] font-bold cursor-pointer hover:scale-110 transition-transform ${heatColor(lvl)}`}
                            title={`Click para cambiar nivel (actual: ${lvl})`}
                          >
                            {lvl > 0 ? lvl : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
