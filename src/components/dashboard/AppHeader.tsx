import { type ReactNode } from "react";
import { AlertTriangle, Menu, Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandTrigger } from "@/components/common/CommandPalette";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

export interface AppHeaderProps {
  /** Título de la vista actual (depende de sección + rol). */
  title: string;
  /** Segunda línea. Describe la vista, no la app. */
  subtitle: string;
  onMobileMenu: () => void;
  onOpenPalette: () => void;
  /** Chip de vencidos. `null` cuando el rol no tiene acceso a la cola. */
  overdue: { count: number; scoped: boolean; onClick: () => void } | null;
  dark: boolean;
  onToggleDark: () => void;
  /**
   * Barra de acciones propia de cada vista (chips de visibilidad, chips de
   * estado, "+ Nuevo cliente"). Se dibuja entre el buscador y las alertas para
   * que las acciones de la vista queden cerca de su contenido.
   */
  actions?: ReactNode;
  /** Extras globales (hoy, compartir informe). */
  trailing?: ReactNode;
}

/**
 * Header de escritorio (§8): 56px, fondo de tarjeta, borde inferior de 1px.
 *
 * Estaba escrito dentro de Index.tsx. Se extrae porque el handoff pide que
 * cada vista inyecte su propia barra de acciones, y para eso el header necesita
 * ser un componente con un slot en vez de un bloque fijo.
 */
export function AppHeader({
  title,
  subtitle,
  onMobileMenu,
  onOpenPalette,
  overdue,
  dark,
  onToggleDark,
  actions,
  trailing,
}: AppHeaderProps) {
  return (
    <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Escritorio: colapsa/expande el sidebar. En móvil el sidebar no se
            usa — su lugar lo toma MobileNavDrawer. */}
        <SidebarTrigger className="hidden md:flex" />
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 shrink-0"
          onClick={onMobileMenu}
          aria-label="Abrir navegación"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-[13.5px] font-bold leading-tight text-foreground truncate">{title}</h1>
          <p className="text-[11.5px] text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {actions}

        <CommandTrigger onClick={onOpenPalette} className="hidden md:flex w-[190px] lg:w-[230px]" />
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={onOpenPalette}
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Pill global de "casos vencidos" — abre OverdueTicketsSheet con la
            lista COMPLETA (no solo bandeja). Si el user está en una vista de
            cliente específica, la sheet se scopea a ese cliente. */}
        {overdue && (
          <button
            onClick={overdue.onClick}
            className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-destructive/40 bg-destructive/[0.06] hover:bg-destructive/[0.12] text-destructive text-xs font-bold transition-colors group"
            title={`${overdue.count} casos vencidos · click para gestionar${overdue.scoped ? " (filtrado a este cliente)" : ""}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="tabular-nums">{overdue.count}</span>
            <span>vencido{overdue.count === 1 ? "" : "s"}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity hidden lg:inline">→ ver</span>
          </button>
        )}

        <NotificationBell />
        {trailing}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDark}
          aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
