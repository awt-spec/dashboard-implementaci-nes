/**
 * Helpers de presentación de un item de Scrum, compartidos por la tarjeta de
 * teléfono y la de escritorio. Viven fuera del archivo del componente porque
 * exportarlos desde ahí rompe el fast-refresh de Vite.
 */
import { normalizePrioridad } from "@/lib/ticketStatus";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";

export function itemInitials(name?: string | null): string {
  if (!name || name === "—") return "—";
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** "Fernando P." — el nombre completo no entra en el pie de la tarjeta. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

/** "14 mar" — cabe en el ancho de columna del tablero, "14/03/2026" no. */
export function fmtShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  // Fecha local, no UTC: en UTC-6 una tarea vencía la tarde anterior.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function priorityMeta(p?: string | null) {
  switch (normalizePrioridad(p)) {
    case "critica": return { border: "border-l-destructive", text: "text-destructive", label: "Crítica" };
    case "alta":    return { border: "border-l-destructive/70", text: "text-destructive/80", label: "Alta" };
    case "media":   return { border: "border-l-warning", text: "text-warning", label: "Media" };
    case "baja":    return { border: "border-l-muted-foreground/40", text: "text-muted-foreground", label: "Baja" };
    default:        return { border: "border-l-border", text: "text-muted-foreground", label: "—" };
  }
}

/** "SVA-1042" / "T-8831" — el id corto que el equipo usa para nombrar el item. */
export function shortId(item: ScrumWorkItem): string | null {
  const raw = item.raw as { ticket_id?: string; original_id?: string } | null;
  return raw?.ticket_id || raw?.original_id || null;
}

