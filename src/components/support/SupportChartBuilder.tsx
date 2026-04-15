import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, PieChartIcon, LineChart as LineChartIcon, TrendingUp, Plus, X, GripVertical, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, LineChart, Line, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, Treemap
} from "recharts";
import type { SupportTicket } from "@/hooks/useSupportTickets";

const COLORS = [
  "#6366f1", "#f43f5e", "#f59e0b", "#3b82f6", "#10b981",
  "#8b5cf6", "#f97316", "#06b6d4", "#ec4899", "#84cc16",
];

const GRADIENTS = [
  ["#6366f1", "#a78bfa"],
  ["#f43f5e", "#fb7185"],
  ["#f59e0b", "#fbbf24"],
  ["#3b82f6", "#60a5fa"],
  ["#10b981", "#34d399"],
  ["#8b5cf6", "#c4b5fd"],
  ["#f97316", "#fdba74"],
  ["#06b6d4", "#22d3ee"],
];

type ChartType = "bar" | "horizontal_bar" | "pie" | "donut" | "line" | "area" | "radar" | "treemap";
type DataField = "estado" | "prioridad" | "tipo" | "producto" | "responsable" | "client_name" | "dias_bucket" | "ai_classification" | "ai_risk_level";
type MetricType = "count" | "avg_dias" | "max_dias" | "sum_dias";

interface ChartConfig {
  id: string;
  groupBy: DataField;
  chartType: ChartType;
  metric: MetricType;
  filterField?: DataField;
  filterValue?: string;
  title?: string;
}

const fieldLabels: Record<DataField, string> = {
  estado: "Estado",
  prioridad: "Prioridad",
  tipo: "Tipo",
  producto: "Producto",
  responsable: "Responsable",
  client_name: "Cliente",
  dias_bucket: "Rango de Días",
  ai_classification: "Clasificación IA",
  ai_risk_level: "Riesgo IA",
};

const metricLabels: Record<MetricType, string> = {
  count: "Cantidad",
  avg_dias: "Promedio Días",
  max_dias: "Máximo Días",
  sum_dias: "Total Días",
};

const chartTypeLabels: Record<ChartType, { label: string; icon: typeof BarChart3 }> = {
  bar: { label: "Barras", icon: BarChart3 },
  horizontal_bar: { label: "Barras H.", icon: BarChart3 },
  pie: { label: "Pastel", icon: PieChartIcon },
  donut: { label: "Dona", icon: PieChartIcon },
  line: { label: "Línea", icon: LineChartIcon },
  area: { label: "Área", icon: TrendingUp },
  radar: { label: "Radar", icon: TrendingUp },
  treemap: { label: "Treemap", icon: Maximize2 },
};

function getDiasBucket(dias: number): string {
  if (dias <= 30) return "0-30d";
  if (dias <= 90) return "31-90d";
  if (dias <= 180) return "91-180d";
  if (dias <= 365) return "181-365d";
  return ">365d";
}

function getFieldValue(ticket: SupportTicket & { client_name?: string }, field: DataField): string {
  if (field === "dias_bucket") return getDiasBucket(ticket.dias_antiguedad);
  if (field === "client_name") return (ticket as any).client_name || ticket.client_id;
  return (ticket as any)[field] || "Sin datos";
}

function computeMetric(tickets: SupportTicket[], metric: MetricType): number {
  if (tickets.length === 0) return 0;
  if (metric === "count") return tickets.length;
  if (metric === "avg_dias") return Math.round(tickets.reduce((s, t) => s + t.dias_antiguedad, 0) / tickets.length);
  if (metric === "max_dias") return Math.max(...tickets.map(t => t.dias_antiguedad));
  if (metric === "sum_dias") return tickets.reduce((s, t) => s + t.dias_antiguedad, 0);
  return tickets.length;
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-2xl px-3.5 py-2.5 text-xs">
      <div className="font-semibold text-popover-foreground mb-1">{payload[0]?.payload?.name || label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="font-mono font-bold text-foreground">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Treemap custom content
function TreemapContent(props: any) {
  const { x, y, width, height, name, value, index } = props;
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6}
        style={{ fill: COLORS[index % COLORS.length], stroke: "rgba(0,0,0,0.15)", strokeWidth: 1.5 }} />
      {width > 50 && height > 35 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="white" fontSize={11} fontWeight={700}>
            {name?.length > 15 ? name.slice(0, 13) + "…" : name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10}>
            {value}
          </text>
        </>
      )}
    </g>
  );
}

