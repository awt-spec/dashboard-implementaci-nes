import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tonos del sistema visual SVA ERP, mapeados a tokens de color del tema. */
export type Tone = "primary" | "success" | "warning" | "info" | "destructive" | "muted";

/**
 * Las clases van escritas completas (no interpoladas) porque Tailwind sólo
 * detecta nombres de clase literales al escanear el código.
 */
const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

const TONE_CHIP: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary border-primary/30",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  info: "bg-info/10 text-info border-info/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export interface KpiTileProps {
  icon: LucideIcon;
  value: ReactNode;
  label: ReactNode;
  tone?: Tone;
  /** true = escritorio (valor 18px); false/omitido = móvil (valor 24px). */
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

/** Tile compacto de KPI: tira de 8 en escritorio, grid 2x2 en móvil. */
export function KpiTile({
  icon: Icon,
  value,
  label,
  tone = "muted",
  compact = false,
  className,
  onClick,
}: KpiTileProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-3 text-center",
        onClick && "w-full transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Icon className={cn("mx-auto mb-1.5 h-3.5 w-3.5 shrink-0", TONE_TEXT[tone])} />
      <p
        className={cn(
          "font-bold leading-none tabular-nums text-foreground",
          compact ? "text-[18px]" : "text-[24px] font-extrabold",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
    </Comp>
  );
}

export interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

/** Micro-label: 10px / 700 / uppercase / tracking .08em / muted. */
export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p className={cn("text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export interface StatusChipProps {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

/** Chip de estado del hero: h-7, rounded-full, ícono 12px. */
export function StatusChip({ children, icon: Icon, tone = "muted", className }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold leading-none whitespace-nowrap",
        TONE_CHIP[tone],
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" /> : null}
      {children}
    </span>
  );
}
