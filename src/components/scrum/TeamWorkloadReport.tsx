import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, BarChart3, TrendingUp, Calendar, ListOrdered,
  AlertTriangle, CheckCircle2, Inbox, Flame, type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(280,60%,60%)",
  "hsl(150,60%,50%)",
];

const WORKLOAD_STYLES: Record<string, { border: string; bg: string; text: string; label: string; Icon: LucideIcon }> = {
  sobrecargado: { border: "border-destructive/40",     bg: "bg-destructive/5", text: "text-destructive",     label: "Sobrecargados", Icon: Flame },
  saludable:    { border: "border-success/40",         bg: "bg-success/5",     text: "text-success",         label: "Saludables",    Icon: CheckCircle2 },
  subutilizado: { border: "border-warning/40",         bg: "bg-warning/5",     text: "text-warning",         label: "Subutilizados", Icon: AlertTriangle },
  sin_carga:    { border: "border-muted-foreground/25",bg: "bg-muted/30",      text: "text-muted-foreground",label: "Sin Carga",     Icon: Inbox },
};

interface OwnerEntry { name: string; fullName: string; value: number; level: string; }
interface DistEntry { name: string; value: number; }
interface VelocityEntry { sprint: string; planned: number; completed: number; }
interface BurndownEntry { day: string; ideal: number; real: number; }

interface Props {
  workloadStats: { sobrecargados: number; saludables: number; subutilizados: number; sin_carga: number };
  ownerLoad: OwnerEntry[];
  ownersWithoutLoad: string[];
  sourceDist: DistEntry[];
  velocityData: VelocityEntry[];
  burndown: BurndownEntry[];
  scrumStatusDist: DistEntry[];
}

export function TeamWorkloadReport({
  workloadStats, ownerLoad, ownersWithoutLoad,
  sourceDist, velocityData, burndown, scrumStatusDist,
}: Props) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Carga del Equipo — Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(["sobrecargado", "saludable", "subutilizado", "sin_carga"] as const).map((level) => {
              const s = WORKLOAD_STYLES[level];
              const count =
                level === "sobrecargado" ? workloadStats.sobrecargados :
                level === "saludable"    ? workloadStats.saludables :
                level === "subutilizado" ? workloadStats.subutilizados :
                                           workloadStats.sin_carga;
              return (
                <div key={level} className={`p-3 rounded-lg border ${s.border} ${s.bg}`}>
                  <div className={`flex items-center gap-1.5 ${s.text}`}>
                    <s.Icon className="h-3.5 w-3.5" />
                    <p className="text-[11px] uppercase tracking-wide font-bold">{s.label}</p>
                  </div>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${s.text}`}>{count}</p>
                </div>
              );
            })}
          </div>
          {ownersWithoutLoad.length > 0 && (
            <div className="p-3 rounded-lg border border-border/60 bg-muted/30">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Sin items activos asignados ({ownersWithoutLoad.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ownersWithoutLoad.map(o => (
                  <Badge key={o} variant="outline" className="text-xs bg-background">{o}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Carga por Persona
              <span className="ml-auto text-[11px] text-muted-foreground font-normal">
                &gt;7 sobrecarga · 3-7 saludable · &lt;3 baja
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ownerLoad.slice(0, 12)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    formatter={(v: any, _n, p: any) => [`${v} items (${p?.payload?.level})`, "Carga"]}
                    labelFormatter={(l) => `${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {ownerLoad.slice(0, 12).map((d, i) => (
                      <Cell key={i} fill={
                        d.level === "sobrecargado" ? "hsl(var(--destructive))" :
                        d.level === "saludable"    ? "hsl(var(--success))" :
                                                      "hsl(var(--warning))"
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Distribución por Origen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceDist} innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" paddingAngle={2}>
                    {sourceDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Velocity por Sprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="planned"   fill="hsl(var(--muted-foreground))" name="Planeados"   radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" fill="hsl(var(--success))"          name="Completados" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Burndown Sprint Activo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {burndown.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Sin sprint activo con fechas
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burndown}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" name="Ideal" dot={false} />
                    <Line type="monotone" dataKey="real"  stroke="hsl(var(--primary))" name="Real" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              Distribución por Estado Scrum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scrumStatusDist}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
