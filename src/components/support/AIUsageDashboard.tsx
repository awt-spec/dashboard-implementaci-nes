import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Zap, Activity, CheckCircle2, AlertTriangle, Shield, Lock, Key, Server, Eye, FileText, TrendingUp, Hash } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllSupportTickets, useSupportClients } from "@/hooks/useSupportTickets";
import { useAIUsageLogs } from "@/hooks/useAIUsageLogs";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, AreaChart, Area, Line
} from "recharts";

const riskLabels: Record<string, string> = {
  critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo",
};

export function ClassificationTab() {
  const { data: tickets = [] } = useAllSupportTickets();
  const { data: clients = [] } = useSupportClients();

  const classified = useMemo(() => tickets.filter(t => t.ai_classification), [tickets]);
  const unclassified = useMemo(() => tickets.filter(t => !t.ai_classification), [tickets]);
  const classificationRate = tickets.length > 0 ? Math.round((classified.length / tickets.length) * 100) : 0;
  const criticalCount = classified.filter(t => t.ai_risk_level === "critical").length;

  // Categorías con ejemplos de tickets (top 3 por categoría)
  const categoriesWithSamples = useMemo(() => {
    const grouped = new Map<string, { count: number; samples: any[]; risk: Record<string, number> }>();
    classified.forEach(t => {
      const cat = t.ai_classification!;
      if (!grouped.has(cat)) grouped.set(cat, { count: 0, samples: [], risk: {} });
      const g = grouped.get(cat)!;
      g.count++;
      if (g.samples.length < 3) g.samples.push(t);
      if (t.ai_risk_level) g.risk[t.ai_risk_level] = (g.risk[t.ai_risk_level] || 0) + 1;
    });
    return Array.from(grouped.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [classified]);

  const categoryData = categoriesWithSamples.map(c => ({ name: c.name, value: c.count }));

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

  const topCategoryName = categoriesWithSamples[0]?.name || "—";
  const lowCoverageClients = clientCoverage.filter(c => c.pct < 50 && c.total > 2).length;

  const riskColor = (risk: string) => {
    if (risk === "critical") return "text-destructive bg-destructive/10 border-destructive/30";
    if (risk === "high")     return "text-warning bg-warning/10 border-warning/30";
    if (risk === "medium")   return "text-info bg-info/10 border-info/30";
    return "text-success bg-success/10 border-success/30";
  };

  return (
    <div className="space-y-5">
      {/* ════ HERO: cobertura visual + insight ════ */}
      <Card className="relative overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-card">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <CardContent className="p-5 relative">
          <div className="flex items-start gap-5 flex-wrap">
            {/* Donut cobertura */}
            <div className="relative h-28 w-28 shrink-0">
              <svg viewBox="0 0 100 100" className="transform -rotate-90 h-full w-full">
                <circle cx="50" cy="50" r="42" stroke="hsl(var(--muted))" strokeWidth="9" fill="none" />
                <motion.circle
                  cx="50" cy="50" r="42" stroke="hsl(280 60% 60%)" strokeWidth="9" fill="none" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - classificationRate / 100) }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black tabular-nums leading-none">{classificationRate}%</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">cobertura</span>
              </div>
            </div>

            {/* Stats + insight */}
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="h-4 w-4 text-violet-400" />
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-violet-400">Clasificación IA</p>
              </div>
              <p className="text-base font-bold leading-tight">
                {classified.length} de {tickets.length} casos analizados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {classificationRate >= 80 ? "Cobertura excelente" :
                 classificationRate >= 50 ? "Buena cobertura, podés clasificar el resto" :
                 unclassified.length > 0 ? `${unclassified.length} casos pendientes — clasificá desde Soporte` :
                 "Sin tickets para clasificar"}
              </p>

              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/40">
                <ClassKpi label="Categorías detectadas" value={categoriesWithSamples.length} sub={topCategoryName !== "—" ? `Top: ${topCategoryName}` : ""} />
                <ClassKpi label="Casos críticos" value={criticalCount} tone={criticalCount > 0 ? "text-destructive" : "text-muted-foreground"} sub={criticalCount > 0 ? "Atención inmediata" : "Sin críticos"} />
                <ClassKpi label="Sin clasificar" value={unclassified.length} tone={unclassified.length > 0 ? "text-warning" : "text-success"} sub={unclassified.length > 0 ? "Pendientes" : "Al día"} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerta si hay clientes con baja cobertura */}
      {lowCoverageClients > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <span><span className="font-bold">{lowCoverageClients} clientes</span> tienen menos del 50% de sus tickets clasificados. Andá a Soporte → "Clasificar con IA".</span>
        </div>
      )}

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

      {/* ════ TOP CATEGORÍAS con ejemplos reales ════ */}
      {categoriesWithSamples.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              Qué está detectando la IA
              <Badge variant="outline" className="text-[10px]">Top {Math.min(6, categoriesWithSamples.length)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoriesWithSamples.slice(0, 6).map(cat => {
              const total = cat.count;
              return (
                <div key={cat.name} className="rounded-xl border border-border p-3 bg-card hover:border-violet-500/30 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        <Brain className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <p className="text-sm font-bold truncate">{cat.name}</p>
                      <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">{total} casos</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(["critical", "high", "medium", "low"] as const).map(r => {
                        const n = cat.risk[r] || 0;
                        if (!n) return null;
                        return (
                          <Badge key={r} variant="outline" className={`text-[9px] h-5 ${riskColor(r)}`}>
                            {riskLabels[r]} {n}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1 pl-9">
                    {cat.samples.map(s => (
                      <div key={s.id} className="text-[11px] text-muted-foreground line-clamp-1">
                        <code className="font-mono text-foreground/70 mr-1">{s.ticket_id}</code>
                        <span>{s.asunto}</span>
                      </div>
                    ))}
                    {total > cat.samples.length && (
                      <p className="text-[10px] text-muted-foreground/70 italic">+{total - cat.samples.length} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function SecurityTab() {
  const { data: logs = [] } = useAIUsageLogs();

  // Métricas reales últimos 7 días
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentLogs = logs.filter(l => new Date(l.created_at).getTime() >= sevenDaysAgo);
  const totalCalls = recentLogs.length;
  const redactedCalls = recentLogs.filter(l => l.redacted === true).length;
  const rateLimited = recentLogs.filter(l => l.status === "rate_limited").length;
  const errors = recentLogs.filter(l => l.status === "error").length;
  const success = recentLogs.filter(l => l.status === "success").length;
  const uniqueUsers = new Set(recentLogs.map(l => l.user_id).filter(Boolean)).size;
  const redactionPct = totalCalls > 0 ? Math.round((redactedCalls / totalCalls) * 100) : 0;

  // Funciones con hardening aplicado (las que usamos en el smoke con redacted/rate_limit)
  const HARDENED_FNS = ["case-strategy-ai", "client-strategy-ai", "classify-tickets"];
  const hardenedCalls = recentLogs.filter(l => HARDENED_FNS.includes(l.function_name)).length;

  const securityFeatures = [
    {
      icon: Eye,
      title: "Redacción de campos confidenciales",
      description: "Tickets con is_confidential=true tienen sus campos sensibles (descripción, notas, credenciales, info de acceso) enmascarados antes de mandarse al LLM. La IA recibe ticket_id + asunto pero no ve datos sensibles.",
      isNew: true,
    },
    {
      icon: Hash,
      title: "Audit log con user_id + scope",
      description: "Cada llamada queda con user_id (quién), scope (qué recurso), redacted flag y status. Permite auditoría granular y queries de uso por usuario o cliente.",
      isNew: true,
    },
    {
      icon: Activity,
      title: "Rate limit por user/función",
      description: "20-30 llamadas/hora por usuario por función IA. Calls rechazados quedan registrados con status='rate_limited'. Anti-abuso y control de costos.",
      isNew: true,
    },
    {
      icon: Shield,
      title: "Rol cliente bloqueado",
      description: "Las funciones IA son herramientas internas. assertNotCliente() rechaza con 403 cualquier llamada de un usuario con rol cliente, antes de procesar el body.",
      isNew: true,
    },
    {
      icon: Lock,
      title: "Cifrado en tránsito (TLS 1.3)",
      description: "Todas las comunicaciones con la API de IA están cifradas con TLS 1.3.",
    },
    {
      icon: Key,
      title: "API Key en Supabase Secrets",
      description: "ANTHROPIC_API_KEY vive en el vault de Supabase Edge Functions. Nunca se expone al cliente ni queda en el repo.",
    },
    {
      icon: Server,
      title: "Procesamiento server-side",
      description: "Toda la lógica de IA corre en Edge Functions con JWT validado por requireAuth. Frontend nunca toca modelos directamente.",
    },
    {
      icon: FileText,
      title: "RLS endurecida en ai_usage_logs",
      description: "Los logs respetan RLS: cada user ve sólo los suyos; admin/PM ven todos. Cliente no ve nada.",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Seguridad & Cifrado de IA</h3>
          <p className="text-xs text-muted-foreground">Protección de datos + auditoría en todas las capas</p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-auto">
          <Lock className="h-3 w-3 mr-1" /> Hardening v2 activo
        </Badge>
      </div>

      {/* ════════ MÉTRICAS REALES — últimos 7 días ════════ */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-card">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-3">
            Auditoría · últimos 7 días
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SecurityKPI label="Llamadas IA" value={totalCalls} sub={`${uniqueUsers} usuarios distintos`} tone="text-foreground" />
            <SecurityKPI label="Con redacción" value={`${redactedCalls}`} sub={`${redactionPct}% del total · datos sensibles`} tone="text-emerald-400" />
            <SecurityKPI label="Rate limited" value={rateLimited} sub={rateLimited === 0 ? "Sin abuso" : "Bloqueos por exceso"} tone={rateLimited > 0 ? "text-warning" : "text-muted-foreground"} />
            <SecurityKPI label="Errores" value={errors} sub={`${success} success vs ${errors} error`} tone={errors > 0 ? "text-destructive" : "text-success"} />
          </div>
          {hardenedCalls > 0 && (
            <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border/40">
              <span className="font-semibold text-emerald-400">{hardenedCalls}</span> de las {totalCalls} llamadas pasaron por funciones con hardening v2 aplicado (case-strategy-ai, client-strategy-ai, classify-tickets).
            </p>
          )}
        </CardContent>
      </Card>

      {/* ════════ FEATURE CARDS ════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
        {securityFeatures.map((feat, i) => (
          <motion.div key={feat.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className={`h-full transition-colors ${feat.isNew ? "border-emerald-500/40 bg-emerald-500/[0.02]" : "border-border/60 hover:border-emerald-500/30"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${feat.isNew ? "bg-emerald-500/15" : "bg-emerald-500/10"}`}>
                    <feat.icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold">{feat.title}</p>
                      {feat.isNew ? (
                        <Badge className="bg-emerald-500 text-white text-[8px] px-1.5 py-0 h-4">NUEVO</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-400">ACTIVO</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{feat.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-blue-500/20">
        <CardContent className="p-4">
          <h4 className="text-xs font-bold mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-400" /> Flujo de Datos Seguro
          </h4>
          <div className="flex items-center justify-between text-[10px] gap-1">
            {[
              { label: "Frontend", sub: "Sin acceso a IA", color: "bg-blue-500/20 border-blue-500/30" },
              { label: "→", sub: "HTTPS/TLS 1.3", color: "" },
              { label: "Edge Function", sub: "Valida & cifra", color: "bg-violet-500/20 border-violet-500/30" },
              { label: "→", sub: "Bearer Token", color: "" },
              { label: "AI Gateway", sub: "Procesa & descarta", color: "bg-emerald-500/20 border-emerald-500/30" },
              { label: "→", sub: "Resultado", color: "" },
              { label: "Base de Datos", sub: "Logs cifrados", color: "bg-amber-500/20 border-amber-500/30" },
            ].map((step, i) => (
              <div key={i} className={`text-center ${step.color ? `px-3 py-2 rounded-lg border ${step.color}` : "text-muted-foreground font-mono text-lg"}`}>
                <p className="font-bold">{step.label}</p>
                {step.sub && step.color && <p className="text-muted-foreground mt-0.5">{step.sub}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClassKpi({ label, value, sub, tone = "text-foreground" }: { label: string; value: number | string; sub?: string; tone?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`text-xl font-black tabular-nums leading-tight mt-0.5 ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SecurityKPI({ label, value, sub, tone = "text-foreground" }: { label: string; value: number | string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">{label}</p>
      <p className={`text-2xl font-black tabular-nums leading-tight mt-0.5 truncate ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

export function UsageStatsTab() {
  const { data: logs = [], isLoading } = useAIUsageLogs();

  const stats = useMemo(() => {
    const totalCalls = logs.length;
    const successCalls = logs.filter(l => l.status === "success").length;
    const errorCalls = logs.filter(l => l.status === "error").length;
    const totalTokens = logs.reduce((s, l) => s + l.total_tokens, 0);
    const promptTokens = logs.reduce((s, l) => s + l.prompt_tokens, 0);
    const completionTokens = logs.reduce((s, l) => s + l.completion_tokens, 0);

    // By function
    const byFunction: Record<string, { calls: number; tokens: number; errors: number }> = {};
    logs.forEach(l => {
      if (!byFunction[l.function_name]) byFunction[l.function_name] = { calls: 0, tokens: 0, errors: 0 };
      byFunction[l.function_name].calls++;
      byFunction[l.function_name].tokens += l.total_tokens;
      if (l.status === "error") byFunction[l.function_name].errors++;
    });

    // By model
    const byModel: Record<string, { calls: number; tokens: number }> = {};
    logs.forEach(l => {
      if (!byModel[l.model]) byModel[l.model] = { calls: 0, tokens: 0 };
      byModel[l.model].calls++;
      byModel[l.model].tokens += l.total_tokens;
    });

    // By day (last 30 days)
    const byDay: Record<string, { calls: number; tokens: number }> = {};
    logs.forEach(l => {
      const day = l.created_at.split("T")[0];
      if (!byDay[day]) byDay[day] = { calls: 0, tokens: 0 };
      byDay[day].calls++;
      byDay[day].tokens += l.total_tokens;
    });
    const dailyData = Object.entries(byDay)
      .map(([date, v]) => ({ date: date.slice(5), ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return {
      totalCalls, successCalls, errorCalls, totalTokens, promptTokens, completionTokens,
      byFunction: Object.entries(byFunction).map(([name, v]) => ({ name: name === "classify-tickets" ? "Clasificar Tickets" : name === "summarize-transcript" ? "Resumir Transcripción" : name, ...v })),
      byModel: Object.entries(byModel).map(([name, v]) => ({ name: name.split("/")[1] || name, fullName: name, ...v })),
      dailyData,
      errorRate: totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 100) : 0,
      avgTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
    };
  }, [logs]);

  const kpis = [
    { label: "Total Llamadas", value: stats.totalCalls, icon: Activity, color: "text-blue-400" },
    { label: "Exitosas", value: stats.successCalls, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Errores", value: stats.errorCalls, icon: AlertTriangle, color: "text-destructive" },
    { label: "Total Tokens", value: stats.totalTokens.toLocaleString(), icon: Hash, color: "text-violet-400" },
    { label: "Prompt Tokens", value: stats.promptTokens.toLocaleString(), icon: FileText, color: "text-amber-400" },
    { label: "Prom. por Llamada", value: stats.avgTokensPerCall.toLocaleString(), icon: TrendingUp, color: "text-primary" },
  ];

  if (isLoading) {
    return <div className="text-xs text-muted-foreground text-center py-12">Cargando estadísticas de uso...</div>;
  }

  return (
    <div className="space-y-5">
      {/* KPIs — grid responsivo que NO se desborda en contenedores estrechos */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50 h-full">
              <CardContent className="p-3 flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-black text-foreground tabular-nums truncate ${
                    String(kpi.value).length > 6 ? "text-base" : "text-lg"
                  }`}>{kpi.value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-tight truncate">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Uso por Agente de IA</CardTitle></CardHeader>
          <CardContent>
            {stats.byFunction.length > 0 ? (
              <div className="space-y-3">
                {stats.byFunction.map((fn) => (
                  <div key={fn.name} className="p-3 rounded-lg border border-border/50 bg-muted/20 min-w-0">
                    {/* Header — título + badges en columnas seguras (sin colision) */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Brain className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold leading-snug break-words">{fn.name}</p>
                        {/* Badges DEBAJO del nombre — flex-wrap para no colisionar */}
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[9px] h-4 px-1.5 tabular-nums">
                            {fn.calls.toLocaleString()} llamada{fn.calls === 1 ? "" : "s"}
                          </Badge>
                          {fn.errors > 0 && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 tabular-nums">
                              {fn.errors} error{fn.errors === 1 ? "" : "es"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground tabular-nums">
                      <span><Hash className="h-3 w-3 inline mr-0.5" />{fn.tokens.toLocaleString()} tokens</span>
                      <span>Prom: {fn.calls > 0 ? Math.round(fn.tokens / fn.calls).toLocaleString() : 0} tokens/llamada</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">No hay datos de uso aún. Ejecuta la clasificación IA para generar datos.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Modelos Utilizados</CardTitle></CardHeader>
          <CardContent>
            {stats.byModel.length > 0 ? (
              <div className="space-y-3">
                {stats.byModel.map((m) => (
                  <div key={m.fullName} className="p-3 rounded-lg border border-border/50 bg-muted/20 min-w-0">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{m.name}</p>
                        <p className="text-[9px] text-muted-foreground font-mono truncate">{m.fullName}</p>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] h-4 px-1.5 shrink-0 tabular-nums">{m.calls} usos</Badge>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${stats.totalCalls > 0 ? (m.calls / stats.totalCalls) * 100 : 0}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{m.tokens.toLocaleString()} tokens consumidos</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">No hay datos de modelos aún</p>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.dailyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Uso Diario (Tokens & Llamadas)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="tokens" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="calls" orientation="right" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Area yAxisId="tokens" type="monotone" dataKey="tokens" stroke="hsl(280,60%,60%)" fill="hsl(280,60%,60%)" fillOpacity={0.1} name="Tokens" />
                  <Line yAxisId="calls" type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Llamadas" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas Llamadas a IA</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th className="text-left p-2 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Función</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Modelo</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Tokens</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 50).map(log => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-2 font-mono text-[10px]">{new Date(log.created_at).toLocaleString("es-CR", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-2">{log.function_name === "classify-tickets" ? "Clasificar" : log.function_name === "summarize-transcript" ? "Resumir" : log.function_name}</td>
                      <td className="p-2 font-mono text-[10px]">{log.model.split("/")[1] || log.model}</td>
                      <td className="p-2 text-center font-mono">{log.total_tokens.toLocaleString()}</td>
                      <td className="p-2 text-center">
                        <Badge variant={log.status === "success" ? "default" : "destructive"} className={`text-[8px] h-4 px-1.5 ${log.status === "success" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}`}>
                          {log.status === "success" ? "OK" : "Error"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AIUsageDashboard() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Brain className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold">Inteligencia Artificial — Estado, Seguridad y Uso</h2>
          <p className="text-xs text-muted-foreground">Clasificación, cifrado, tokens y agentes de IA</p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-auto">
          <CheckCircle2 className="h-3 w-3 mr-1" /> IA Activa
        </Badge>
      </div>

      <Tabs defaultValue="classification" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="classification" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" /> Clasificación</TabsTrigger>
          <TabsTrigger value="security" className="text-xs gap-1.5"><Shield className="h-3.5 w-3.5" /> Seguridad & Cifrado</TabsTrigger>
          <TabsTrigger value="usage" className="text-xs gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Tokens & Agentes</TabsTrigger>
        </TabsList>

        <TabsContent value="classification"><ClassificationTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="usage"><UsageStatsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
