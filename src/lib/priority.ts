/**
 * Escala visual de prioridad de tareas, en tokens del sistema.
 *
 * Antes cada superficie del colaborador la reimplementaba con colores crudos de
 * Tailwind y valores distintos: el tablero usaba bg-red-500/10, el detalle
 * bg-red-50 y la tarjeta de foco bg-red-500/5, así que la misma prioridad se
 * veía diferente en cada pantalla. Las variantes claras (red-50, amber-100,
 * slate-200) además quedaban casi blancas en modo oscuro, porque son colores
 * fijos y no tokens.
 */
export const PRIORITY_TONE: Record<string, string> = {
  critica: "bg-destructive/15 text-destructive border-destructive/40",
  crítica: "bg-destructive/15 text-destructive border-destructive/40",
  alta: "bg-destructive/10 text-destructive border-destructive/30",
  media: "bg-warning/10 text-warning border-warning/30",
  baja: "bg-muted text-muted-foreground border-border",
};

/** Clases de la prioridad dada; cae en "media" si viene vacía o desconocida. */
export function priorityTone(priority?: string | null): string {
  return PRIORITY_TONE[(priority || "").toLowerCase()] ?? PRIORITY_TONE.media;
}
