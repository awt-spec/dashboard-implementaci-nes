import { useSearchParams } from "react-router-dom";
import { clients, projectInfo } from "@/data/projectData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";
import type { ReportSection } from "@/components/dashboard/ShareReportDialog";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export default function Report() {
  const [params] = useSearchParams();
  const mode = params.get("mode") || "resumen";
  const clientId = params.get("client") || "";
  const sections = (params.get("sections") || "").split(",").filter(Boolean) as ReportSection[];
  const client = clients.find(c => c.id === clientId);

  if (!sections.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No se seleccionaron secciones para este reporte.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6 px-6">
        <h1 className="text-xl font-bold">SYSDE — {projectInfo.name}</h1>
        <p className="text-sm opacity-90 mt-1">
          {mode === "cliente" && client ? `Reporte: ${client.name}` : "Resumen Ejecutivo Consolidado"}
        </p>
        <p className="text-xs opacity-70 mt-0.5">Generado: {new Date().toLocaleDateString("es-CR")}</p>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {mode === "resumen" && <ResumenSections sections={sections} />}
        {mode === "cliente" && client && <ClientSections sections={sections} client={typeof client === "object" ? client : clients[0]} />}
      </main>

      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border mt-8">
        SYSDE — Reporte Confidencial · {projectInfo.company}
      </footer>
    </div>
  );
}

