import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileTabItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Contador rojo sobre el ícono; se oculta cuando es 0 o undefined. */
  badge?: number;
}

export interface MobileTabBarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  items: MobileTabItem[];
  className?: string;
}

/**
 * Barra de tabs inferior (solo móvil).
 * El contenedor principal de la página debe reservar ~64px + safe-area de
 * padding-bottom para que la barra no tape el último bloque de contenido.
 */
export function MobileTabBar({ activeSection, onSectionChange, items, className }: MobileTabBarProps) {
  // Tope duro de 5: más ítems no caben en 390px sin partir los labels.
  const visible = items.slice(0, 5);

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden",
        className,
      )}
      // env() no existe como utilidad de Tailwind: va inline.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        {visible.map((item) => {
          const isActive = activeSection === item.key;
          const badge = item.badge ?? 0;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSectionChange(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-start gap-1 px-0.5 pb-2 pt-[9px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "relative inline-flex items-center justify-center rounded-full px-3 py-[3px] transition-colors",
                  isActive && "bg-primary/10",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.4 : 2} />
                {badge > 0 && (
                  <span
                    className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[8.5px] font-bold tabular-nums text-destructive-foreground shadow-sm"
                    title={`${badge} pendiente${badge === 1 ? "" : "s"}`}
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-30 animate-ping" />
                    <span className="relative">{badge > 99 ? "99+" : badge}</span>
                  </span>
                )}
              </span>
              <span className="max-w-full truncate text-[9.5px] font-extrabold uppercase leading-none tracking-[0.06em]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
