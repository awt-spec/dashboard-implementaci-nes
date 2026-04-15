import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Zap, Activity, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useAllSupportTickets, useSupportClients } from "@/hooks/useSupportTickets";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(280,60%,60%)", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(150,60%,50%)", "hsl(220,70%,55%)"];

const riskLabels: Record<string, string> = {
  critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo",
};

export function AIUsageDashboard() {
  const { data: tickets = [] } = useAllSupportTickets();
  const { data: clients = [] } = useSupportClients();

  const classified = useMemo(() => tickets.filter(t => t.ai_classification), [tickets]);
  const unclassified = useMemo(() => tickets.filter(t => !t.ai_classification), [tickets]);

  const classificationRate = tickets.length > 0 ? Math.round((classified.length / tickets.length) * 100) : 0;

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    classified.forEach(t => { counts[t.ai_classification!] = (counts[t.ai_classification!] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [classified]);

  const riskData = useMemo(() => {
    const counts: Record<string, number> = {};
    classified.filter(t => t.ai_risk_level).forEach(t => {
      const label = riskLabels[t.ai_risk_level!] || t.ai_risk_level!;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [classified]);

  const clientCoverage = useMemo(() => {
    return clients.map(c => {
      const ct = tickets.filter(t => t.client_id === c.id);
      const cl = ct.filter(t => t.ai_classification);
      return {
        name: c.name.split(" ").slice(0, 2).join(" "),
        total: ct.length,
        classified: cl.length,
        pct: ct.length > 0 ? Math.round((cl.length / ct.length) * 100) : 0,
      };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [clients, tickets]);

  const kpis = [
    { label: "Total Tickets", value: tickets.length, icon: Activity, color: "text-blue-400" },
    { label: "IA Clasificados", value: classified.length, icon: Brain, color: "text-violet-400" },
    { label: "Sin Clasificar", value: unclassified.length, icon: Clock, color: "text-amber-400" },
    { label: "Cobertura IA", value: `${classificationRate}%`, icon: Sparkles, color: "text-emerald-400" },
    { label: "Categorías Detectadas", value: categoryData.length, icon: Zap, color: "text-primary" },
    { label: "Críticos IA", value: classified.filter(t => t.ai_risk_level === "critical").length, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Brain className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold">Inteligencia Artificial — Estado y Uso</h2>
          <p className="text-xs text-muted-foreground">Clasificación automática de tickets de soporte</p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-auto">
          <CheckCircle2 className="h-3 w-3 mr-1" /> IA Activa
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground">{kpi.value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-tight">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Categorías IA Detectadas</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9 }} />
                    <Bar dataKey="value" fill="hsl(280,60%,60%)" radius={[0, 4, 4, 0]} />
                    <Tooltip />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">No hay datos de clasificación aún</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución de Riesgo IA</CardTitle></CardHeader>
          <CardContent>
            {riskData.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskData} innerRadius={60} outerRadius={90} dataKey="value" strokeWidth={0}>
                      <Cell fill="rgb(239,68,68)" />
                      <Cell fill="rgb(249,115,22)" />
                      <Cell fill="rgb(234,179,8)" />
                      <Cell fill="rgb(34,197,94)" />
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} tickets`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-3 mt-2">
                  {riskData.map((d, i) => (
                    <span key={d.name} className="text-[10px] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: ["rgb(239,68,68)", "rgb(249,115,22)", "rgb(234,179,8)", "rgb(34,197,94)"][i] }} />
                      {d.name} ({d.value})
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">No hay datos de riesgo aún</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cobertura IA por Cliente</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-center p-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-center p-2 font-medium text-muted-foreground">Clasificados</th>
                  <th className="text-center p-2 font-medium text-muted-foreground">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {clientCoverage.map(c => (
                  <tr key={c.name} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2 text-center">{c.total}</td>
                    <td className="p-2 text-center">{c.classified}</td>
                    <td className="p-2 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${c.pct}%` }} />
                        </div>
                        <span className={`font-mono text-[10px] ${c.pct === 100 ? "text-emerald-400" : c.pct > 50 ? "text-violet-400" : "text-muted-foreground"}`}>
                          {c.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-violet-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm">¿Cómo funciona la IA?</p>
              <p className="text-muted-foreground">La clasificación IA analiza cada ticket y asigna automáticamente:</p>
              <ul className="text-muted-foreground space-y-0.5 ml-3">
                <li>• <strong>Categoría</strong>: Bug, Mejora, Configuración, Capacitación, etc.</li>
                <li>• <strong>Nivel de riesgo</strong>: Crítico, Alto, Medio, Bajo</li>
                <li>• <strong>Resumen ejecutivo</strong>: Una línea explicando el caso</li>
              </ul>
              <p className="text-muted-foreground mt-2">Para clasificar tickets, ve a <strong>Soporte → Clasificar con IA</strong> o usa la pestaña <strong>Clasificación IA</strong> en cada cliente.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