function ResumenSections({ sections }: { sections: ReportSection[] }) {
  const totalRevenue = clients.reduce((s, c) => s + c.financials.contractValue, 0);
  const totalBilled = clients.reduce((s, c) => s + c.financials.billed, 0);
  const totalPaid = clients.reduce((s, c) => s + c.financials.paid, 0);
  const avgProgress = Math.round(clients.reduce((s, c) => s + c.progress, 0) / clients.length);
  const totalRisks = clients.reduce((s, c) => s + c.risks.filter(r => r.status === "abierto").length, 0);
  const totalHoursEstimated = clients.reduce((s, c) => s + c.financials.hoursEstimated, 0);
  const totalHoursUsed = clients.reduce((s, c) => s + c.financials.hoursUsed, 0);

  const statusData = [
    { name: "Activos", value: clients.filter(c => c.status === "activo").length, color: "hsl(var(--success))" },
    { name: "En Riesgo", value: clients.filter(c => c.status === "en-riesgo").length, color: "hsl(var(--destructive))" },
    { name: "Pausados", value: clients.filter(c => c.status === "pausado").length, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0);

  const revenueByClient = clients.map(c => ({
    name: c.name.split(" ").slice(0, 2).join(" "),
    contrato: c.financials.contractValue / 1000,
    facturado: c.financials.billed / 1000,
    cobrado: c.financials.paid / 1000,
  }));

  const allMonths = [...new Set(clients.flatMap(c => c.financials.monthlyBreakdown.map(m => m.month)))];
  const monthOrder = ["Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar"];
  const sortedMonths = allMonths.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
  const monthlyTrend = sortedMonths.map(month => ({
    month,
    estimado: clients.reduce((s, c) => s + (c.financials.monthlyBreakdown.find(m => m.month === month)?.estimated || 0), 0) / 1000,
    real: clients.reduce((s, c) => s + (c.financials.monthlyBreakdown.find(m => m.month === month)?.actual || 0), 0) / 1000,
  }));

  const allTasks = clients.flatMap(c => c.tasks);
  const taskStatusData = [
    { name: "En Progreso", value: allTasks.filter(t => t.status === "en-progreso").length, color: "hsl(var(--info))" },
    { name: "Pendientes", value: allTasks.filter(t => t.status === "pendiente").length, color: "hsl(var(--warning))" },
    { name: "Bloqueadas", value: allTasks.filter(t => t.status === "bloqueada").length, color: "hsl(var(--destructive))" },
  ];

  return (
    <>
      {sections.includes("kpis") && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Clientes", value: clients.length },
            { label: "Progreso Promedio", value: `${avgProgress}%` },
            { label: "Ingresos", value: `$${(totalRevenue / 1000).toFixed(0)}K` },
            { label: "Cobrado", value: `$${(totalPaid / 1000).toFixed(0)}K` },
            { label: "Pendiente", value: `$${((totalBilled - totalPaid) / 1000).toFixed(0)}K` },
            { label: "Riesgos", value: totalRisks },
            { label: "Horas", value: `${totalHoursUsed}/${totalHoursEstimated}` },
            { label: "Tasa Cobro", value: `${Math.round((totalPaid / totalBilled) * 100)}%` },
          ].map(k => (
            <Card key={k.label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{k.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase mt-1">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sections.includes("status-chart") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Estado de Clientes</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                    {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("revenue-chart") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Ingresos por Cliente (Miles $)</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByClient} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v}K`]} />
                  <Bar dataKey="contrato" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Contrato" />
                  <Bar dataKey="facturado" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} name="Facturado" />
                  <Bar dataKey="cobrado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Cobrado" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("monthly-trend") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Tendencia Mensual (Miles $)</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(0)}K`]} />
                  <Area type="monotone" dataKey="estimado" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.15} strokeWidth={2} name="Estimado" />
                  <Area type="monotone" dataKey="real" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} name="Real" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("hours") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Utilización de Horas</h3>
            <div className="space-y-3">
              {clients.map(c => {
                const pct = Math.round((c.financials.hoursUsed / c.financials.hoursEstimated) * 100);
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{c.name.split(" ").slice(0, 2).join(" ")}</span>
                      <span className="text-muted-foreground">{c.financials.hoursUsed}/{c.financials.hoursEstimated}h ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("tasks") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Distribución de Tareas</h3>
            <div className="grid grid-cols-3 gap-3">
              {taskStatusData.map(d => (
                <div key={d.name} className="text-center p-3 rounded-lg border border-border">
                  <p className="text-2xl font-bold text-foreground">{d.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("alerts") && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Alertas Críticas</h3>
            <div className="space-y-2">
              {clients.flatMap(c =>
                c.risks.filter(r => r.status === "abierto" && r.impact === "alto").map(r => (
                  <div key={r.id + c.id} className="flex gap-2 p-2 rounded bg-card border border-border text-xs">
                    <div className="w-2 h-2 rounded-full bg-destructive mt-1 shrink-0" />
                    <div>
                      <span className="font-bold text-foreground">{c.name.split(" ").slice(0, 2).join(" ")}: </span>
                      <span className="text-muted-foreground">{r.description}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("progress-cards") && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Progreso por Cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients.map(c => (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <h4 className="text-sm font-bold text-foreground">{c.name}</h4>
                  <p className="text-xs text-muted-foreground mb-2">{c.country} · {c.industry}</p>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progreso</span>
                    <span className="font-bold text-foreground">{c.progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${c.progress}%` }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ClientSections({ sections, client }: { sections: ReportSection[]; client: typeof clients[0] }) {
  const statusLabels: Record<string, string> = { activo: "Activo", "en-riesgo": "En Riesgo", pausado: "Pausado", completado: "Completado" };

  return (
    <>
      {sections.includes("client-info") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Información General</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ["País", client.country], ["Industria", client.industry],
                ["Contacto", client.contactName], ["Email", client.contactEmail],
                ["Contrato", `${client.contractStart} → ${client.contractEnd}`],
                ["Estado", statusLabels[client.status] || client.status],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-muted-foreground">{k}</p>
                  <p className="font-medium text-foreground">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progreso General</span>
                <span className="font-bold text-foreground">{client.progress}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${client.progress}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("client-financials") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Resumen Financiero</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Contrato", value: `$${(client.financials.contractValue / 1000).toFixed(0)}K` },
                { label: "Facturado", value: `$${(client.financials.billed / 1000).toFixed(0)}K` },
                { label: "Cobrado", value: `$${(client.financials.paid / 1000).toFixed(0)}K` },
                { label: "Horas", value: `${client.financials.hoursUsed}/${client.financials.hoursEstimated}` },
              ].map(i => (
                <div key={i.label} className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-lg font-bold text-foreground">{i.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{i.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("client-phases") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Fases del Proyecto</h3>
            <div className="space-y-3">
              {client.phases.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="text-muted-foreground">{p.progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("client-deliverables") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Entregables</h3>
            <div className="space-y-2">
              {client.deliverables.map(d => (
                <div key={d.id} className="flex items-center justify-between p-2 rounded border border-border text-xs">
                  <span className="text-foreground font-medium flex-1 mr-2">{d.name}</span>
                  <Badge variant={d.status === "aprobado" ? "default" : d.status === "pendiente" ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                    {d.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("client-tasks") && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Tareas</h3>
            <div className="space-y-2">
              {client.tasks.map(t => (
                <div key={t.id} className="p-2 rounded border border-border text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={t.status === "bloqueada" ? "destructive" : "secondary"} className="text-[10px]">{t.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  </div>
                  <p className="text-foreground">{t.title}</p>
                  <p className="text-muted-foreground mt-0.5">{t.owner} · {t.dueDate}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.includes("client-risks") && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Riesgos</h3>
            <div className="space-y-2">
              {client.risks.map(r => (
                <div key={r.id} className="flex gap-2 p-2 rounded bg-card border border-border text-xs">
                  <Badge variant={r.impact === "alto" ? "destructive" : "secondary"} className="text-[10px] shrink-0">{r.impact}</Badge>
                  <div>
                    <p className="text-foreground">{r.description}</p>
                    {r.mitigation && <p className="text-primary text-[10px] mt-1">→ {r.mitigation}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
