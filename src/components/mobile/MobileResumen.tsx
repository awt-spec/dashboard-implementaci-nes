import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Package, TimerOff, Users } from "lucide-react";
import { KpiTile, SectionLabel } from "@/components/common/StatCard";
import type { Tone } from "@/components/common/StatCard";
import { MobileCard, MobileHeader, MobileScreen, ProgressBar } from "@/components/mobile/MobileScreen";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useApproveQuote, useQuotes } from "@/hooks/useQuotes";
import { useSLASummary } from "@/hooks/useSLASummary";
import { useAllScrumWorkItems, useAllSprints } from "@/hooks/useTeamScrum";
import type { Client } from "@/data/projectData";
import { cn } from "@/lib/utils";

export interface MobileResumenProps {
  onMenu?: () => void;
  onNavigate?: (section: string) => void;
}

/** Tono por estado de cliente; se usa tanto para el punto como para la barra. */
const STATUS_TONE: Record<Client["status"], Tone> = {
  activo: "success",
  "en-riesgo": "destructive",
  pausado: "warning",
  completado: "info",
};

const TONE_DOT: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

/** "Martes 19 de agosto · turno de la mañana" */
function buildSubtitle(now: Date): string {
  const fecha = now.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hora = now.getHours();
  const turno = hora < 12 ? "turno de la mañana" : hora < 19 ? "turno de la tarde" : "turno de la noche";
  return `${fecha.charAt(0).toUpperCase()}${fecha.slice(1)} · ${turno}`;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Intl revienta si el código de moneda del registro no es ISO-4217 válido.
    return `${Math.round(amount).toLocaleString("es-CR")} ${currency}`.trim();
  }
}

