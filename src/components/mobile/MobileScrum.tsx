import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SectionLabel, StatusChip } from "@/components/common/StatCard";
import type { Tone } from "@/components/common/StatCard";
import {
  FilterChips,
  MobileCard,
  MobileHeader,
  MobileScreen,
  ProgressBar,
} from "@/components/mobile/MobileScreen";
import type { FilterChipOption } from "@/components/mobile/MobileScreen";
import { useClients } from "@/hooks/useClients";
import { useAllScrumWorkItems, useAllSprints } from "@/hooks/useTeamScrum";
import type { ScrumWorkItem, UnifiedSprint } from "@/hooks/useTeamScrum";
import { priorityTone } from "@/lib/priority";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Columnas del tablero                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Las 5 columnas REALES de `scrum_status` (mismas que TeamScrumDashboard).
 * El modelo no tiene una columna "QA": la etapa equivalente en este flujo es
 * "En Sprint", así que se usa esa en vez de inventar un estado inexistente.
 */
const SCRUM_COLUMNS: { key: string; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "ready", label: "Listo" },
  { key: "in_progress", label: "En Progreso" },
  { key: "in_sprint", label: "En Sprint" },
  { key: "done", label: "Hecho" },
];

/** La columna "Hecho" acumula miles de items históricos: en móvil se corta. */
const MAX_ITEMS = 30;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Fecha ISO 'YYYY-MM-DD' a medianoche LOCAL: `new Date(iso)` la lee como UTC
 *  y en zonas negativas devuelve el día anterior. */
function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Días calendario entre hoy y la fecha (negativo = vencida). */
function daysUntil(iso: string | null): number | null {
  const date = parseDate(iso);
  if (!date) return null;
  return Math.round((date.getTime() - startOfToday().getTime()) / 86400000);
}

const DATE_FMT = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short" });

function formatDate(iso: string | null): string | null {
  const date = parseDate(iso);
  return date ? DATE_FMT.format(date) : null;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/** Nombre corto para el pie de la tarjeta: nombre + inicial del apellido. */
function shortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Sin asignar";
  if (words.length === 1) return words[0];
  return `${words[0]} ${words[1][0].toUpperCase()}.`;
}

/**
 * priorityTone() entrega fondo + texto + borde en una sola cadena; para el
 * filete izquierdo sólo sirve la clase de borde, así que se extrae de ahí en
 * vez de duplicar el mapa de prioridades.
 */
function priorityBorder(priority?: string | null): string {
  return priorityTone(priority).split(" ").find((c) => c.startsWith("border-")) ?? "border-border";
}

/** Identificador visible real: ticket_id en soporte, hu_code/original_id en tareas. */
function shortId(item: ScrumWorkItem): string | null {
  const raw = item.raw ?? {};
  if (item.source === "ticket") return raw.ticket_id ?? null;
  if (raw.hu_code) return String(raw.hu_code);
  return raw.original_id != null ? `#${raw.original_id}` : null;
}

/** Tono del chip de días restantes del sprint. */
function daysTone(days: number): Tone {
  if (days < 0) return "destructive";
  if (days <= 2) return "destructive";
  if (days <= 5) return "warning";
  return "info";
}

type LoadLevel = "sobrecargado" | "saludable" | "subutilizado";

/** Mismos umbrales que la vista de escritorio (>7 / >=3 / >=1). */
function loadLevel(count: number): LoadLevel {
  if (count > 7) return "sobrecargado";
  if (count >= 3) return "saludable";
  return "subutilizado";
}

const LOAD_TONE: Record<LoadLevel, Tone> = {
  sobrecargado: "destructive",
  saludable: "success",
  subutilizado: "warning",
};

const LOAD_TEXT: Record<LoadLevel, string> = {
  sobrecargado: "text-destructive",
  saludable: "text-success",
  subutilizado: "text-warning",
};

/* -------------------------------------------------------------------------- */
/* Micro-chip                                                                 */
/* -------------------------------------------------------------------------- */

function MicroChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg border px-1.5 py-0.5 text-[9.5px] font-bold uppercase leading-none tracking-[0.04em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tarjeta de sprint                                                          */
/* -------------------------------------------------------------------------- */

interface SprintCardProps {
  sprint: UnifiedSprint;
  clientName: string | null;
  done: number;
  total: number;
}

function SprintCard({ sprint, clientName, done, total }: SprintCardProps) {
  const days = daysUntil(sprint.end_date);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <MobileCard className="p-[13px]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold leading-tight text-foreground">
            {clientName ?? "Sin cliente"}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-muted-foreground">
            {sprint.name}
          </p>
        </div>
        {days !== null ? (
          <StatusChip tone={daysTone(days)} className="h-6 shrink-0 px-2 text-[10.5px]">
            <span className="tabular-nums">{days < 0 ? `${Math.abs(days)}d vencido` : `${days}d`}</span>
          </StatusChip>
        ) : (
          <StatusChip tone="muted" className="h-6 shrink-0 px-2 text-[10.5px]">
            Sin fecha
          </StatusChip>
        )}
      </div>

      <div className="mt-[9px] flex items-center gap-2">
        <ProgressBar value={pct} tone={pct >= 100 ? "success" : "primary"} className="flex-1" />
        <span className="shrink-0 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
      </div>
    </MobileCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Tarjeta de item                                                            */
/* -------------------------------------------------------------------------- */

function ItemCard({ item }: { item: ScrumWorkItem }) {
  const id = shortId(item);
  const due = formatDate(item.due_date);
  const dueDays = daysUntil(item.due_date);
  const isOverdue = dueDays !== null && dueDays < 0;
  const estimated = item.story_points != null && item.story_points > 0;
  const hasWsjf = item.wsjf > 0;
  const owner = item.owner && item.owner !== "—" ? item.owner : null;

  return (
    <MobileCard className={cn("border-l-[3px] p-[11px] pl-[13px]", priorityBorder(item.priority))}>
      <div className="flex items-center gap-1.5">
        <MicroChip
          className={
            item.source === "ticket"
              ? "border-info/30 bg-info/10 text-info"
              : "border-primary/30 bg-primary/10 text-primary"
          }
        >
          {item.source === "ticket" ? "Soporte" : "Impl."}
        </MicroChip>
        {id ? (
          <span className="truncate text-[9.5px] font-bold tabular-nums text-muted-foreground">{id}</span>
        ) : null}
        <MicroChip
          className={
            item.visibility === "interna"
              ? "border-border bg-muted text-muted-foreground"
              : "border-success/30 bg-success/10 text-success"
          }
        >
          {item.visibility === "interna" ? "Interna" : "Externa"}
        </MicroChip>
        <span
          className={cn(
            "ml-auto shrink-0 text-[10px] font-semibold tabular-nums",
            isOverdue ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {due ?? "Sin fecha"}
        </span>
      </div>

      <p className="mt-1.5 text-[12.5px] font-semibold leading-[1.35] text-foreground">{item.title}</p>

      <div className="mt-2 flex items-center gap-[7px]">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
          {owner ? initials(owner) : "—"}
        </span>
        <span className="min-w-0 truncate text-[10.5px] font-medium text-muted-foreground">
          {owner ? shortName(owner) : "Sin asignar"}
        </span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-muted-foreground">
          {estimated ? `${item.story_points} SP` : "sin estimar"}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-destructive">
          {hasWsjf ? `WSJF ${item.wsjf.toFixed(1)}` : "WSJF —"}
        </span>
      </div>
    </MobileCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Pantalla                                                                   */
/* -------------------------------------------------------------------------- */

export interface MobileScrumProps {
  onMenu?: () => void;
}

export function MobileScrum({ onMenu }: MobileScrumProps) {
  const { data: items, isLoading } = useAllScrumWorkItems();
  const { data: sprints } = useAllSprints();
  const { data: clients } = useClients();
  const [column, setColumn] = useState("backlog");

  const allItems = useMemo(() => items ?? [], [items]);
  const allSprints = useMemo(() => sprints ?? [], [sprints]);

  const clientNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients ?? []) map.set(c.id, c.name);
    return map;
  }, [clients]);

  const activeSprints = useMemo(
    () => allSprints.filter((s) => s.status === "activo"),
    [allSprints],
  );

  /** Conteo hechos/total por sprint activo, en items (no en puntos: hay items
   *  sin estimar y el denominador en puntos quedaría incompleto). */
  const sprintProgress = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const s of activeSprints) map.set(s.id, { done: 0, total: 0 });
    for (const item of allItems) {
      if (!item.sprint_id) continue;
      const entry = map.get(item.sprint_id);
      if (!entry) continue;
      entry.total += 1;
      if (item.scrum_status === "done") entry.done += 1;
    }
    return map;
  }, [activeSprints, allItems]);

  const columnCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of allItems) {
      const key = item.scrum_status || "backlog";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [allItems]);

  const options: FilterChipOption[] = useMemo(
    () =>
      SCRUM_COLUMNS.map((col) => ({
        key: col.key,
        label: col.label,
        count: columnCounts.get(col.key) ?? 0,
      })),
    [columnCounts],
  );

  const columnItems = useMemo(
    () =>
      allItems
        .filter((i) => (i.scrum_status || "backlog") === column)
        .sort((a, b) => b.wsjf - a.wsjf),
    [allItems, column],
  );

  const visibleItems = columnItems.slice(0, MAX_ITEMS);
  const currentColumn = SCRUM_COLUMNS.find((c) => c.key === column) ?? SCRUM_COLUMNS[0];

  /** Carga = items abiertos (no "done") por responsable, igual que escritorio. */
  const workload = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of allItems) {
      if (!item.owner || item.owner === "—") continue;
      if (item.scrum_status === "done") continue;
      map.set(item.owner, (map.get(item.owner) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, level: loadLevel(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [allItems]);

  const maxLoad = workload.length > 0 ? workload[0].value : 0;

  return (
    <MobileScreen
      className="px-3.5 pt-3"
      header={
        <MobileHeader
          title="Equipo Scrum"
          subtitle={
            isLoading
              ? "Cargando…"
              : `${activeSprints.length} ${activeSprints.length === 1 ? "sprint activo" : "sprints activos"} · WSJF vigente`
          }
          onMenu={onMenu}
        />
      }
    >
      <SectionLabel className="shrink-0">Sprints activos</SectionLabel>

      {activeSprints.length === 0 ? (
        <MobileCard className="p-4">
          <p className="text-[12.5px] font-medium text-muted-foreground">
            {isLoading ? "Cargando…" : "Sin sprints activos"}
          </p>
        </MobileCard>
      ) : (
        activeSprints.map((sprint) => {
          const progress = sprintProgress.get(sprint.id) ?? { done: 0, total: 0 };
          return (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              clientName={clientNames.get(sprint.client_id) ?? null}
              done={progress.done}
              total={progress.total}
            />
          );
        })
      )}

      <FilterChips options={options} value={column} onChange={setColumn} className="shrink-0" />

      <div className="flex shrink-0 items-baseline gap-2">
        <SectionLabel>
          {currentColumn.label} · <span className="tabular-nums">{columnItems.length}</span>
        </SectionLabel>
        <span className="ml-auto text-[11px] font-semibold text-destructive">Ordenado por WSJF</span>
      </div>

      {visibleItems.length === 0 ? (
        <MobileCard className="p-4">
          <p className="text-[12.5px] font-medium text-muted-foreground">
            {isLoading ? "Cargando…" : "Sin datos"}
          </p>
        </MobileCard>
      ) : (
        visibleItems.map((item) => <ItemCard key={`${item.source}-${item.id}`} item={item} />)
      )}

      {columnItems.length > visibleItems.length ? (
        <p className="text-center text-[10.5px] font-medium text-muted-foreground">
          Mostrando <span className="tabular-nums">{visibleItems.length}</span> de{" "}
          <span className="tabular-nums">{columnItems.length}</span>
        </p>
      ) : null}

      {/* Sin responsables asignados no hay carga que mostrar: se omite la
          tarjeta en vez de dibujar barras en cero. */}
      {workload.length > 0 ? (
        <MobileCard className="p-[13px]">
          <SectionLabel className="mb-[11px]">Carga del equipo</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {workload.map((w) => (
              <div key={w.name} className="flex items-center gap-[9px]">
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-foreground">
                  {shortName(w.name)}
                </span>
                <span className={cn("shrink-0 text-[10px] font-semibold", LOAD_TEXT[w.level])}>
                  {w.level}
                </span>
                <ProgressBar
                  value={maxLoad > 0 ? (w.value / maxLoad) * 100 : 0}
                  tone={LOAD_TONE[w.level]}
                  className="w-14 shrink-0"
                />
                <span className="w-4 shrink-0 text-right text-[10.5px] font-bold tabular-nums text-foreground">
                  {w.value}
                </span>
              </div>
            ))}
          </div>
        </MobileCard>
      ) : null}
    </MobileScreen>
  );
}

export default MobileScrum;
