import { useMemo, useState } from "react";
import type { Client, Deliverable, Phase, Risk } from "@/data/projectData";
import { useClients } from "@/hooks/useClients";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { SectionLabel } from "@/components/common/StatCard";
import type { Tone } from "@/components/common/StatCard";
import {
  FilterChips,
  MobileCard,
  MobileHeader,
  MobileScreen,
  ProgressBar,
} from "@/components/mobile/MobileScreen";
import type { FilterChipOption } from "@/components/mobile/MobileScreen";
import { priorityTone } from "@/lib/priority";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Mapas de estado                                                            */
/* -------------------------------------------------------------------------- */

/** Chip sólido de estado del cliente; mismas etiquetas que la vista de escritorio. */
const CLIENT_STATUS: Record<Client["status"], { label: string; className: string }> = {
  activo: { label: "Activo", className: "bg-success text-success-foreground" },
  "en-riesgo": { label: "En Riesgo", className: "bg-destructive text-destructive-foreground" },
  completado: { label: "Completado", className: "bg-info text-info-foreground" },
  pausado: { label: "Pausado", className: "bg-muted text-muted-foreground" },
};

const DELIVERABLE_STATUS: Record<Deliverable["status"], { label: string; className: string }> = {
  entregado: { label: "Entregado", className: "bg-success/10 text-success border-success/30" },
  aprobado: { label: "Aprobado", className: "bg-info/10 text-info border-info/30" },
  "en-revision": { label: "En revisión", className: "bg-warning/10 text-warning border-warning/30" },
  pendiente: { label: "Pendiente", className: "bg-muted text-muted-foreground border-border" },
};

/** El modelo de riesgo usa alto/medio/bajo; priorityTone() habla alta/media/baja. */
const IMPACT_LABEL: Record<Risk["impact"], { label: string; priority: string }> = {
  alto: { label: "Alto", priority: "alta" },
  medio: { label: "Medio", priority: "media" },
  bajo: { label: "Bajo", priority: "baja" },
};

const FILTERS: { key: string; label: string; status?: Client["status"] }[] = [
  { key: "todos", label: "Todos" },
  { key: "activo", label: "Activo", status: "activo" },
  { key: "en-riesgo", label: "En riesgo", status: "en-riesgo" },
  { key: "completado", label: "Completado", status: "completado" },
  { key: "pausado", label: "Pausado", status: "pausado" },
];

type DetailTab = "fases" | "entregables" | "riesgos";

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "fases", label: "Fases" },
  { key: "entregables", label: "Entregables" },
  { key: "riesgos", label: "Riesgos" },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function openRisks(client: Client): Risk[] {
  return client.risks.filter((r) => r.status === "abierto");
}

/** Tono de la barra de una fase: verde si terminó, ámbar si avanza, gris si no arrancó. */
function phaseTone(progress: number): Tone {
  if (progress >= 100) return "success";
  if (progress > 0) return "warning";
  return "muted";
}

/* -------------------------------------------------------------------------- */
/* Pantalla                                                                   */
/* -------------------------------------------------------------------------- */

export interface MobileClientesProps {
  onMenu?: () => void;
}

