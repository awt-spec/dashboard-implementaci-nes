import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { useSlaCompliance } from "@/hooks/useSlaCompliance";
import { useSlaHistory } from "@/hooks/useSlaHistory";
import { useClientContracts } from "@/hooks/useClientContracts";
import { useReopenRate90d } from "@/hooks/useTicketReopens";
import { isTicketClosed } from "@/lib/ticketStatus";
import type { Client, Deliverable, Phase, Risk } from "@/data/projectData";

/* ── Tonos ───────────────────────────────────────────────────────────── */

export type Tone = "red" | "amber" | "green" | "blue" | "grey";

/**
 * Única fuente de color del expediente. El tono SIEMPRE sale del umbral del
 * dato; ningún componente elige color por su cuenta.
 */
export function toneStyles(tone: Tone): { chip: string; text: string; bar: string; dot: string } {
  switch (tone) {
    case "red":   return { chip: "bg-destructive/10 text-destructive border-destructive/30", text: "text-destructive", bar: "bg-destructive", dot: "bg-destructive" };
    case "amber": return { chip: "bg-warning/10 text-warning border-warning/30", text: "text-warning", bar: "bg-warning", dot: "bg-warning" };
    case "green": return { chip: "bg-success/10 text-success border-success/30", text: "text-success", bar: "bg-success", dot: "bg-success" };
    case "blue":  return { chip: "bg-info/10 text-info border-info/30", text: "text-info", bar: "bg-info", dot: "bg-info" };
    default:      return { chip: "bg-muted text-muted-foreground border-border", text: "text-muted-foreground", bar: "bg-muted-foreground/40", dot: "bg-muted-foreground/40" };
  }
}

/** Más alto es mejor. */
export function toneAbove(value: number, good: number, warn: number): Tone {
  if (value >= good) return "green";
  if (value >= warn) return "amber";
  return "red";
}

/** Más alto es peor (consumo, riesgos, reincidencia). */
export function toneBelow(value: number, good: number, warn: number): Tone {
  if (value <= good) return "green";
  if (value <= warn) return "amber";
  return "red";
}

/* ── Tipos del expediente ────────────────────────────────────────────── */

export interface DossierKpi {
  label: string;
  value: string;
  /** Texto del chip de variación. `null` cuando no hay serie con qué comparar. */
  delta: string | null;
  tone: Tone;
  /** Serie de 7 puntos para el sparkline. Vacía = no se dibuja. */
  series: number[];
  title: string;
}

export interface DossierRow {
  id: string;
  c1: string;
  c2: string;
  c3: string;
  chip: string;
  chipTone: Tone;
  c5: string;
  valTone: Tone;
  rail: Tone;
}

export interface DossierTab {
  key: string;
  label: string;
  count: number;
  cols: [string, string, string, string, string];
  rows: DossierRow[];
}

export interface DossierBadge {
  label: string;
  tone: Tone;
}

