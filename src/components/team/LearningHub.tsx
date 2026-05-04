import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraduationCap, BookOpen, Plus, Send, Bot, User, ExternalLink, Clock, Star } from "lucide-react";
import { useCourses, useEnrollments, useUpsertCourse, useEnroll, useUpdateEnrollment } from "@/hooks/useTeamEngagement";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LEVELS = ["beginner", "intermediate", "advanced", "expert"];
const CATEGORIES = ["technical", "soft-skills", "leadership", "compliance", "product"];

export function LearningHub() {
  const { data: courses = [] } = useCourses();
  const { data: enrollments = [] } = useEnrollments();
  const { data: members = [] } = useSysdeTeamMembers();
  const upsert = useUpsertCourse();
  const enroll = useEnroll();
  const updateEnr = useUpdateEnrollment();

  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newCourse, setNewCourse] = useState<any>({ title: "", provider: "", url: "", description: "", related_skills: "", level: "intermediate", duration_hours: 0, cost: 0, category: "technical" });

  // Mentor IA panel
  const [mentorMember, setMentorMember] = useState("");
  const [mentorMsgs, setMentorMsgs] = useState<{ role: string; content: string }[]>([]);
  const [mentorInput, setMentorInput] = useState("");
  const [mentorLoading, setMentorLoading] = useState(false);
  const [convId, setConvId] = useState<string | undefined>();

  const filtered = useMemo(() => {
    return courses.filter((c: any) => {
      if (catFilter !== "all" && c.category !== catFilter) return false;
      if (filter && !`${c.title} ${(c.related_skills || []).join(" ")}`.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [courses, filter, catFilter]);

  const myEnrollments = (memberId?: string) => enrollments.filter((e: any) => !memberId || e.member_id === memberId);

  const totalHours = useMemo(() => enrollments.reduce((s: number, e: any) => s + (Number(e.hours_logged) || 0), 0), [enrollments]);
  const completed = enrollments.filter((e: any) => e.status === "completed").length;

  const handleCreateCourse = async () => {
    if (!newCourse.title) return;
    await upsert.mutateAsync({
      ...newCourse,
      related_skills: newCourse.related_skills.split(",").map((s: string) => s.trim()).filter(Boolean),
      duration_hours: Number(newCourse.duration_hours) || 0,
      cost: Number(newCourse.cost) || 0,
    });
    setNewCourse({ title: "", provider: "", url: "", description: "", related_skills: "", level: "intermediate", duration_hours: 0, cost: 0, category: "technical" });
    setNewOpen(false);
  };

  const handleAskMentor = async () => {
    if (!mentorInput.trim()) return;
    const q = mentorInput.trim();
    setMentorMsgs(m => [...m, { role: "user", content: q }]);
    setMentorInput("");
    setMentorLoading(true);
    const { data, error } = await supabase.functions.invoke("mentor-ai", { body: { member_id: mentorMember || null, question: q, conversation_id: convId } });
    setMentorLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Error mentor IA");
      return;
    }
    setMentorMsgs(m => [...m, { role: "assistant", content: data.answer }]);
    setConvId(data.conversation_id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center border border-violet-500/30">
            <GraduationCap className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Learning Hub & Mentor IA</h3>
            <p className="text-[11px] text-muted-foreground">Catálogo de cursos, tracking de horas y mentor inteligente personalizado</p>
          </div>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2"><Plus className="h-3.5 w-3.5" />Nuevo curso</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Añadir curso al catálogo</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Input placeholder="Título" value={newCourse.title} onChange={e => setNewCourse({ ...newCourse, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Proveedor" value={newCourse.provider} onChange={e => setNewCourse({ ...newCourse, provider: e.target.value })} />
                <Input placeholder="URL" value={newCourse.url} onChange={e => setNewCourse({ ...newCourse, url: e.target.value })} />
              </div>
              <Textarea placeholder="Descripción" value={newCourse.description} onChange={e => setNewCourse({ ...newCourse, description: e.target.value })} rows={2} />
              <Input placeholder="Skills relacionadas (coma-separadas)" value={newCourse.related_skills} onChange={e => setNewCourse({ ...newCourse, related_skills: e.target.value })} />
              <div className="grid grid-cols-4 gap-2">
                <Select value={newCourse.level} onValueChange={v => setNewCourse({ ...newCourse, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={newCourse.category} onValueChange={v => setNewCourse({ ...newCourse, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" placeholder="Horas" value={newCourse.duration_hours} onChange={e => setNewCourse({ ...newCourse, duration_hours: e.target.value })} />
                <Input type="number" placeholder="Costo USD" value={newCourse.cost} onChange={e => setNewCourse({ ...newCourse, cost: e.target.value })} />
              </div>
              <Button onClick={handleCreateCourse} disabled={upsert.isPending} className="w-full">Crear curso</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Cursos</div>
          <div className="text-2xl font-bold">{courses.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Inscripciones</div>
          <div className="text-2xl font-bold">{enrollments.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Horas formación</div>
          <div className="text-2xl font-bold text-violet-500">{totalHours.toFixed(0)}h</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Completados</div>
          <div className="text-2xl font-bold text-emerald-500">{completed}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-3">
          <div className="flex gap-2 mb-3">
            <Input placeholder="Buscar cursos…" value={filter} onChange={e => setFilter(e.target.value)} className="h-8" />
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-[480px] pr-2">
            <div className="space-y-2">
              {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sin cursos. Crea el primero ↑</p>}
              {filtered.map((c: any) => {
                const enrolled = myEnrollments().filter((e: any) => e.course_id === c.id);
                return (
                  <div key={c.id} className="p-3 rounded-lg border hover:border-violet-500/40 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <BookOpen className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <div className="text-sm font-semibold">{c.title}</div>
                          <Badge variant="outline" className="text-[9px]">{c.level}</Badge>
                          {c.is_internal && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-600">Interno</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{c.provider} · <Clock className="h-2.5 w-2.5 inline" /> {c.duration_hours}h · ${c.cost}</div>
                        {c.description && <p className="text-[11px] mt-1 text-muted-foreground line-clamp-2">{c.description}</p>}
                        {(c.related_skills || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.related_skills.slice(0, 6).map((s: string) => <Badge key={s} variant="outline" className="text-[9px]">{s}</Badge>)}
                          </div>
                        )}
                      </div>
                      {c.url && <a href={c.url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" className="h-7 px-2"><ExternalLink className="h-3.5 w-3.5" /></Button></a>}
                    </div>
                    {enrolled.length > 0 && (
                      <div className="mt-2 pt-2 border-t space-y-1">
                        <div className="text-[10px] font-semibold text-muted-foreground">{enrolled.length} inscritos</div>
                        {enrolled.slice(0, 3).map((e: any) => (
                          <div key={e.id} className="flex items-center gap-2 text-[11px]">
                            <span className="flex-1 truncate">{e.sysde_team_members?.name}</span>
                            <Progress value={e.progress_pct} className="h-1.5 flex-1" />
                            <span className="text-[10px] text-muted-foreground w-10 text-right">{e.progress_pct}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex gap-1">
                      <Select onValueChange={v => enroll.mutate({ member_id: v, course_id: c.id })}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="+ Inscribir colaborador" /></SelectTrigger>
                        <SelectContent>{members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        <Card className="p-3 flex flex-col h-[560px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center"><Bot className="h-4 w-4 text-white" /></div>
            <div>
              <div className="text-xs font-bold">Mentor IA</div>
              <div className="text-[10px] text-muted-foreground">Recomienda cursos y resuelve dudas</div>
            </div>
          </div>
          <Select value={mentorMember} onValueChange={(v) => { setMentorMember(v); setMentorMsgs([]); setConvId(undefined); }}>
            <SelectTrigger className="h-8 mb-2 text-xs"><SelectValue placeholder="Contexto: colaborador (opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Sin contexto</SelectItem>
              {members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ScrollArea className="flex-1 pr-2 mb-2">
            <div className="space-y-2">
              {mentorMsgs.length === 0 && (
                <div className="text-[11px] text-muted-foreground bg-violet-500/5 rounded-md p-2 border border-violet-500/20">
                  💡 Pregunta cosas como: <em>"¿Qué cursos hago para llegar a Senior IFS Consultant?"</em> o <em>"Plan de 3 meses para mejorar en SQL Server"</em>
                </div>
              )}
              {mentorMsgs.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && <Bot className="h-4 w-4 text-violet-500 shrink-0 mt-1" />}
                  <div className={`text-[11px] rounded-lg p-2 max-w-[85%] whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div>
                  {m.role === "user" && <User className="h-4 w-4 shrink-0 mt-1" />}
                </div>
              ))}
              {mentorLoading && <div className="text-[11px] text-muted-foreground flex items-center gap-2"><Bot className="h-4 w-4 animate-pulse text-violet-500" />Pensando…</div>}
            </div>
          </ScrollArea>
          <div className="flex gap-1">
            <Input placeholder="Pregunta al mentor…" value={mentorInput} onChange={e => setMentorInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAskMentor()} className="h-8 text-xs" />
            <Button size="sm" onClick={handleAskMentor} disabled={mentorLoading || !mentorInput.trim()} className="h-8 px-2"><Send className="h-3.5 w-3.5" /></Button>
          </div>
        </Card>
      </div>

      {enrollments.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-semibold mb-2">Mis inscripciones (todas)</div>
          <div className="space-y-1.5">
            {enrollments.slice(0, 10).map((e: any) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <span className="font-medium w-32 truncate">{e.sysde_team_members?.name}</span>
                <span className="flex-1 truncate text-muted-foreground">{e.learning_courses?.title}</span>
                <Input type="number" className="h-7 w-16 text-xs" value={e.progress_pct} onChange={ev => updateEnr.mutate({ id: e.id, progress_pct: Number(ev.target.value) })} />
                <Input type="number" step="0.5" className="h-7 w-16 text-xs" value={e.hours_logged} onChange={ev => updateEnr.mutate({ id: e.id, hours_logged: Number(ev.target.value) })} title="Horas" />
                <Select value={e.status} onValueChange={v => updateEnr.mutate({ id: e.id, status: v, completed_at: v === "completed" ? new Date().toISOString().slice(0, 10) : null })}>
                  <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enrolled">Inscrito</SelectItem>
                    <SelectItem value="in_progress">En curso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="dropped">Abandonado</SelectItem>
                  </SelectContent>
                </Select>
                {e.status === "completed" && <Star className="h-3.5 w-3.5 text-amber-500" />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