export function MobileClientes({ onMenu }: MobileClientesProps) {
  const { data: clients, isLoading } = useClients();
  const { data: tickets } = useSupportTickets();
  const [filter, setFilter] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("fases");

  const all = useMemo(() => clients ?? [], [clients]);
  const atRisk = all.filter((c) => c.status === "en-riesgo").length;

  /** Tickets por cliente. Mientras la consulta no resuelve, el pie omite el dato
   *  en vez de mostrar "0 tickets", que sería un número falso. */
  const ticketsByClient = useMemo(() => {
    if (!tickets) return null;
    const map = new Map<string, number>();
    for (const t of tickets) map.set(t.client_id, (map.get(t.client_id) ?? 0) + 1);
    return map;
  }, [tickets]);

  const options: FilterChipOption[] = useMemo(
    () =>
      FILTERS.map((f) => ({
        key: f.key,
        label: f.label,
        count: f.status ? all.filter((c) => c.status === f.status).length : all.length,
      })),
    [all],
  );

  const visible = useMemo(() => {
    const status = FILTERS.find((f) => f.key === filter)?.status;
    return status ? all.filter((c) => c.status === status) : all;
  }, [all, filter]);

  const selected = visible.find((c) => c.id === selectedId) ?? null;

  const selectClient = (client: Client) => {
    const isSame = client.id === selectedId;
    setSelectedId(isSame ? null : client.id);
    // Al cambiar de cliente el detalle vuelve siempre al primer tab.
    if (!isSame) setTab("fases");
  };

  return (
    <MobileScreen
      className="px-3.5 pt-3"
      header={
        <MobileHeader
          title="Clientes"
          subtitle={
            isLoading
              ? "Cargando…"
              : `${all.length} ${all.length === 1 ? "proyecto" : "proyectos"} · ${atRisk} en riesgo`
          }
          onMenu={onMenu}
        />
      }
    >
      <FilterChips options={options} value={filter} onChange={setFilter} className="shrink-0" />

      {!isLoading && visible.length === 0 ? (
        <MobileCard className="p-4">
          <p className="text-[12.5px] font-medium text-muted-foreground">Sin datos</p>
        </MobileCard>
      ) : null}

      {visible.map((client) => {
        const status = CLIENT_STATUS[client.status];
        const ticketCount = ticketsByClient?.get(client.id);
        const risks = openRisks(client).length;
        return (
          <div key={client.id} className="flex flex-col gap-[13px]">
            <MobileCard
              onClick={() => selectClient(client)}
              selected={client.id === selectedId}
              className="p-[13px]"
            >
              <div className="mb-[11px] flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[13px] font-extrabold text-primary">
                  {initials(client.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-tight text-foreground">
                    {client.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10.5px] font-medium leading-tight text-muted-foreground">
                    {[client.country, client.industry].filter(Boolean).join(" · ") || "Sin datos"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold leading-none",
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              </div>

              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Progreso</span>
                <span className="text-[11.5px] font-bold tabular-nums text-foreground">
                  {client.progress}%
                </span>
              </div>
              <ProgressBar value={client.progress} />

              {/* El pie va en UNA sola línea: nowrap + truncate a la izquierda para
                  que en 390px nunca envuelva ni empuje el conteo de riesgos. */}
              <div className="mt-[9px] flex items-center justify-between gap-2 whitespace-nowrap">
                <span className="min-w-0 truncate text-[10.5px] font-medium text-muted-foreground">
                  <span className="tabular-nums">{client.tasks.length}</span> tareas
                  {ticketCount !== undefined ? (
                    <>
                      {" · "}
                      <span className="tabular-nums">{ticketCount}</span> tickets
                    </>
                  ) : null}
                </span>
                <span className="shrink-0 text-[10.5px] font-semibold text-warning">
                  <span className="tabular-nums">{risks}</span> riesgos
                </span>
              </div>
            </MobileCard>

            {selected && selected.id === client.id ? (
              <ClientDetailCard client={selected} tab={tab} onTab={setTab} />
            ) : null}
          </div>
        );
      })}
    </MobileScreen>
  );
}

/* -------------------------------------------------------------------------- */
/* Detalle: Fases / Entregables / Riesgos                                     */
/* -------------------------------------------------------------------------- */

function ClientDetailCard({
  client,
  tab,
  onTab,
}: {
  client: Client;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
}) {
  const risks = openRisks(client);

  return (
    <MobileCard className="p-[13px]">
      <div className="mb-[11px] flex items-center gap-2">
        <SectionLabel className="min-w-0 truncate">{client.name}</SectionLabel>
        {client.contactName ? (
          <span className="ml-auto shrink-0 truncate text-[10.5px] font-medium text-muted-foreground">
            {client.contactName}
          </span>
        ) : null}
      </div>

      <div className="mb-3 flex gap-1.5">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              "inline-flex h-7 flex-1 items-center justify-center rounded-lg px-2 text-[11px] font-semibold leading-none transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fases" ? <PhaseList phases={client.phases} /> : null}
      {tab === "entregables" ? <DeliverableList deliverables={client.deliverables} /> : null}
      {tab === "riesgos" ? <RiskList risks={risks} /> : null}
    </MobileCard>
  );
}

function EmptyRow({ children }: { children: string }) {
  return <p className="text-[11.5px] font-medium text-muted-foreground">{children}</p>;
}

function PhaseList({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) return <EmptyRow>Sin datos</EmptyRow>;
  return (
    <div className="flex flex-col gap-2.5">
      {phases.map((phase, i) => (
        <div key={`${phase.name}-${i}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-[11.5px] font-medium text-foreground">
              {phase.name}
            </span>
            <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-muted-foreground">
              {phase.progress}%
            </span>
          </div>
          <ProgressBar value={phase.progress} tone={phaseTone(phase.progress)} />
        </div>
      ))}
    </div>
  );
}

function DeliverableList({ deliverables }: { deliverables: Deliverable[] }) {
  if (deliverables.length === 0) return <EmptyRow>Sin datos</EmptyRow>;
  return (
    <div className="flex flex-col gap-2.5">
      {deliverables.map((d) => {
        const status = DELIVERABLE_STATUS[d.status];
        return (
          <div key={d.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-[11.5px] font-medium leading-snug text-foreground">
              {d.name}
            </span>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg border px-2 py-0.5 text-[10px] font-semibold leading-none",
                status.className,
              )}
            >
              {status.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RiskList({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return <EmptyRow>Sin riesgos abiertos</EmptyRow>;
  return (
    <div className="flex flex-col gap-2.5">
      {risks.map((r) => {
        const impact = IMPACT_LABEL[r.impact];
        return (
          <div key={r.id} className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-[11.5px] font-medium leading-snug text-foreground">
              {r.description}
            </span>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg border px-2 py-0.5 text-[10px] font-semibold leading-none",
                priorityTone(impact.priority),
              )}
            >
              {impact.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default MobileClientes;