export function MobileResumen({ onMenu, onNavigate }: MobileResumenProps) {
  const { data: clients } = useClients();
  const { data: sla } = useSLASummary();
  // "sent" = enviada al cliente y esperando decisión: es la cola de aprobación.
  const { data: quotes } = useQuotes({ status: "sent" });
  const { data: sprints } = useAllSprints();
  const { data: workItems } = useAllScrumWorkItems();

  // Aprobación REAL: la misma mutación que usa el escritorio (QuoteApprovalCard).
  // Al invalidarse ["quotes"] la cotización deja de tener status "sent" y sale
  // sola de esta cola, por eso no hace falta guardar un estado "aprobada".
  const { role } = useAuth();
  const approveQuote = useApproveQuote();
  // Sólo el rol cliente aprueba; para el staff la cola es informativa.
  const canApprove = role === "cliente";
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setPendingId(id);
    try {
      await approveQuote.mutateAsync(id);
      toast.success("Cotización aprobada. El equipo SVA continuará con la ejecución.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al aprobar");
    } finally {
      setPendingId(null);
    }
  };

  const subtitle = useMemo(() => buildSubtitle(new Date()), []);

  const kpis = useMemo(() => {
    const list = clients ?? [];
    const activos = list.filter((c) => c.status === "activo").length;
    const enRiesgo = list.filter((c) => c.status === "en-riesgo").length;
    const entregablesPendientes = list.reduce(
      (acc, c) => acc + c.deliverables.filter((d) => d.status === "pendiente").length,
      0,
    );
    return { activos, enRiesgo, entregablesPendientes };
  }, [clients]);

  const semaforo = useMemo(() => {
    const list = clients ?? [];
    return list
      .map((c) => ({
        id: c.id,
        name: c.name,
        tone: STATUS_TONE[c.status] ?? "muted",
        open: c.tasks.filter((t) => t.status !== "completada").length,
        progress: c.progress,
      }))
      // Primero lo que duele: en-riesgo arriba, luego más tareas abiertas.
      .sort((a, b) => {
        const risk = Number(b.tone === "destructive") - Number(a.tone === "destructive");
        return risk !== 0 ? risk : b.open - a.open;
      });
  }, [clients]);

  const pendingQuotes = quotes ?? [];

  const sprintPulse = useMemo(() => {
    const active = (sprints ?? []).find((s) => s.status === "activo");
    if (!active) return null;
    const items = (workItems ?? []).filter((i) => i.sprint_id === active.id);
    const estimated = items.filter((i) => i.wsjf > 0);
    const avgWsjf = estimated.length
      ? (estimated.reduce((acc, i) => acc + i.wsjf, 0) / estimated.length).toFixed(1)
      : "—";
    return {
      name: active.name,
      total: items.length,
      inProgress: items.filter((i) => i.scrum_status === "in_progress").length,
      avgWsjf,
      unestimated: items.filter((i) => !i.story_points && !i.effort).length,
    };
  }, [sprints, workItems]);

  return (
    <MobileScreen
      className="px-3.5 py-3"
      header={<MobileHeader title="Resumen Ejecutivo" subtitle={subtitle} onMenu={onMenu} />}
    >
      {/* 1. KPIs 2x2 */}
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <KpiTile icon={Users} tone="success" value={kpis.activos} label="Clientes activos" />
        <KpiTile icon={AlertTriangle} tone="destructive" value={kpis.enRiesgo} label="En riesgo" />
        <KpiTile icon={TimerOff} tone="warning" value={sla?.overdue ?? 0} label="Casos vencidos" />
        <KpiTile icon={Package} tone="info" value={kpis.entregablesPendientes} label="Entregables pend." />
      </div>

      {/* 2. Semáforo de clientes */}
      <MobileCard className="p-[13px]">
        <div className="mb-3 flex items-center gap-2">
          <SectionLabel>Semáforo de clientes</SectionLabel>
          {semaforo.length > 5 && (
            <button
              type="button"
              onClick={() => onNavigate?.("clients")}
              className="ml-auto text-[11px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Ver los {semaforo.length} →
            </button>
          )}
        </div>

        {semaforo.length === 0 ? (
          <p className="text-[11.5px] font-medium text-muted-foreground">Sin datos</p>
        ) : (
          <div className="flex flex-col gap-[11px]">
            {semaforo.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-[9px]">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[c.tone])} />
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-foreground">
                  {c.name}
                </span>
                <span className="shrink-0 text-[10.5px] font-medium tabular-nums text-muted-foreground">
                  {c.open} abiertos
                </span>
                <ProgressBar value={c.progress} tone={c.tone} className="w-[52px] shrink-0" />
                <span className="w-[30px] shrink-0 text-right text-[10.5px] font-bold tabular-nums text-foreground">
                  {Math.round(c.progress)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </MobileCard>

      {/* 3. Decisiones que te esperan */}
      <div className="flex flex-col gap-[9px]">
        <div className="flex items-baseline gap-2">
          <SectionLabel>Decisiones que te esperan</SectionLabel>
          {pendingQuotes.length > 0 && (
            <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted-foreground">
              {pendingQuotes.length} en cola
            </span>
          )}
        </div>

        {pendingQuotes.length === 0 ? (
          <MobileCard className="p-[13px]">
            <p className="text-[11.5px] font-medium text-muted-foreground">
              Sin cotizaciones pendientes de aprobación.
            </p>
          </MobileCard>
        ) : (
          pendingQuotes.map((q) => {
            const isPending = pendingId === q.id;
            return (
              <MobileCard key={q.id} className="p-[13px]">
                <div className="mb-[7px] flex items-center gap-[7px]">
                  <span className="inline-flex h-5 items-center rounded-lg border border-primary/30 bg-primary/10 px-2 text-[9.5px] font-bold uppercase tracking-[0.06em] text-primary">
                    Cotización
                  </span>
                  <span className="truncate text-[9.5px] font-bold tabular-nums text-muted-foreground">
                    {q.quote_number}
                  </span>
                  <span className="ml-auto shrink-0 text-[11.5px] font-bold tabular-nums text-foreground">
                    {formatAmount(q.total_amount, q.currency)}
                  </span>
                </div>

                <p className="mb-2.5 text-[12.5px] font-semibold leading-[1.35] text-foreground">
                  {q.title}
                </p>

                {/* Aprobar una cotización es una decisión DEL CLIENTE, no de
                    SYSDE: la migración del módulo lo define así ("UPDATE cliente:
                    solo cambiar status de sent → approved/rejected") y en
                    escritorio la acción vive únicamente en ClientPortalDashboard.
                    El RLS no lo impide — "Staff updates quotes" deja a admin/pm/
                    gerente_soporte cambiar status sin restricción — así que el
                    límite tiene que ponerlo la UI: para staff esto es información
                    (qué espera respuesta del cliente), no una acción.
                    No existe sección de cotizaciones en móvil, así que tampoco
                    hay "Ver detalle": un botón sin destino deja la pantalla en
                    blanco. */}
                {!canApprove ? (
                  <p className="text-[10.5px] font-medium text-muted-foreground">
                    Esperando aprobación del cliente
                  </p>
                ) : (
                <div className="flex gap-[7px]">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void handleApprove(q.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-bold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      isPending && "opacity-60",
                    )}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        Aprobando…
                      </>
                    ) : (
                      "Aprobar"
                    )}
                  </button>
                </div>
                )}
              </MobileCard>
            );
          })
        )}
      </div>

      {/* 4. Sprint — pulso (se omite si no hay sprint activo) */}
      {sprintPulse && (
        <MobileCard className="p-[13px]">
          <SectionLabel className="mb-[11px]">{sprintPulse.name} — pulso</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <KpiTile compact icon={Package} tone="primary" value={sprintPulse.total} label="Items" className="bg-muted/40" />
            <KpiTile compact icon={TimerOff} tone="warning" value={sprintPulse.inProgress} label="En progreso" className="bg-muted/40" />
            <KpiTile compact icon={CheckCircle2} tone="info" value={sprintPulse.avgWsjf} label="WSJF prom." className="bg-muted/40" />
            <KpiTile compact icon={AlertTriangle} tone="destructive" value={sprintPulse.unestimated} label="Sin estimar" className="bg-muted/40" />
          </div>
        </MobileCard>
      )}
    </MobileScreen>
  );
}
