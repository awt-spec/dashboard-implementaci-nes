import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, BarChart3, PieChart as PieIcon, TrendingUp, Activity, Trash2, Pencil, Save, AreaChart as AreaIcon,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LineChart, Line, RadialBarChart, RadialBar,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type Client } from "@/data/projectData";

// ── Types ──────────────────────────────
type ChartType = "bar" | "pie" | "line" | "area" | "radial";
type DataSource = "tasks_status" | "tasks_priority" | "deliverables_status" | "phases_progress" | "risks_impact" | "tasks_owner" | "tasks_team";

interface CustomChart {
  id: string;
  title: string;
  chartType: ChartType;
  dataSource: DataSource;
  colorScheme: string;
}

const CHART_TYPES: { value: ChartType; label: string; icon: any }[] = [
  { value: "bar", label: "Barras", icon: BarChart3 },
  { value: "pie", label: "Dona / Pie", icon: PieIcon },
  { value: "line", label: "Línea", icon: TrendingUp },
  { value: "area", label: "Área", icon: AreaIcon },
  { value: "radial", label: "Radial", icon: Activity },
];

const DATA_SOURCES: { value: DataSource; label: string; description: string }[] = [
  { value: "tasks_status", label: "Actividades por Estado", description: "Completadas, en progreso, pendientes, bloqueadas" },
  { value: "tasks_priority", label: "Actividades por Prioridad", description: "Alta, media, baja" },
  { value: "tasks_owner", label: "Actividades por Persona", description: "Distribución por persona individual asignada" },
  { value: "tasks_team", label: "Actividades por Empresa/Equipo", description: "Agrupación por empresa o equipo responsable" },
  { value: "deliverables_status", label: "Entregables por Estado", description: "Aprobados, entregados, en revisión, pendientes" },
  { value: "phases_progress", label: "Progreso de Fases", description: "Porcentaje de avance por fase" },
  { value: "risks_impact", label: "Riesgos por Impacto", description: "Alto, medio, bajo" },
];

