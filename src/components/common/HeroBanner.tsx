import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Saludo por hora del día. Mismos cortes que HeroBuenosDias.tsx (<12 / <19)
 * para que ambos héroes digan lo mismo a la misma hora.
 */
export function greeting(date: Date = new Date()): "Buenos días" | "Buenas tardes" | "Buenas noches" {
  const h = date.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export interface HeroBannerProps {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  chips?: ReactNode;
  action?: ReactNode;
  /** true = variante móvil (rounded-2xl, padding 18px, título 22px). */
  compact?: boolean;
  children?: ReactNode;
  className?: string;
}

/** Hero ejecutivo: gradiente + orbe blur + eyebrow + título + subtítulo + chips + acción. */
export function HeroBanner({
  eyebrow,
  title,
  subtitle,
  chips,
  action,
  compact = false,
  children,
  className,
}: HeroBannerProps) {
  return (
    <section
      className={cn(
        // relative + overflow-hidden son necesarios para recortar el orbe decorativo
        "relative overflow-hidden border border-primary/20 bg-card",
        compact
          ? "rounded-2xl p-[18px] bg-gradient-to-br from-primary/[0.07] via-card to-card"
          : "rounded-3xl p-6 bg-gradient-to-br from-primary/[0.06] via-card to-card",
        className,
      )}
    >
      {/* Orbe decorativo: aria-hidden porque es puro adorno */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
            <h1
              className={cn(
                "mt-1 font-black text-foreground",
                compact ? "text-[22px] leading-tight tracking-[-0.02em]" : "text-[30px] leading-tight tracking-[-0.03em]",
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-[13.5px] leading-snug text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        {chips ? <div className="mt-4 flex flex-wrap items-center gap-2">{chips}</div> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </section>
  );
}
