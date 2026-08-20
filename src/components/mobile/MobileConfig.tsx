import { useState, type ReactNode } from "react";
import { ChevronRight, User } from "lucide-react";
import { SectionLabel } from "@/components/common/StatCard";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";
import { MobileHeader, MobileScreen } from "@/components/mobile/MobileScreen";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export interface MobileConfigProps {
  onMenu?: () => void;
  /**
   * El repo todavía no tiene un flujo de edición de perfil, así que la acción
   * "Editar" sólo se dibuja cuando el contenedor puede resolverla: un botón
   * muerto es peor que no mostrarlo.
   */
  onEditProfile?: () => void;
}

/**
 * El track del handoff mide 40x23 con knob de 18px; el Switch de shadcn viene
 * 44x24 con knob de 20px. Se ajusta por className (el thumb es interno, por eso
 * se lo alcanza con la variante arbitraria [&>span]) en vez de duplicar el
 * componente.
 */
const SWITCH_CLASS =
  "h-[23px] w-10 [&>span]:h-[18px] [&>span]:w-[18px] [&>span]:data-[state=checked]:translate-x-[18px]";

/** Fila de la lista con separador; la última de cada grupo no lleva borde. */
function RowShell({
  children,
  className,
  last,
}: {
  children: ReactNode;
  className?: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-[11px] px-[13px] py-3",
        !last && "border-b border-border/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  last?: boolean;
}

function ToggleRow({ label, hint, checked, onCheckedChange, last }: ToggleRowProps) {
  return (
    <RowShell last={last}>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold leading-snug text-foreground">{label}</p>
        <p className="mt-[3px] text-[10.5px] font-medium leading-snug text-muted-foreground">
          {hint}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className={cn("shrink-0", SWITCH_CLASS)}
      />
    </RowShell>
  );
}

/** Grupo: micro-label + tarjeta que contiene las filas. */
function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{title}</SectionLabel>
      <div className="overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

/** Iniciales del nombre (máximo dos); vacío si no hay perfil cargado. */
function getInitials(name?: string | null): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function MobileConfig({ onMenu, onEditProfile }: MobileConfigProps) {
  const { profile, user, signOut } = useAuth();

  // Preferencias LOCALES a propósito: no existe tabla de preferencias de
  // notificación, así que esta tanda no persiste nada. Cuando exista, este
  // useState se reemplaza por el hook correspondiente. Por lo mismo los hints
  // describen la preferencia y NO prometen un horario concreto ("60 min antes",
  // "07:30"): esos números venían del prototipo y no los respalda nada.
  const [slaAlerts, setSlaAlerts] = useState(true);
  const [reassigned, setReassigned] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [aiSummary, setAiSummary] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const displayName = profile?.full_name?.trim() || user?.email || "Sin datos";
  const initials = getInitials(profile?.full_name);
  // El perfil sólo trae full_name/email/avatar_url: no hay turno ni unidad de
  // negocio que mostrar, así que la segunda línea es el correo real y se omite
  // cuando ya es lo que se muestra arriba.
  const accountEmail = profile?.email?.trim() || user?.email || null;
  const secondaryLine = accountEmail && accountEmail !== displayName ? accountEmail : null;

  return (
    <MobileScreen
      className="px-3.5 py-3"
      header={
        <MobileHeader
          title="Configuración"
          subtitle="Cuenta, notificaciones y preferencias"
          onMenu={onMenu}
        />
      }
    >
      {/* Tarjeta de cuenta */}
      <div className="flex items-center gap-[11px] rounded-xl border border-border bg-card p-[13px]">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-extrabold text-primary">
          {initials || <User className="h-[18px] w-[18px]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-foreground">
            {displayName}
          </p>
          {secondaryLine ? (
            <p className="mt-[3px] truncate text-[11px] font-medium leading-tight text-muted-foreground">
              {secondaryLine}
            </p>
          ) : null}
        </div>
        {onEditProfile ? (
          <button
            type="button"
            onClick={onEditProfile}
            className="shrink-0 rounded-lg px-1 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Editar
          </button>
        ) : null}
      </div>

      <SettingsGroup title="Notificaciones">
        <ToggleRow
          label="Alertas de SLA por vencer"
          hint="aviso antes del vencimiento"
          checked={slaAlerts}
          onCheckedChange={setSlaAlerts}
        />
        <ToggleRow
          label="Casos reasignados a mí"
          hint="aviso al reasignar un caso"
          checked={reassigned}
          onCheckedChange={setReassigned}
        />
        <ToggleRow
          label="Resumen diario del turno"
          hint="resumen al inicio del turno"
          checked={dailyDigest}
          onCheckedChange={setDailyDigest}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="Trabajo">
        <ToggleRow
          label="Resumen IA del caso"
          hint="genera el resumen al abrir el caso"
          checked={aiSummary}
          onCheckedChange={setAiSummary}
        />
        <ToggleRow
          label="Modo sin conexión"
          hint="guarda los casos del turno en el teléfono"
          checked={offlineMode}
          onCheckedChange={setOfflineMode}
          last
        />
      </SettingsGroup>

      <section className="flex flex-col gap-2">
        <SectionLabel>Cuenta</SectionLabel>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ChangePasswordDialog
            trigger={
              <button
                type="button"
                className="flex w-full items-center gap-[10px] border-b border-border/70 px-[13px] py-[13px] text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex-1 text-[12.5px] font-semibold text-foreground">
                  Cambiar contraseña
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              </button>
            }
          />

          {/* No existe fuente para el conteo de sesiones activas: la fila va sin
              cifra y sin destino clickeable en vez de inventar un número. */}
          <RowShell>
            <span className="flex-1 text-[12.5px] font-semibold text-foreground">
              Dispositivos con sesión
            </span>
            <span className="text-[11.5px] font-medium text-muted-foreground">Sin datos</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          </RowShell>

          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center px-[13px] py-[13px] text-left transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex-1 text-[12.5px] font-semibold text-destructive">
              Cerrar sesión
            </span>
          </button>
        </div>

        {/* package.json declara version "0.0.0" (placeholder de Vite): mostrar
            ese número sería peor que omitirlo. */}
        <p className="mt-0.5 text-center text-[10.5px] font-medium text-muted-foreground">
          SVA ERP
        </p>
      </section>
    </MobileScreen>
  );
}