const COLOR_SCHEMES: { id: string; label: string; colors: string[] }[] = [
  { id: "default", label: "Estándar", colors: ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"] },
  { id: "ocean", label: "Océano", colors: ["#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#059669"] },
  { id: "sunset", label: "Atardecer", colors: ["#f97316", "#ef4444", "#ec4899", "#a855f7", "#6366f1"] },
  { id: "forest", label: "Bosque", colors: ["#22c55e", "#16a34a", "#65a30d", "#84cc16", "#a3e635"] },
  { id: "berry", label: "Berries", colors: ["#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"] },
];

const tooltipStyle = {
  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12,
  boxShadow: "0 8px 30px -10px hsl(var(--foreground) / 0.15)", padding: "8px 12px",
};

// ── Data extraction ──────────────────
function extractData(client: Client, source: DataSource): { name: string; value: number }[] {
  const tasks = client.tasks.filter(t => t.visibility === "externa");

  switch (source) {
    case "tasks_status":
      return [
        { name: "Completadas", value: tasks.filter(t => t.status === "completada").length },
        { name: "En Progreso", value: tasks.filter(t => t.status === "en-progreso").length },
        { name: "Pendientes", value: tasks.filter(t => t.status === "pendiente").length },
        { name: "Bloqueadas", value: tasks.filter(t => t.status === "bloqueada").length },
      ].filter(d => d.value > 0);

    case "tasks_priority":
      return [
        { name: "Alta", value: tasks.filter(t => t.priority === "alta").length },
        { name: "Media", value: tasks.filter(t => t.priority === "media").length },
        { name: "Baja", value: tasks.filter(t => t.priority === "baja").length },
      ].filter(d => d.value > 0);

    case "tasks_owner": {
      const ownerMap: Record<string, number> = {};
      tasks.forEach(t => { ownerMap[t.owner] = (ownerMap[t.owner] || 0) + 1; });
      return Object.entries(ownerMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    }

    case "tasks_team": {
      const teamMap: Record<string, number> = {};
      tasks.forEach(t => {
        // Use responsibleTeam if available from assignees, otherwise extract company/team from owner
        const assignees = (t.assignees || []) as Array<{ name: string; role: string }>;
        const team = assignees.length > 0 && assignees[0].role
          ? assignees[0].role
          : t.owner.includes(" - ") ? t.owner.split(" - ")[1].trim() : t.owner;
        teamMap[team] = (teamMap[team] || 0) + 1;
      });
      return Object.entries(teamMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    }

    case "deliverables_status":
      return [
        { name: "Aprobados", value: client.deliverables.filter(d => d.status === "aprobado").length },
        { name: "Entregados", value: client.deliverables.filter(d => d.status === "entregado").length },
        { name: "En Revisión", value: client.deliverables.filter(d => d.status === "en-revision").length },
        { name: "Pendientes", value: client.deliverables.filter(d => d.status === "pendiente").length },
      ].filter(d => d.value > 0);

    case "phases_progress":
      return client.phases.map(p => ({ name: p.name, value: p.progress }));

    case "risks_impact":
      return [
        { name: "Alto", value: client.risks.filter(r => r.impact === "alto").length },
        { name: "Medio", value: client.risks.filter(r => r.impact === "medio").length },
        { name: "Bajo", value: client.risks.filter(r => r.impact === "bajo").length },
      ].filter(d => d.value > 0);

    default:
      return [];
  }
}

// ── Chart Renderer ──────────────────
function RenderChart({ chart, data }: { chart: CustomChart; data: { name: string; value: number }[]; colors: string[] }) {
  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sin datos disponibles</div>;
  }

  const scheme = COLOR_SCHEMES.find(s => s.id === chart.colorScheme) || COLOR_SCHEMES[0];
  const c = scheme.colors;

  switch (chart.chartType) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={800}>
              {data.map((_, i) => <Cell key={i} fill={c[i % c.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "pie":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius="35%" outerRadius="70%" dataKey="value" strokeWidth={3} stroke="hsl(var(--card))"
              label={({ percent }) => percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : ""} labelLine={false}
              animationDuration={800}>
              {data.map((_, i) => <Cell key={i} fill={c[i % c.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      );

    case "line":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke={c[0]} strokeWidth={3} dot={{ r: 5, fill: c[0], stroke: "hsl(var(--card))", strokeWidth: 2 }}
              activeDot={{ r: 7, fill: c[0] }} animationDuration={800} />
          </LineChart>
        </ResponsiveContainer>
      );

    case "area":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="customAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={c[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke={c[0]} strokeWidth={2.5} fill="url(#customAreaGrad)"
              dot={{ r: 4, fill: c[0], stroke: "hsl(var(--card))", strokeWidth: 2 }} animationDuration={800} />
          </AreaChart>
        </ResponsiveContainer>
      );

    case "radial":
      const radialData = data.map((d, i) => ({ ...d, fill: c[i % c.length] }));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={radialData} startAngle={180} endAngle={-180} barSize={10}>
            <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={6} />
            <Tooltip contentStyle={tooltipStyle} />
          </RadialBarChart>
        </ResponsiveContainer>
      );

    default:
      return null;
  }
}

// ── Hook: persist custom charts ──────
function useCustomCharts(clientId: string) {
  const [charts, setCharts] = useState<CustomChart[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from("presentation_data").select("data")
      .eq("client_id", clientId).eq("data_key", "custom_charts").maybeSingle()
      .then(({ data: row }) => {
        if (cancelled) return;
        if (row?.data) setCharts(row.data as unknown as CustomChart[]);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  const save = useCallback(async (newCharts: CustomChart[]) => {
    setCharts(newCharts);
    await supabase.from("presentation_data").upsert(
      { client_id: clientId, data_key: "custom_charts", data: newCharts as any },
      { onConflict: "client_id,data_key" }
    );
  }, [clientId]);

  return { charts, save, loaded };
}

// ── Chart Creator Dialog ──────────────
function ChartCreatorDialog({ onSave, existingChart }: { onSave: (chart: CustomChart) => void; existingChart?: CustomChart }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(existingChart?.title || "");
  const [chartType, setChartType] = useState<ChartType>(existingChart?.chartType || "bar");
  const [dataSource, setDataSource] = useState<DataSource>(existingChart?.dataSource || "tasks_status");
  const [colorScheme, setColorScheme] = useState(existingChart?.colorScheme || "default");

  useEffect(() => {
    if (existingChart) {
      setTitle(existingChart.title);
      setChartType(existingChart.chartType);
      setDataSource(existingChart.dataSource);
      setColorScheme(existingChart.colorScheme);
    }
  }, [existingChart]);

  const handleSave = () => {
    if (!title.trim()) { toast.error("Agrega un título al gráfico"); return; }
    onSave({
      id: existingChart?.id || `chart-${Date.now()}`,
      title: title.trim(),
      chartType,
      dataSource,
      colorScheme,
    });
    setOpen(false);
    if (!existingChart) { setTitle(""); setChartType("bar"); setDataSource("tasks_status"); setColorScheme("default"); }
    toast.success(existingChart ? "Gráfico actualizado" : "Gráfico creado");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existingChart ? (
          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Crear Gráfico
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{existingChart ? "Editar Gráfico" : "Crear Nuevo Gráfico"}</DialogTitle></DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-foreground">Título del gráfico</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Resumen de actividades" className="mt-1" />
          </div>

          {/* Chart Type */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Tipo de gráfico</label>
            <div className="grid grid-cols-5 gap-2">
              {CHART_TYPES.map(ct => {
                const Icon = ct.icon;
                return (
                  <motion.button
                    key={ct.value}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setChartType(ct.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                      chartType === ct.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{ct.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Data Source */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Fuente de datos</label>
            <div className="grid grid-cols-1 gap-1.5 max-h-[180px] overflow-y-auto">
              {DATA_SOURCES.map(ds => (
                <motion.button
                  key={ds.value}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDataSource(ds.value)}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all ${
                    dataSource === ds.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dataSource === ds.value ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <div>
                    <p className="text-xs font-medium text-foreground">{ds.label}</p>
                    <p className="text-[10px] text-muted-foreground">{ds.description}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Color Scheme */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Paleta de colores</label>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_SCHEMES.map(cs => (
                <motion.button
                  key={cs.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setColorScheme(cs.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                    colorScheme === cs.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex gap-0.5">
                    {cs.colors.slice(0, 4).map((color, i) => (
                      <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground">{cs.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="gap-1.5"><Save className="h-3.5 w-3.5" /> {existingChart ? "Actualizar" : "Crear"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main exported component ──────────
interface CustomChartBuilderProps {
  client: Client;
}

export function CustomChartBuilder({ client }: CustomChartBuilderProps) {
  const { charts, save, loaded } = useCustomCharts(client.id);

  const handleAddChart = (chart: CustomChart) => {
    const existing = charts.findIndex(c => c.id === chart.id);
    if (existing >= 0) {
      const updated = [...charts];
      updated[existing] = chart;
      save(updated);
    } else {
      save([...charts, chart]);
    }
  };

  const handleDeleteChart = (id: string) => {
    save(charts.filter(c => c.id !== id));
    toast.success("Gráfico eliminado");
  };

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Mis Gráficos Personalizados</h3>
          {charts.length > 0 && <Badge variant="outline" className="text-xs">{charts.length} gráficos</Badge>}
        </div>
        <ChartCreatorDialog onSave={handleAddChart} />
      </div>

      {/* Empty state */}
      {charts.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Cree gráficos a la medida</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Seleccione el tipo de gráfico, la fuente de datos y la paleta de colores para visualizar la información de su proyecto.
              </p>
              <ChartCreatorDialog onSave={handleAddChart} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Chart Grid */}
      <AnimatePresence>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {charts.map((chart, idx) => {
            const data = extractData(client, chart.dataSource);
            const scheme = COLOR_SCHEMES.find(s => s.id === chart.colorScheme) || COLOR_SCHEMES[0];
            const sourceLabel = DATA_SOURCES.find(d => d.value === chart.dataSource)?.label || "";
            const typeLabel = CHART_TYPES.find(t => t.value === chart.chartType)?.label || "";

            return (
              <motion.div
                key={chart.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm truncate">{chart.title}</CardTitle>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{sourceLabel} • {typeLabel}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <ChartCreatorDialog onSave={handleAddChart} existingChart={chart} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteChart(chart.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-52">
                      <RenderChart chart={chart} data={data} colors={scheme.colors} />
                    </div>
                    {/* Legend for pie/radial */}
                    {(chart.chartType === "pie" || chart.chartType === "radial") && (
                      <div className="flex flex-wrap justify-center gap-3 mt-3 pt-2 border-t border-border">
                        {data.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scheme.colors[i % scheme.colors.length] }} />
                            <span className="text-muted-foreground">{d.name}</span>
                            <span className="font-bold text-foreground">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
}
