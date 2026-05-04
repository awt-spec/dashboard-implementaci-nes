import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useAllTeamSkills } from "@/hooks/useTeamSkills";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { X } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))"];
const initials = (n: string) => n.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();

export function CompareCollaboratorsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: members = [] } = useSysdeTeamMembers();
  const { data: allSkills = [] } = useAllTeamSkills();
  const [selected, setSelected] = useState<string[]>([]);

  const addMember = (id: string) => {
    if (selected.includes(id) || selected.length >= 3) return;
    setSelected([...selected, id]);
  };

  const removeMember = (id: string) => setSelected(selected.filter(x => x !== id));

  const selectedMembers = useMemo(() => selected.map(id => members.find((m: any) => m.id === id)).filter(Boolean), [selected, members]);

  // Build common skill axes
  const radarData = useMemo(() => {
    const skillSet = new Set<string>();
    selected.forEach(id => allSkills.filter(s => s.member_id === id).forEach(s => skillSet.add(s.skill_name)));
    const axes = Array.from(skillSet).slice(0, 8);
    return axes.map(skill => {
      const row: any = { skill };
      selected.forEach(id => {
        const s = allSkills.find(x => x.member_id === id && x.skill_name === skill);
        const m = members.find((x: any) => x.id === id);
        row[m?.name || id] = s ? s.level * 20 : 0;
      });
      return row;
    });
  }, [selected, allSkills, members]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Comparar colaboradores</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Select onValueChange={addMember} value="">
              <SelectTrigger className="w-64"><SelectValue placeholder="Añadir colaborador (máx 3)" /></SelectTrigger>
              <SelectContent>
                {members.filter((m: any) => m.is_active && !selected.includes(m.id)).map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.name} · {m.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMembers.map((m: any, i: number) => (
              <Badge key={m.id} variant="outline" className="gap-1.5 pl-1 pr-2 py-1" style={{ borderColor: COLORS[i] }}>
                <Avatar className="h-5 w-5">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                  <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs">{m.name}</span>
                <button onClick={() => removeMember(m.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>

          {selected.length === 0 && (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              Selecciona 2 o 3 colaboradores para comparar sus skills, experiencia y carga.
            </Card>
          )}

          {selected.length > 0 && (
            <>
              {radarData.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Mapa de habilidades</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                      {selectedMembers.map((m: any, i: number) => (
                        <Radar key={m.id} name={m.name} dataKey={m.name} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.2} />
                      ))}
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${selected.length}, 1fr)` }}>
                {selectedMembers.map((m: any, i: number) => {
                  const memberSkills = allSkills.filter(s => s.member_id === m.id);
                  return (
                    <Card key={m.id} className="p-3 border-t-4" style={{ borderTopColor: COLORS[i] }}>
                      <div className="text-center mb-3">
                        <Avatar className="h-12 w-12 mx-auto mb-2">
                          {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                          <AvatarFallback>{initials(m.name)}</AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-bold">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground">{m.role}</p>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <Row label="Seniority" value={m.cv_seniority || "—"} />
                        <Row label="Experiencia" value={m.cv_years_experience ? `${m.cv_years_experience} años` : "—"} />
                        <Row label="Departamento" value={m.department || "—"} />
                        <Row label="Skills registradas" value={memberSkills.length} />
                        <Row label="Email" value={m.email || "—"} small />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-1 border-b border-dashed last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${small ? "truncate max-w-[140px]" : ""}`}>{value}</span>
    </div>
  );
}
