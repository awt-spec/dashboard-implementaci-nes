import { useCallback, useEffect, useState } from "react";
import {
  Clock3, AlertTriangle, Search, CornerDownLeft,
  type LucideIcon,
} from "lucide-react";

import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useMyPermissions } from "@/hooks/usePermissions";
import { useSLASummary } from "@/hooks/useSLASummary";
import { cn } from "@/lib/utils";
import { visibleNav } from "@/lib/navigation";

interface ActionEntry {
  id: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  /** Sección a la que navega la acción; el padre resuelve el resto. */
  section: string;
  keywords: string[];
  /**
   * Evento global que se despacha además de navegar. Lo usa "ver vencidos" para
   * abrir la OverdueTicketsSheet igual que el pill del header y la franja móvil;
   * sin esto la acción aterrizaba en Soporte sin abrir nada.
   */
  event?: string;
}

// Las acciones navegan a secciones REALES del dashboard (no hay rutas propias);
// la pantalla destino es la que expone el formulario/listado correspondiente.
const ACTIONS: ActionEntry[] = [
  { id: "log-hours", title: "Registrar horas", hint: "Equipo Scrum", icon: Clock3, section: "team-scrum", keywords: ["horas", "timesheet", "tiempo", "imputar"] },
  { id: "overdue", title: "Ver casos vencidos", hint: "Soporte", icon: AlertTriangle, section: "soporte", keywords: ["vencidos", "sla", "atrasados", "mora"], event: "overdue:open" },
];

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (section: string) => void;
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const { role } = useAuth();
  const { data: myPerms } = useMyPermissions();
  const { data: slaSummary } = useSLASummary();

  const nav = visibleNav(role, myPerms);

  // Sólo ofrecemos acciones cuya sección destino es visible para el rol actual.
  const visibleSections = new Set(nav.map((n) => n.id));
  const actions = ACTIONS.filter((a) => visibleSections.has(a.section));

  const overdue = slaSummary?.overdue ?? 0;

  const go = useCallback(
    (section: string, event?: string) => {
      onOpenChange(false);
      onNavigate(section);
      // El evento va después de navegar para que la sección destino ya esté
      // montada cuando su listener lo reciba.
      if (event) window.dispatchEvent(new CustomEvent(event));
    },
    [onNavigate, onOpenChange],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Buscar o ir a una sección</DialogTitle>
      <CommandInput placeholder="Buscar o ir a…" className="text-[13px]" />
      <CommandList className="max-h-[340px]">
        {/* CommandEmpty pisa su className base (no usa cn), por eso repetimos text-center */}
        <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">Sin resultados.</CommandEmpty>

        {nav.length > 0 && (
          <CommandGroup
            heading="Ir a"
            className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {nav.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.title} ${item.keywords.join(" ")}`}
                onSelect={() => go(item.id)}
                className="gap-2.5 rounded-lg px-2 py-2 text-[13px]"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.title}</span>
                {item.id === "soporte" && overdue > 0 && (
                  <span className="relative ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold tabular-nums text-destructive-foreground">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-30 animate-ping" />
                    <span className="relative">{overdue}</span>
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {nav.length > 0 && actions.length > 0 && <CommandSeparator />}

        {actions.length > 0 && (
          <CommandGroup
            heading="Acciones"
            className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {actions.map((action) => (
              <CommandItem
                key={action.id}
                value={`${action.title} ${action.keywords.join(" ")}`}
                onSelect={() => go(action.section, action.event)}
                className="gap-2.5 rounded-lg px-2 py-2 text-[13px]"
              >
                <action.icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{action.title}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {action.hint}
                  <CornerDownLeft className="h-3 w-3" />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Atajo global ⌘K / Ctrl+K. Devuelve el estado del diálogo para cablearlo al header. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

export interface CommandTriggerProps {
  onClick: () => void;
  className?: string;
}

/** Botón del header: "Buscar o ir a…" + kbd ⌘K. */
export function CommandTrigger({ onClick, className }: CommandTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">Buscar o ir a…</span>
      <kbd className="ml-2 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