export interface ClientDossier {
  isLoading: boolean;
  client: Client | null;
  /** 0-100 derivado; ver `healthScore`. */
  health: number;
  healthTone: Tone;
  badges: DossierBadge[];
  identityLine: string;
  supportSublabel: string;
  implSublabel: string;
  supportKpis: DossierKpi[];
  implKpis: DossierKpi[];
  supportTabs: DossierTab[];
  implTabs: DossierTab[];
  phases: Phase[];
  activePhaseIndex: number;
  hoursBySpecialist: { name: string; hours: number; pct: number }[];
  recurringTopics: { topic: string; count: number; tone: Tone }[];
  slaByMonth: { month: string; pct: number; tone: Tone }[];
  openRisks: Risk[];
  /** Módulo con más reincidencia; alimenta el cruce con el riesgo del proyecto. */
  reincidenceModule: string | null;
  reopenCount: number;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Clave AAAA-MM local (no UTC: en UTC-6 el día 1 caía en el mes anterior). */
function monthKey(d: Date): string {
  return d.toLocaleDateString("en-CA").slice(0, 7);
}

/** Etiqueta de las últimas N semanas, de la más vieja a la más nueva. */
function weekBuckets(n: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const now = Date.now();
  const week = 7 * 86400000;
  for (let i = n - 1; i >= 0; i--) out.push({ start: now - (i + 1) * week, end: now - i * week });
  return out;
}

function countInWeeks(dates: (string | null | undefined)[], n = 7): number[] {
  const buckets = weekBuckets(n);
  return buckets.map(b =>
    dates.filter(d => {
      if (!d) return false;
      const t = new Date(d).getTime();
      return !Number.isNaN(t) && t >= b.start && t < b.end;
    }).length,
  );
}

/** Variación entre los dos últimos puntos, en el formato del diseño. */
function deltaOf(series: number[], unit: string): string | null {
  if (series.length < 2) return null;
  const d = series[series.length - 1] - series[series.length - 2];
  if (d === 0) return `=${unit ? ` ${unit}` : ""}`;
  return `${d > 0 ? "+" : ""}${Math.round(d * 10) / 10}${unit ? ` ${unit}` : ""}`;
}

/**
 * Score de salud 0-100. NO es un campo de la base: se deriva de cuatro señales
 * que sí existen, con el peso indicado. Se documenta acá porque un número
 * redondo en un anillo grande invita a creer que alguien lo calculó formalmente.
 *
 *  40% cumplimiento de SLA · 25% casos vencidos · 20% riesgos altos abiertos
 *  15% avance del proyecto
 */
export function healthScore(input: {
  compliancePct: number | null;
  breached: number;
  openCases: number;
  highRisks: number;
  progress: number;
}): number {
  const sla = input.compliancePct ?? 100;
  const breachPenalty = input.openCases > 0 ? (input.breached / input.openCases) * 100 : 0;
  const riskPenalty = Math.min(100, input.highRisks * 25);
  const score =
    sla * 0.4 +
    (100 - breachPenalty) * 0.25 +
    (100 - riskPenalty) * 0.2 +
    input.progress * 0.15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ── Hook ────────────────────────────────────────────────────────────── */

/**
 * Todo el expediente en un solo hook, sobre datos vivos.
 *
 * NO usa src/data/projectData.ts: ese archivo exporta un array estático de
 * demo. Derivar la pantalla de ahí mostraría un cliente que nunca cambia
 * mientras el resto de la app lee de la base — datos hardcodeados igual, sólo
 * movidos de archivo.
 */
export function useClientDossier(clientId: string | undefined): ClientDossier {
  const { data: clients, isLoading: loadingClients } = useClients();
  const { data: tickets = [], isLoading: loadingTickets } = useSupportTickets(clientId);
  const { data: contracts = [] } = useClientContracts(clientId);
  const { data: slaHistory } = useSlaHistory(clientId);
  const { data: reopen } = useReopenRate90d(clientId);
  const { rows: slaRows, summary } = useSlaCompliance(clientId);

  return useMemo<ClientDossier>(() => {
    const client = (clients || []).find(c => c.id === clientId) ?? null;
    const isLoading = loadingClients || loadingTickets;

    if (!client) {
      return {
        isLoading, client: null, health: 0, healthTone: "grey", badges: [], identityLine: "",
        supportSublabel: "", implSublabel: "", supportKpis: [], implKpis: [],
        supportTabs: [], implTabs: [], phases: [], activePhaseIndex: -1,
        hoursBySpecialist: [], recurringTopics: [], slaByMonth: [], openRisks: [],
        reincidenceModule: null, reopenCount: 0,
      };
    }

    const open = tickets.filter(t => !isTicketClosed(t.estado));
    const closed = tickets.filter(t => isTicketClosed(t.estado));
    const rowById = new Map(slaRows.map(r => [r.ticket.id, r]));
    const openRisks = client.risks.filter(r => r.status === "abierto");
    const highRisks = openRisks.filter(r => r.impact === "alto");

    /* ── Salud ── */
    const health = healthScore({
      compliancePct: summary.compliancePct,
      breached: summary.breached,
      openCases: open.length,
      highRisks: highRisks.length,
      progress: client.progress,
    });
    const healthTone = toneAbove(health, 85, 70);

    /* ── Etiquetas de contexto: derivadas, no decorativas ── */
    const contract = contracts.find((c: { is_active?: boolean }) => c.is_active) ?? contracts[0];
    const badges: DossierBadge[] = [];
    if (contract?.end_date) {
      const days = Math.round((new Date(contract.end_date).getTime() - Date.now()) / 86400000);
      if (days >= 0 && days <= 90) badges.push({ label: `Renueva en ${days} d`, tone: days <= 30 ? "red" : "amber" });
    }
    // Módulo con más casos: el "producto" es lo más cercano a módulo en la tabla.
    const byModule = new Map<string, number>();
    for (const t of tickets) {
      const m = (t.producto || "").trim();
      if (m) byModule.set(m, (byModule.get(m) || 0) + 1);
    }
    const topModule = [...byModule.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topModule) badges.push({ label: `${topModule[0]} · ${topModule[1]} casos`, tone: "blue" });
    if (summary.breached > 0) badges.push({ label: `${summary.breached} fuera de SLA`, tone: "red" });

    /* ── Identidad ── */
    // Sin plan comercial, ARR, usuarios ni fecha de alta en el modelo: la línea
    // dice lo que se sabe en vez de rellenar con cifras inventadas.
    const identityLine = [
      client.country,
      client.industry,
      contract?.contract_type ? `contrato ${contract.contract_type}` : null,
      client.coreVersion ? `core ${client.coreVersion}` : null,
    ].filter(Boolean).join(" · ");

    /* ── Series para sparklines ── */
    const casesByWeek = countInWeeks(open.map(t => t.created_at));
    const closedByWeek = countInWeeks(closed.map(t => t.fecha_entrega));
    const slaSeries = (slaHistory?.by_month || [])
      .slice(-7)
      .map(m => (m.total > 0 ? Math.round((m.met / m.total) * 100) : 0));

    const includedHours = Number(contract?.included_hours) || 0;
    const thisMonth = monthKey(new Date());
    const usedHours = tickets.reduce((s, t) => {
      const k = (t.created_at || "").slice(0, 7);
      return k === thisMonth ? s + (Number(t.tiempo_cobrado_minutos) || 0) / 60 : s;
    }, 0);
    const hoursPct = includedHours > 0 ? Math.round((usedHours / includedHours) * 100) : null;

    /* ── KPIs de Soporte ── */
    const supportKpis: DossierKpi[] = [
      {
        label: "Cumplimiento SLA",
        value: summary.compliancePct === null ? "—" : `${summary.compliancePct}%`,
        delta: deltaOf(slaSeries, "pts"),
        tone: summary.compliancePct === null ? "grey" : toneAbove(summary.compliancePct, 90, 75),
        series: slaSeries,
        title: "No incumplidos sobre casos con SLA · meta 90%",
      },
      {
        label: "Horas del mes",
        value: includedHours > 0 ? `${Math.round(usedHours)} / ${includedHours}` : "—",
        delta: hoursPct === null ? null : `${hoursPct}%`,
        tone: hoursPct === null ? "grey" : toneBelow(hoursPct, 70, 90),
        series: [],
        title: includedHours > 0 ? "Horas facturables del mes contra la bolsa del contrato" : "El contrato no define horas incluidas",
      },
      {
        label: "Casos abiertos",
        value: String(open.length),
        delta: deltaOf(casesByWeek, "sem"),
        tone: toneBelow(summary.breached, 0, 2),
        series: casesByWeek,
        title: `${summary.breached} vencidos · ${summary.atRisk} en riesgo`,
      },
      {
        label: "Reincidencia",
        value: reopen ? String(reopen.reopens_90d) : "—",
        delta: reopen ? `${reopen.rate_pct}%` : null,
        tone: reopen ? toneBelow(reopen.rate_pct, 5, 15) : "grey",
        series: [],
        title: reopen ? `${reopen.reopens_90d} reaperturas sobre ${reopen.entregados_90d} entregados en 90 d` : "Sin datos",
      },
      {
        label: "Cerrados 7 sem",
        value: String(closedByWeek.reduce((a, b) => a + b, 0)),
        delta: deltaOf(closedByWeek, "sem"),
        tone: "blue",
        series: closedByWeek,
        title: "Casos entregados por semana",
      },
    ];

    /* ── Implementación ── */
    const phases = client.phases;
    const activePhaseIndex = phases.findIndex(p => p.status === "en-progreso");
    const delivered = client.deliverables.filter(d => d.status === "entregado" || d.status === "aprobado");
    const deliveredByWeek = countInWeeks(delivered.map((d: Deliverable) => d.deliveredDate));
    const doneTasks = client.tasks.filter(t => t.status === "completada").length;

    const implKpis: DossierKpi[] = [
      {
        label: "Avance global",
        value: `${client.progress}%`,
        delta: null,
        tone: toneAbove(client.progress, 80, 50),
        series: [],
        title: "Avance del proyecto",
      },
      {
        label: "Fase actual",
        value: activePhaseIndex >= 0 ? `${activePhaseIndex + 1} / ${phases.length}` : `— / ${phases.length}`,
        delta: activePhaseIndex >= 0 ? phases[activePhaseIndex].name : null,
        tone: activePhaseIndex >= 0 ? "blue" : "grey",
        series: [],
        title: "Fase en progreso",
      },
      {
        label: "Entregables",
        value: `${delivered.length} / ${client.deliverables.length}`,
        delta: deltaOf(deliveredByWeek, "sem"),
        tone: client.deliverables.length > 0
          ? toneAbove(Math.round((delivered.length / client.deliverables.length) * 100), 80, 50)
          : "grey",
        series: deliveredByWeek,
        title: "Entregados o aprobados sobre el total",
      },
      {
        label: "Tareas",
        value: `${doneTasks} / ${client.tasks.length}`,
        delta: null,
        tone: client.tasks.length > 0
          ? toneAbove(Math.round((doneTasks / client.tasks.length) * 100), 80, 50)
          : "grey",
        series: [],
        title: "Tareas completadas",
      },
      {
        label: "Riesgos abiertos",
        value: String(openRisks.length),
        delta: highRisks.length > 0 ? `${highRisks.length} altos` : null,
        tone: toneBelow(highRisks.length, 0, 1),
        series: [],
        title: `${highRisks.length} de impacto alto`,
      },
    ];

    /* ── Tablas ── */
    const slaChip = (id: string): { chip: string; tone: Tone } => {
      const r = rowById.get(id);
      if (!r) return { chip: "sin SLA", tone: "grey" };
      if (r.level === "breached") return { chip: "vencido", tone: "red" };
      if (r.level === "at_risk") return { chip: "en riesgo", tone: "amber" };
      return { chip: "en plazo", tone: "green" };
    };

    const supportTabs: DossierTab[] = [
      {
        key: "abiertos", label: "Casos abiertos", count: open.length,
        cols: ["Boleta", "Asunto", "Responsable", "Estado", "SLA"],
        rows: open.map(t => {
          const s = slaChip(t.id);
          const r = rowById.get(t.id);
          return {
            id: t.id, c1: t.ticket_id, c2: t.asunto, c3: t.responsable || "Sin asignar",
            chip: s.chip, chipTone: s.tone,
            c5: r ? `${r.pct}%` : "—", valTone: s.tone, rail: s.tone,
          };
        }),
      },
      {
        key: "historico", label: "Histórico", count: closed.length,
        cols: ["Boleta", "Asunto", "Responsable", "Estado", "Entrega"],
        rows: closed.slice(0, 100).map(t => ({
          id: t.id, c1: t.ticket_id, c2: t.asunto, c3: t.responsable || "Sin asignar",
          chip: t.estado, chipTone: "green" as Tone,
          c5: (t.fecha_entrega || "").slice(0, 10) || "—", valTone: "grey" as Tone, rail: "green" as Tone,
        })),
      },
      {
        key: "contactos", label: "Contactos", count: client.contactName ? 1 : 0,
        cols: ["Rol", "Nombre", "Contacto", "Área", "Último"],
        rows: client.contactName
          ? [{
              id: "contacto", c1: "Contacto", c2: client.contactName, c3: client.contactEmail || "—",
              chip: client.industry || "—", chipTone: "grey" as Tone,
              c5: "—", valTone: "grey" as Tone, rail: "blue" as Tone,
            }]
          : [],
      },
    ];

    const delivTone = (s: Deliverable["status"]): Tone =>
      s === "aprobado" || s === "entregado" ? "green" : s === "en-revision" ? "blue" : "grey";
    const riskTone = (i: Risk["impact"]): Tone => (i === "alto" ? "red" : i === "medio" ? "amber" : "grey");

    const implTabs: DossierTab[] = [
      {
        key: "entregables", label: "Entregables", count: client.deliverables.length,
        cols: ["Código", "Entregable", "Responsable", "Estado", "Fecha"],
        rows: client.deliverables.map(d => ({
          id: d.id, c1: d.id, c2: d.name, c3: d.responsibleParty || d.responsibleTeam || "—",
          chip: d.status, chipTone: delivTone(d.status),
          c5: (d.deliveredDate || d.dueDate || "").slice(0, 10) || "—",
          valTone: delivTone(d.status), rail: delivTone(d.status),
        })),
      },
      {
        key: "fases", label: "Fases", count: phases.length,
        cols: ["Fase", "Nombre", "Estado", "Avance", "Fin"],
        rows: phases.map((p, i) => ({
          id: `f${i}`, c1: `F${i + 1}`, c2: p.name, c3: p.epic || "—",
          chip: p.status, chipTone: p.status === "completado" ? "green" : p.status === "en-progreso" ? "amber" : "grey",
          c5: `${p.progress}%`,
          valTone: toneAbove(p.progress, 100, 1),
          rail: p.status === "completado" ? "green" : p.status === "en-progreso" ? "amber" : "grey",
        })),
      },
      {
        key: "riesgos", label: "Riesgos", count: openRisks.length,
        cols: ["Riesgo", "Descripción", "Mitigación", "Impacto", "Estado"],
        rows: openRisks.map(r => ({
          id: r.id, c1: r.id, c2: r.description, c3: r.mitigation || "—",
          chip: r.impact, chipTone: riskTone(r.impact),
          c5: r.status, valTone: riskTone(r.impact), rail: riskTone(r.impact),
        })),
      },
    ];

    /* ── Paneles laterales ── */
    const byOwner = new Map<string, number>();
    for (const t of tickets) {
      const k = (t.created_at || "").slice(0, 7);
      if (k !== thisMonth) continue;
      const who = (t.responsable || "").trim();
      if (!who) continue;
      byOwner.set(who, (byOwner.get(who) || 0) + (Number(t.tiempo_cobrado_minutos) || 0) / 60);
    }
    const maxOwner = Math.max(1, ...byOwner.values());
    const hoursBySpecialist = [...byOwner.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10, pct: Math.round((hours / maxOwner) * 100) }));

    const recurringTopics = [...byModule.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count, tone: toneBelow(count, 2, 5) }));

    const slaByMonth = (slaHistory?.by_month || []).slice(-6).map(m => {
      const pct = m.total > 0 ? Math.round((m.met / m.total) * 100) : 0;
      const [y, mm] = m.month.split("-");
      return { month: `${MES[Number(mm) - 1] ?? m.month} ${y?.slice(2) ?? ""}`.trim(), pct, tone: toneAbove(pct, 90, 75) };
    });

    return {
      isLoading, client, health, healthTone, badges, identityLine,
      supportSublabel: `${open.length} caso${open.length === 1 ? "" : "s"} abierto${open.length === 1 ? "" : "s"}`,
      implSublabel: activePhaseIndex >= 0
        ? `fase ${activePhaseIndex + 1} de ${phases.length}`
        : `${phases.length} fase${phases.length === 1 ? "" : "s"}`,
      supportKpis, implKpis, supportTabs, implTabs,
      phases, activePhaseIndex, hoursBySpecialist, recurringTopics, slaByMonth, openRisks,
      reincidenceModule: topModule?.[0] ?? null,
      reopenCount: reopen?.reopens_90d ?? 0,
    };
  }, [clients, clientId, tickets, contracts, slaHistory, reopen, slaRows, summary, loadingClients, loadingTickets]);
}
