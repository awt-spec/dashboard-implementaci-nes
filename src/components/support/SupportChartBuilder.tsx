import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, PieChartIcon, LineChart as LineChartIcon, Plus, X, Download } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, LineChart, Line, AreaChart, Area, ScatterChart, Scatter, ZAxis
} from "recharts";
import type { SupportTicket } from "@/hooks/useSupportTickets";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--warning))",
  "hsl(220,70%,55%)", "hsl(150,60%,50%)", "hsl(280,60%,60%)",
  "hsl(30,80%,55%)", "hsl(340,70%,55%)", "hsl(180,60%,45%)", "hsl(60,70%,50%)"
];

type ChartType = "bar" | "pie" | "line" | "area" | "scatter";
type DataField = "estado" | "prioridad" | "tipo" | "producto" | "responsable" | "client_name" | "dias_bucket" | "ai_classification" | "ai_risk_level";

interface ChartConfig {
  id: string;
  groupBy: DataField;
  chartType: ChartType;
  filterField?: DataField;
  filterValue?: string;
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

const chartIcons: Record<ChartType, typeof BarChart3> = {
  bar: BarChart3, pie: PieChartIcon, line: LineChartIcon, area: LineChartIcon, scatter: BarChart3,
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

interface Props {
  tickets: (SupportTicket & { client_name?: string })[];
}

export function SupportChartBuilder({ tickets }: Props) {
  const [charts, setCharts] = useState<ChartConfig[]>([
    { id: "1", groupBy: "tipo", chartType: "bar" },
  ]);

  const addChart = () => {
    setCharts(prev => [...prev, { id: Date.now().toString(), groupBy: "estado", chartType: "pie" }]);
  };

  const removeChart = (id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id));
  };

  const updateChart = (id: string, updates: Partial<ChartConfig>) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  // Unique values for filters
  const uniqueValues = useMemo(() => {
    const fields: DataField[] = ["estado", "prioridad", "tipo", "producto", "responsable", "client_name", "ai_classification", "ai_risk_level"];
    const result: Record<string, string[]> = {};
    fields.forEach(f => {
      const vals = new Set<string>();
      tickets.forEach(t => {
        const v = getFieldValue(t, f);
        if (v && v !== "Sin datos") vals.add(v);
      });
      result[f] = Array.from(vals).sort();
    });
    return result;
  }, [tickets]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Gráficos Personalizados</span>
          <Badge variant="outline" className="text-xs">{charts.length} gráficos</Badge>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={addChart}>
          <Plus className="h-3.5 w-3.5" /> Agregar Gráfico
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {charts.map(chart => (
          <ChartPanel
            key={chart.id}
            config={chart}
            tickets={tickets}
            uniqueValues={uniqueValues}
            onUpdate={(u) => updateChart(chart.id, u)}
            onRemove={() => removeChart(chart.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ChartPanel({
  config, tickets, uniqueValues, onUpdate, onRemove
}: {
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
    const counts: Record<string, number> = {};
    filtered.forEach(t => {
      const val = getFieldValue(t, config.groupBy);
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [tickets, config]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={config.groupBy} onValueChange={v => onUpdate({ groupBy: v as DataField })}>
              <SelectTrigger className="h-7 w-[130px] text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(fieldLabels) as DataField[]).map(f => (
                  <SelectItem key={f} value={f} className="text-xs">{fieldLabels[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-0.5">
              {(["bar", "pie", "line", "area"] as ChartType[]).map(ct => {
                const Icon = chartIcons[ct] || BarChart3;
                return (
                  <Button
                    key={ct}
                    size="icon"
                    variant={config.chartType === ct ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => onUpdate({ chartType: ct })}
                  >
                    <Icon className="h-3 w-3" />
                  </Button>
                );
              })}
            </div>

            <Select value={config.filterField || "none"} onValueChange={v => onUpdate({ filterField: v === "none" ? undefined : v as DataField, filterValue: undefined })}>
              <SelectTrigger className="h-7 w-[110px] text-[11px]"><SelectValue placeholder="Filtrar por..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">Sin filtro</SelectItem>
                {(Object.keys(fieldLabels) as DataField[]).filter(f => f !== config.groupBy).map(f => (
                  <SelectItem key={f} value={f} className="text-xs">{fieldLabels[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {config.filterField && (
              <Select value={config.filterValue || "all"} onValueChange={v => onUpdate({ filterValue: v === "all" ? undefined : v })}>
                <SelectTrigger className="h-7 w-[140px] text-[11px]"><SelectValue placeholder="Valor..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos</SelectItem>
                  {(uniqueValues[config.filterField] || []).map(v => (
                    <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            {config.chartType === "pie" ? (
              <PieChart>
                <Pie data={data} innerRadius={45} outerRadius={75} dataKey="value" nameKey="name" strokeWidth={0}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} casos`, ""]} />
              </PieChart>
            ) : config.chartType === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Tooltip />
              </LineChart>
            ) : config.chartType === "area" ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="value" fill="hsl(var(--primary)/0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Tooltip />
              </AreaChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
                <Tooltip />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {data.slice(0, 8).map((d, i) => (
            <span key={d.name} className="text-[9px] flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {d.name} ({d.value})
            </span>
          ))}
          {data.length > 8 && <span className="text-[9px] text-muted-foreground">+{data.length - 8} más</span>}
        </div>
      </CardContent>
    </Card>
  );
}
