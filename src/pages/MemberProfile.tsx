import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Sparkles, Loader2, Award, Target, Calendar, Briefcase,
  TrendingUp, Clock, AlertCircle, CheckCircle2, Plus, Trash2, ExternalLink,
  Brain, Trophy, GitBranch, Users, Pencil, MapPin, Linkedin, Github, Globe, Twitter,
  Mail, Phone, Activity as ActivityIcon,
} from "lucide-react";
import { Avatar as AvatarUI, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import {
  useMember, useMemberCapacity, useUpsertCapacity,
  useMemberCertifications, useAddCertification, useDeleteCertification,
  useCareerPath, useGenerateCareerPath, useMemberPerformance,
} from "@/hooks/useMemberProfile";
import { CVAnalysisDialog } from "@/components/admin/CVAnalysisDialog";
import { ProfileEditDialog } from "@/components/team/ProfileEditDialog";
import { MemberActivityTimeline } from "@/components/team/MemberActivityTimeline";
import { MyProductivityDashboard } from "@/components/team/MyProductivityDashboard";
import { useAuth } from "@/hooks/useAuth";

const initials = (name: string) =>
  name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

const seniorityColors: Record<string, string> = {
  Junior: "bg-info/15 text-info border-info/30",
  "Semi-Senior": "bg-warning/15 text-warning border-warning/30",
  Senior: "bg-success/15 text-success border-success/30",
  Lead: "bg-primary/15 text-primary border-primary/30",
  Architect: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function MemberProfile() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { data: member, isLoading } = useMember(memberId);
  const { data: capacity } = useMemberCapacity(memberId);
  const { data: certs = [] } = useMemberCertifications(memberId);
  const { data: career } = useCareerPath(memberId);
  const { data: perf } = useMemberPerformance(member?.name);
  const upsertCap = useUpsertCapacity();
  const addCert = useAddCertification();
  const deleteCert = useDeleteCertification();
  const generateCareer = useGenerateCareerPath();

  const [tab, setTab] = useState("overview");
  const [cvOpen, setCvOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { profile } = useAuth();
  const isMe = !!(profile?.email && member?.email && profile.email.toLowerCase() === member.email.toLowerCase());
  const social = (member?.social_links as any) || {};

  // Capacity form
  const [weeklyHours, setWeeklyHours] = useState<number>(capacity?.weekly_hours ?? 40);
  const [allocation, setAllocation] = useState<number>(capacity?.current_allocation_pct ?? 0);
  const [tz, setTz] = useState<string>(capacity?.timezone ?? "America/Lima");
  const [oooStart, setOooStart] = useState("");
  const [oooEnd, setOooEnd] = useState("");
  const [oooReason, setOooReason] = useState("");

  // Cert form
  const [certName, setCertName] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certIssued, setCertIssued] = useState("");
  const [certUrl, setCertUrl] = useState("");

  // Career target
  const [targetRole, setTargetRole] = useState("");

  const cvAnalysis = (member?.cv_analysis as any) || {};
  const skills: string[] = member?.cv_skills || [];

  const stats = useMemo(() => {
    if (!perf) return { totalTasks: 0, doneTasks: 0, totalTickets: 0, doneTickets: 0, totalHours: 0, completionRate: 0 };
    const doneStatuses = ["done", "completado", "cerrado", "resuelto"];
    const doneTasks = perf.tasks.filter(t => doneStatuses.some(s => (t.status || "").toLowerCase().includes(s))).length;
    const doneTickets = perf.tickets.filter(t => doneStatuses.some(s => (t.estado || "").toLowerCase().includes(s) || (t.scrum_status || "") === "done")).length;
    const totalSeconds = perf.timeEntries.reduce((acc, e) => acc + (e.duration_seconds || 0), 0);
    const total = perf.tasks.length + perf.tickets.length;
    const done = doneTasks + doneTickets;
    return {
      totalTasks: perf.tasks.length,
      doneTasks,
      totalTickets: perf.tickets.length,
      doneTickets,
      totalHours: Math.round(totalSeconds / 3600),
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [perf]);

  // Monthly throughput data
  const monthly = useMemo(() => {
    if (!perf) return [];
    const map: Record<string, { month: string; tasks: number; tickets: number }> = {};
    [...perf.tasks, ...perf.tickets].forEach((it: any) => {
      const d = new Date(it.updated_at || it.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[k]) map[k] = { month: k, tasks: 0, tickets: 0 };
      if ("estado" in it) map[k].tickets++;
      else map[k].tasks++;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [perf]);

  // Skill radar data
  const radar = useMemo(() => {
    return skills.slice(0, 6).map(s => ({ skill: s, level: 60 + Math.floor(Math.random() * 40) }));
  }, [skills]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Colaborador no encontrado.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Volver</Button>
      </div>
    );
  }

  const handleSaveCapacity = (newOoo?: any[]) => {
    const ooo = newOoo ?? capacity?.ooo_periods ?? [];
    upsertCap.mutate(
      {
        member_id: member.id,
        weekly_hours: weeklyHours,
        timezone: tz,
        ooo_periods: ooo,
        current_allocation_pct: allocation,
        notes: capacity?.notes || "",
      },
      {
        onSuccess: () => toast.success("Capacidad actualizada"),
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  const handleAddOoo = () => {
    if (!oooStart || !oooEnd) return toast.error("Fechas requeridas");
    const next = [...(capacity?.ooo_periods || []), { start: oooStart, end: oooEnd, reason: oooReason }];
    handleSaveCapacity(next);
    setOooStart(""); setOooEnd(""); setOooReason("");
  };

  const handleRemoveOoo = (idx: number) => {
    const next = (capacity?.ooo_periods || []).filter((_, i) => i !== idx);
    handleSaveCapacity(next);
  };

  const handleAddCert = () => {
    if (!certName.trim()) return toast.error("Nombre requerido");
    addCert.mutate(
      { member_id: member.id, name: certName, issuer: certIssuer, issued_date: certIssued || null, credential_url: certUrl },
      {
        onSuccess: () => {
          toast.success("Certificación agregada");
          setCertName(""); setCertIssuer(""); setCertIssued(""); setCertUrl("");
        },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  const handleGenerateCareer = () => {
    generateCareer.mutate(
      { memberId: member.id, targetRole: targetRole || undefined },
      {
        onSuccess: () => toast.success("Plan de carrera generado"),
        onError: (e: any) => toast.error(e.message || "Error generando plan"),
      },
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
      </div>

      <Card className="overflow-hidden">
        {/* Cover */}
        <div
          className="h-36 md:h-44 bg-gradient-to-br from-primary/30 via-primary/10 to-muted bg-cover bg-center relative"
          style={member.cover_url ? { backgroundImage: `url(${member.cover_url})` } : undefined}
        >
          {(isMe || profile) && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-3 right-3 gap-1.5 backdrop-blur-sm bg-background/80"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" /> Editar perfil
            </Button>
          )}
        </div>

        <div className="px-6 pb-6 -mt-12 md:-mt-14">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <AvatarUI className="h-24 w-24 md:h-28 md:w-28 border-4 border-background shadow-lg">
              {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.name} />}
              <AvatarFallback className="text-2xl bg-primary/20 text-primary font-bold">
                {initials(member.name)}
              </AvatarFallback>
            </AvatarUI>
            <div className="flex-1 min-w-0 md:pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">{member.name}</h1>
                {member.pronouns && <span className="text-xs text-muted-foreground">({member.pronouns})</span>}
                {member.cv_seniority && (
                  <Badge variant="outline" className={seniorityColors[member.cv_seniority] || ""}>
                    {member.cv_seniority}
                  </Badge>
                )}
                <Badge variant={member.is_active ? "default" : "secondary"}>
                  {member.is_active ? "Activo" : "Inactivo"}
                </Badge>
                {isMe && <Badge className="bg-primary/20 text-primary border-primary/30" variant="outline">Tú</Badge>}
              </div>
              <p className="text-muted-foreground mt-1">{member.role || "—"} · {member.department || "—"}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5">
                {member.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</span>}
                {member.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</span>}
                {member.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{member.location}</span>}
                {member.cv_years_experience != null && member.cv_years_experience > 0 && (
                  <span><span className="font-semibold text-foreground">{member.cv_years_experience}</span> años exp.</span>
                )}
              </div>
              {/* Social links */}
              {(social.linkedin || social.github || social.website || social.twitter) && (
                <div className="flex gap-1 mt-2">
                  {social.linkedin && <Button asChild size="icon" variant="ghost" className="h-7 w-7"><a href={social.linkedin} target="_blank" rel="noreferrer"><Linkedin className="h-3.5 w-3.5" /></a></Button>}
                  {social.github && <Button asChild size="icon" variant="ghost" className="h-7 w-7"><a href={social.github} target="_blank" rel="noreferrer"><Github className="h-3.5 w-3.5" /></a></Button>}
                  {social.website && <Button asChild size="icon" variant="ghost" className="h-7 w-7"><a href={social.website} target="_blank" rel="noreferrer"><Globe className="h-3.5 w-3.5" /></a></Button>}
                  {social.twitter && <Button asChild size="icon" variant="ghost" className="h-7 w-7"><a href={social.twitter} target="_blank" rel="noreferrer"><Twitter className="h-3.5 w-3.5" /></a></Button>}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 md:items-end md:pb-2">
              <Button variant="outline" size="sm" onClick={() => setCvOpen(true)}>
                <Brain className="h-4 w-4 mr-2" /> {member.cv_url ? "Ver CV / re-analizar" : "Subir CV"}
              </Button>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Tasa de completitud</p>
                <p className="text-2xl font-bold text-success">{stats.completionRate}%</p>
              </div>
            </div>
          </div>

          {member.bio && (
            <p className="text-sm text-muted-foreground mt-4 max-w-3xl leading-relaxed">{member.bio}</p>
          )}

          {skills.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="flex flex-wrap gap-1.5">
                {skills.slice(0, 12).map(s => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
                {skills.length > 12 && <Badge variant="outline" className="text-xs">+{skills.length - 12}</Badge>}
              </div>
            </>
          )}
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview"><Trophy className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="activity"><ActivityIcon className="h-3.5 w-3.5 mr-1.5" />Actividad</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Performance</TabsTrigger>
          <TabsTrigger value="career"><GitBranch className="h-3.5 w-3.5 mr-1.5" />Plan de carrera</TabsTrigger>
          <TabsTrigger value="capacity"><Calendar className="h-3.5 w-3.5 mr-1.5" />Capacidad</TabsTrigger>
          <TabsTrigger value="certs"><Award className="h-3.5 w-3.5 mr-1.5" />Certificaciones</TabsTrigger>
          {isMe && <TabsTrigger value="timesheet"><Clock className="h-3.5 w-3.5 mr-1.5" />Mis horas</TabsTrigger>}
        </TabsList>

        {isMe && (
          <TabsContent value="timesheet" className="mt-4">
            <MyProductivityDashboard />
          </TabsContent>
        )}

        {/* ACTIVITY TIMELINE */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ActivityIcon className="h-4 w-4 text-primary" /> Línea de tiempo</CardTitle></CardHeader>
            <CardContent>
              <MemberActivityTimeline memberId={member.id} memberName={member.name} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Tareas" value={stats.totalTasks} sub={`${stats.doneTasks} hechas`} icon={Briefcase} color="info" />
            <KpiCard label="Tickets" value={stats.totalTickets} sub={`${stats.doneTickets} resueltos`} icon={AlertCircle} color="warning" />
            <KpiCard label="Horas trackeadas" value={stats.totalHours} sub="acumulado" icon={Clock} color="primary" />
            <KpiCard label="Carga actual" value={`${capacity?.current_allocation_pct ?? 0}%`} sub="asignación" icon={Users} color="success" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Resumen IA del CV</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-3">
                {cvAnalysis.summary ? (
                  <>
                    <p className="text-muted-foreground">{cvAnalysis.summary}</p>
                    {cvAnalysis.strengths?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1 text-success">Fortalezas</p>
                        <ul className="space-y-1">
                          {cvAnalysis.strengths.map((s: string, i: number) => (
                            <li key={i} className="flex gap-2 text-xs"><CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {cvAnalysis.gaps?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1 text-warning">Áreas a desarrollar</p>
                        <ul className="space-y-1">
                          {cvAnalysis.gaps.map((s: string, i: number) => (
                            <li key={i} className="flex gap-2 text-xs"><AlertCircle className="h-3 w-3 text-warning shrink-0 mt-0.5" />{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-3">Aún no hay análisis de CV</p>
                    <Button size="sm" variant="outline" onClick={() => setCvOpen(true)}>
                      <Brain className="h-4 w-4 mr-2" /> Subir y analizar CV
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Mapa de skills</CardTitle></CardHeader>
              <CardContent>
                {radar.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radar}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                      <Radar dataKey="level" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin skills registrados</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PERFORMANCE */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Velocidad" value={stats.doneTasks + stats.doneTickets} sub="items hechos" icon={TrendingUp} color="success" />
            <KpiCard label="Backlog" value={stats.totalTasks + stats.totalTickets - stats.doneTasks - stats.doneTickets} sub="pendientes" icon={Briefcase} color="warning" />
            <KpiCard label="Horas mes" value={Math.round(stats.totalHours / 6) || 0} sub="promedio" icon={Clock} color="info" />
            <KpiCard label="Cumplimiento" value={`${stats.completionRate}%`} sub="overall" icon={Target} color="primary" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Throughput mensual (últimos 6 meses)</CardTitle></CardHeader>
            <CardContent>
              {monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="tasks" fill="hsl(var(--info))" name="Tareas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tickets" fill="hsl(var(--warning))" name="Tickets" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos de actividad</p>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Tareas recientes</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm max-h-64 overflow-y-auto">
                {(perf?.tasks || []).slice(0, 8).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                    <span className="truncate">{t.title || t.id}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{t.status}</Badge>
                  </div>
                ))}
                {(!perf?.tasks?.length) && <p className="text-muted-foreground text-xs">Sin tareas asignadas</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Tickets recientes</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm max-h-64 overflow-y-auto">
                {(perf?.tickets || []).slice(0, 8).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                    <span className="truncate">{t.asunto || t.ticket_id}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{t.estado}</Badge>
                  </div>
                ))}
                {(!perf?.tickets?.length) && <p className="text-muted-foreground text-xs">Sin tickets asignados</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CAREER PATH */}
        <TabsContent value="career" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Plan de carrera (IA)
                  </CardTitle>
                  {career && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Generado {new Date(career.generated_at).toLocaleDateString()} · objetivo: <span className="font-semibold">{career.target_role_name}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Rol objetivo (opcional)"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value)}
                    className="w-56"
                  />
                  <Button onClick={handleGenerateCareer} disabled={generateCareer.isPending}>
                    {generateCareer.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {career ? "Regenerar" : "Generar plan"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {!career && (
                <div className="text-center py-10">
                  <Brain className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Genera el plan de carrera basado en el CV y skills actuales.</p>
                </div>
              )}

              {career && (
                <>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <p className="text-xs font-semibold text-primary mb-2">RESUMEN</p>
                    <p className="text-sm">{career.ai_summary}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-warning" /> Skills gap
                      </p>
                      <div className="space-y-2">
                        {career.skills_gap.map((g, i) => (
                          <div key={i} className="border rounded p-2.5">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-sm">{g.skill}</span>
                              <Badge variant="outline" className={
                                g.priority === "alta" ? "bg-destructive/15 text-destructive" :
                                g.priority === "media" ? "bg-warning/15 text-warning" : ""
                              }>{g.priority}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{g.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-info" /> Certificaciones recomendadas
                      </p>
                      <div className="space-y-2">
                        {career.recommended_certifications.map((c, i) => (
                          <div key={i} className="border rounded p-2.5 text-sm">
                            <p className="font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.issuer}{c.timeline_months ? ` · ${c.timeline_months} meses` : ""}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-primary" /> Roadmap
                    </p>
                    <div className="space-y-3">
                      {career.roadmap.map((r, i) => (
                        <div key={i} className="border-l-4 border-primary/40 pl-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{r.milestone}</span>
                            <Badge variant="secondary" className="text-xs">{r.timeframe}</Badge>
                          </div>
                          <ul className="space-y-1 mt-1">
                            {r.actions.map((a, j) => (
                              <li key={j} className="text-xs text-muted-foreground flex gap-2">
                                <span className="text-primary mt-0.5">•</span>{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {career.mentoring_suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-success" /> Mentoring sugerido
                      </p>
                      <ul className="space-y-1">
                        {career.mentoring_suggestions.map((s, i) => (
                          <li key={i} className="text-sm flex gap-2"><span className="text-success">→</span>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAPACITY */}
        <TabsContent value="capacity" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Capacidad semanal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Horas/semana</Label>
                  <Input type="number" value={weeklyHours} onChange={e => setWeeklyHours(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Zona horaria</Label>
                  <Input value={tz} onChange={e => setTz(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Asignación actual: {allocation}%</Label>
                  <Input type="range" min={0} max={150} value={allocation} onChange={e => setAllocation(Number(e.target.value))} />
                  <Progress value={Math.min(100, allocation)} className={allocation > 100 ? "[&>div]:bg-destructive" : allocation > 80 ? "[&>div]:bg-warning" : ""} />
                  <p className="text-xs text-muted-foreground">
                    {allocation > 100 ? "⚠️ Sobrecargado" : allocation > 80 ? "Carga alta" : allocation < 30 ? "Subutilizado" : "Saludable"}
                  </p>
                </div>
                <Button onClick={() => handleSaveCapacity()} disabled={upsertCap.isPending} className="w-full">
                  {upsertCap.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Períodos fuera de oficina</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Desde</Label>
                    <Input type="date" value={oooStart} onChange={e => setOooStart(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Hasta</Label>
                    <Input type="date" value={oooEnd} onChange={e => setOooEnd(e.target.value)} />
                  </div>
                </div>
                <Input placeholder="Motivo (vacaciones, capacitación, etc.)" value={oooReason} onChange={e => setOooReason(e.target.value)} />
                <Button size="sm" variant="outline" onClick={handleAddOoo} className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> Agregar período
                </Button>
                <Separator />
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(capacity?.ooo_periods || []).map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 border rounded text-sm">
                      <div>
                        <p className="font-medium">{p.start} → {p.end}</p>
                        <p className="text-xs text-muted-foreground">{p.reason}</p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => handleRemoveOoo(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {!(capacity?.ooo_periods || []).length && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin períodos registrados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CERTS */}
        <TabsContent value="certs" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Agregar certificación</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-4 gap-2">
              <Input placeholder="Nombre" value={certName} onChange={e => setCertName(e.target.value)} />
              <Input placeholder="Emisor" value={certIssuer} onChange={e => setCertIssuer(e.target.value)} />
              <Input type="date" value={certIssued} onChange={e => setCertIssued(e.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="URL credencial" value={certUrl} onChange={e => setCertUrl(e.target.value)} />
                <Button onClick={handleAddCert} disabled={addCert.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Certificaciones ({certs.length})</CardTitle></CardHeader>
            <CardContent>
              {certs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin certificaciones registradas</p>
              ) : (
                <div className="space-y-2">
                  {certs.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <Award className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.issuer} {c.issued_date && `· ${c.issued_date}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.credential_url && (
                          <Button size="icon" variant="ghost" asChild>
                            <a href={c.credential_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => deleteCert.mutate({ id: c.id, member_id: member.id })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {cvOpen && (
        <CVAnalysisDialog
          member={member}
          open={cvOpen}
          onOpenChange={setCvOpen}
        />
      )}
      {editOpen && (
        <ProfileEditDialog member={member} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color }: any) {
  const colorMap: Record<string, string> = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    info: "text-info bg-info/10",
    primary: "text-primary bg-primary/10",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className={`h-7 w-7 rounded ${colorMap[color]} flex items-center justify-center`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