interface Props {
  tickets: (SupportTicket & { client_name?: string })[];
}

export function SupportChartBuilder({ tickets }: Props) {
  const [charts, setCharts] = useState<ChartConfig[]>([
    { id: "1", groupBy: "prioridad", chartType: "donut", metric: "count", title: "Por Prioridad" },
    { id: "2", groupBy: "estado", chartType: "bar", metric: "count", title: "Por Estado" },
    { id: "3", groupBy: "tipo", chartType: "treemap", metric: "count", title: "Por Tipo" },
    { id: "4", groupBy: "dias_bucket", chartType: "area", metric: "count", title: "Distribución de Antigüedad" },
  ]);

  const addChart = () => {
    setCharts(prev => [...prev, {
      id: Date.now().toString(), groupBy: "producto", chartType: "horizontal_bar", metric: "count", title: "Nuevo Gráfico"
    }]);
  };

  const removeChart = (id: string) => setCharts(prev => prev.filter(c => c.id !== id));
  const updateChart = (id: string, updates: Partial<ChartConfig>) => setCharts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

  const uniqueValues = useMemo(() => {
    const fields: DataField[] = ["estado", "prioridad", "tipo", "producto", "responsable", "client_name", "ai_classification", "ai_risk_level"];
    const result: Record<string, string[]> = {};
    fields.forEach(f => {
      const vals = new Set<string>();
      tickets.forEach(t => { const v = getFieldValue(t, f); if (v && v !== "Sin datos") vals.add(v); });
      result[f] = Array.from(vals).sort();
    });
    return result;
  }, [tickets]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-bold">Gráficos Personalizados</span>
          <Badge variant="secondary" className="text-[10px] font-mono">{charts.length}</Badge>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 rounded-lg" onClick={addChart}>
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {charts.map((chart, i) => (
            <motion.div key={chart.id}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 200 }}
              layout>
              <ChartPanel
                config={chart}
                tickets={tickets}
                uniqueValues={uniqueValues}
                onUpdate={(u) => updateChart(chart.id, u)}
                onRemove={() => removeChart(chart.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChartPanel({ config, tickets, uniqueValues, onUpdate, onRemove }: {
  config: ChartConfig;
  tickets: (SupportTicket & { client_name?: string })[];
  uniqueValues: Record<string, string[]>;
  onUpdate: (u: Partial<ChartConfig>) => void;
  onRemove: () => void;
}) {
  const data = useMemo(() => {
    let filtered = tickets;
    if (config.filterField && config.filterValue) {
      filtered = tickets.filter(t => getFieldValue(t, config.filterField!) === config.filterValue);
    }
    const groups: Record<string, SupportTicket[]> = {};
    filtered.forEach(t => {
      const val = getFieldValue(t, config.groupBy);
      if (!groups[val]) groups[val] = [];
      groups[val].push(t);
    });
    return Object.entries(groups)
      .map(([name, items]) => ({ name, value: computeMetric(items, config.metric), count: items.length }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [tickets, config]);

  const total = data.reduce((s, d) => s + d.value, 0);

  const renderChart = () => {
    switch (config.chartType) {
      case "pie":
      case "donut":
        return (
          <PieChart>
            <defs>
              {GRADIENTS.map(([c1, c2], i) => (
                <linearGradient key={i} id={`grad-${config.id}-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={c1} />
                  <stop offset="100%" stopColor={c2} />
                </linearGradient>
              ))}
            </defs>
            <Pie data={data} innerRadius={config.chartType === "donut" ? 55 : 0} outerRadius={85}
              dataKey="value" nameKey="name" strokeWidth={2} stroke="hsl(var(--card))"
              animationBegin={0} animationDuration={800}>
              {data.map((_, i) => <Cell key={i} fill={`url(#grad-${config.id}-${i % GRADIENTS.length})`} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {config.chartType === "donut" && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xl font-black">{total}</text>
            )}
          </PieChart>
        );
      case "horizontal_bar":
        return (
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <defs>
              <linearGradient id={`hbar-${config.id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={COLORS[0]} />
                <stop offset="100%" stopColor={COLORS[0] + "99"} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Bar dataKey="value" fill={`url(#hbar-${config.id})`} radius={[0, 8, 8, 0]} barSize={20} animationDuration={600} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted)/0.2)" }} />
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2.5}
              dot={{ r: 4, fill: COLORS[0], stroke: "hsl(var(--card))", strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: COLORS[0], strokeWidth: 2 }} animationDuration={800} />
            <Tooltip content={<CustomTooltip />} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`area-${config.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[3]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={COLORS[3]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Area type="monotone" dataKey="value" fill={`url(#area-${config.id})`} stroke={COLORS[3]} strokeWidth={2.5}
              dot={{ r: 3, fill: COLORS[3] }} animationDuration={800} />
            <Tooltip content={<CustomTooltip />} />
          </AreaChart>
        );
      case "radar":
        return (
          <RadarChart data={data} outerRadius={75}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis tick={{ fontSize: 8 }} />
            <Radar dataKey="value" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.3} strokeWidth={2} animationDuration={800} />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        );
      case "treemap":
        return (
          <Treemap data={data} dataKey="value" nameKey="name" stroke="none"
            content={<TreemapContent />} animationDuration={600} />
        );
      default: // bar
        return (
          <BarChart data={data}>
            <defs>
              {data.map((_, i) => (
                <linearGradient key={i} id={`bar-${config.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS[i % COLORS.length]} />
                  <stop offset="100%" stopColor={COLORS[i % COLORS.length] + "66"} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32} animationDuration={600}>
              {data.map((_, i) => <Cell key={i} fill={`url(#bar-${config.id}-${i})`} />)}
            </Bar>
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted)/0.15)" }} />
          </BarChart>
        );
    }
  };

  return (
    <Card className="overflow-hidden border-border/40 hover:border-border/80 transition-colors">
      <CardHeader className="pb-2 border-b border-border/20 bg-gradient-to-r from-card via-muted/10 to-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <input
              type="text"
              value={config.title || fieldLabels[config.groupBy]}
              onChange={e => onUpdate({ title: e.target.value })}
              className="bg-transparent border-none text-xs font-semibold focus:outline-none focus:ring-0 w-full truncate"
            />
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground/50 hover:text-destructive shrink-0" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <Select value={config.groupBy} onValueChange={v => onUpdate({ groupBy: v as DataField })}>
            <SelectTrigger className="h-7 w-[120px] text-[10px] rounded-lg bg-muted/30 border-border/30"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(fieldLabels) as DataField[]).map(f => (
                <SelectItem key={f} value={f} className="text-xs">{fieldLabels[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={config.metric} onValueChange={v => onUpdate({ metric: v as MetricType })}>
            <SelectTrigger className="h-7 w-[110px] text-[10px] rounded-lg bg-muted/30 border-border/30"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(metricLabels) as MetricType[]).map(m => (
                <SelectItem key={m} value={m} className="text-xs">{metricLabels[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-0.5 bg-muted/30 rounded-lg p-0.5 border border-border/20">
            {(Object.keys(chartTypeLabels) as ChartType[]).map(ct => {
              const { icon: Icon } = chartTypeLabels[ct];
              return (
                <button
                  key={ct}
                  title={chartTypeLabels[ct].label}
                  onClick={() => onUpdate({ chartType: ct })}
                  className={`h-6 w-6 rounded-md flex items-center justify-center transition-all ${
                    config.chartType === ct ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="h-3 w-3" />
                </button>
              );
            })}
          </div>

          <Select value={config.filterField || "none"} onValueChange={v => onUpdate({ filterField: v === "none" ? undefined : v as DataField, filterValue: undefined })}>
            <SelectTrigger className="h-7 w-[100px] text-[10px] rounded-lg bg-muted/30 border-border/30"><SelectValue placeholder="Filtro..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">Sin filtro</SelectItem>
              {(Object.keys(fieldLabels) as DataField[]).filter(f => f !== config.groupBy).map(f => (
                <SelectItem key={f} value={f} className="text-xs">{fieldLabels[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {config.filterField && (
            <Select value={config.filterValue || "all"} onValueChange={v => onUpdate({ filterValue: v === "all" ? undefined : v })}>
              <SelectTrigger className="h-7 w-[120px] text-[10px] rounded-lg bg-muted/30 border-border/30"><SelectValue placeholder="Valor..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos</SelectItem>
                {(uniqueValues[config.filterField] || []).map(v => (
                  <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-3">
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        {config.chartType !== "treemap" && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 px-1">
            {data.slice(0, 10).map((d, i) => (
              <span key={d.name} className="text-[10px] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shadow-sm" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-mono font-bold text-foreground">{d.value}</span>
              </span>
            ))}
            {data.length > 10 && <span className="text-[10px] text-muted-foreground">+{data.length - 10} más</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
