import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import type { Tone } from "@/components/common/StatCard";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* MobileScreen                                                               */
/* -------------------------------------------------------------------------- */

export interface MobileScreenProps {
  /** Cabecera fija de la pantalla; normalmente un <MobileHeader />. */
  header?: ReactNode;
  children?: ReactNode;
  /** Clases extra para el área scrolleable (no para la raíz). */
  className?: string;
}

/**
 * Contenedor de pantalla móvil (§7 del handoff).
 *
 * El par flex-1 + min-h-0 es obligatorio en la raíz y en el área scrolleable:
 * por defecto un ítem flex tiene min-height:auto y no puede encogerse por
 * debajo de su contenido, así que sin min-h-0 la lista desborda el teléfono en
 * vez de scrollear dentro de su caja.
 *
 * El shell ya reserva pb-24 para la tab bar fija: no agregar padding inferior.
 */
export function MobileScreen({ header, children, className }: MobileScreenProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {header ? <div className="shrink-0">{header}</div> : null}
      <div className={cn("flex-1 min-h-0 overflow-y-auto", className)}>
        <div className="flex flex-col gap-[13px]">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MobileHeader                                                               */
/* -------------------------------------------------------------------------- */

export interface MobileHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Si se pasa, se muestra el botón hamburguesa a la izquierda. */
  onMenu?: () => void;
  /** Slot libre alineado a la derecha (chips, contadores, acciones). */
  right?: ReactNode;
  className?: string;
}

/** Header móvil de 56px (h-14): hamburguesa + título/subtítulo + slot derecho. */
export function MobileHeader({ title, subtitle, onMenu, right, className }: MobileHeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3",
        className,
      )}
    >
      {onMenu ? (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Abrir navegación"
          // 44px es el mínimo táctil accesible; el ícono mide 18px y el resto
          // es área de toque, por eso el -ml-2 recupera la alineación visual.
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold leading-tight text-foreground">{title}</p>
        {subtitle ? (
          <p className="truncate text-[10.5px] font-medium leading-tight text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>

      {right ? <div className="flex shrink-0 items-center gap-1.5">{right}</div> : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* MobileCard                                                                 */
/* -------------------------------------------------------------------------- */

export interface MobileCardProps {
  children?: ReactNode;
  className?: string;
  /** Si se pasa, la tarjeta se renderiza como <button> (accesible por teclado). */
  onClick?: () => void;
  /** Estado seleccionado: borde primario + anillo tenue. */
  selected?: boolean;
}

/** Tarjeta base: bg-card, borde 1px, radio 12px. */
export function MobileCard({ children, className, onClick, selected }: MobileCardProps) {
  const base = cn(
    "rounded-xl border bg-card",
    selected ? "border-primary ring-1 ring-primary/10" : "border-border",
    className,
  );

  // Una tarjeta clickeable debe ser <button> real: <div onClick> no es
  // enfocable ni activable con teclado.
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          base,
          "w-full text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {children}
      </button>
    );
  }

  return <div className={base}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* ProgressBar                                                                */
/* -------------------------------------------------------------------------- */

const TONE_FILL: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

export interface ProgressBarProps {
  /** Porcentaje 0-100; se clampa (los datos traen valores fuera de rango). */
  value: number;
  tone?: Tone;
  className?: string;
}

/** Barra de progreso de 6px, track bg-muted. */
export function ProgressBar({ value, tone = "primary", className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", TONE_FILL[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* FilterChips                                                                */
/* -------------------------------------------------------------------------- */

export interface FilterChipOption {
  key: string;
  label: string;
  count?: number;
}

export interface FilterChipsProps {
  options: FilterChipOption[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

/** Tira horizontal de chips de filtro: h-7, radio 8px, scroll-x sin scrollbar. */
export function FilterChips({ options, value, onChange, className }: FilterChipsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden",
        className,
      )}
      // scrollbarWidth no tiene utilidad de Tailwind en esta versión: va inline.
      style={{ scrollbarWidth: "none" }}
    >
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-[11.5px] font-semibold leading-none transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="tabular-nums opacity-70">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
