import { cn } from "@/lib/utils";

export interface MobileOverdueStripProps {
  count: number;
  onClick: () => void;
  className?: string;
}

/**
 * Franja full-width de casos vencidos, justo debajo del header móvil.
 * Va oculta en escritorio (el sidebar ya muestra el badge); para forzarla
 * visible en desktop basta pasar `className="md:flex"`.
 */
export function MobileOverdueStrip({ count, onClick, className }: MobileOverdueStripProps) {
  if (count <= 0) return null;
  const plural = count === 1 ? "" : "s";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 border-y border-destructive/25 bg-destructive/[0.07] px-4 py-2 text-left",
        "transition-colors active:bg-destructive/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-destructive/40",
        "md:hidden",
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
      </span>
      <span className="text-[11.5px] font-semibold leading-none text-destructive">
        <span className="tabular-nums">{count}</span> caso{plural} vencido{plural}
      </span>
      <span className="ml-auto text-[11.5px] font-semibold leading-none text-destructive">Ver &rarr;</span>
    </button>
  );
}
