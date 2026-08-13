import { LayoutDashboard, Building2, Headset, Trophy, Settings, type LucideIcon } from "lucide-react";

/**
 * Fuente ÚNICA de la navegación principal. La consumen el sidebar de escritorio,
 * la tab bar y el drawer móviles, y el command palette (⌘K).
 *
 * Antes cada superficie tenía su propia copia de esta lista: agregar una sección
 * o cambiar un permiso obligaba a tocar cuatro archivos y cualquier olvido dejaba
 * una superficie ofreciendo (o escondiendo) una sección que las otras no.
 */
export const CONFIG_PERMS = ["config.catalogos", "config.catalogos_admin", "equipo.supervisiones"];

export interface NavItem {
  id: string;
  /** Rótulo completo (sidebar, drawer, palette). */
  title: string;
  /** Rótulo corto para la tab bar móvil, donde no cabe el completo. */
  shortTitle: string;
  icon: LucideIcon;
  roles: string[];
  /** Si el rol no basta, alcanza con tener alguno de estos permisos. */
  anyPermission: string[];
  /** Términos extra para la búsqueda del command palette. */
  keywords: string[];
}

export const MAIN_NAV: NavItem[] = [
  { id: "overview", title: "Resumen Ejecutivo", shortTitle: "Resumen", icon: LayoutDashboard, roles: ["admin", "pm", "gerente", "gerente_soporte"], anyPermission: [], keywords: ["dashboard", "inicio", "kpi", "ejecutivo"] },
  { id: "clients", title: "Implementación", shortTitle: "Clientes", icon: Building2, roles: ["admin", "pm"], anyPermission: [], keywords: ["clientes", "proyectos", "cuentas"] },
  { id: "soporte", title: "Soporte", shortTitle: "Soporte", icon: Headset, roles: ["admin", "pm", "gerente_soporte", "csr"], anyPermission: [], keywords: ["tickets", "casos", "boletas", "sla", "mesa"] },
  { id: "team-scrum", title: "Equipo Scrum", shortTitle: "Scrum", icon: Trophy, roles: ["admin", "pm"], anyPermission: [], keywords: ["sprint", "tareas", "equipo", "horas"] },
  { id: "config", title: "Configuración", shortTitle: "Config", icon: Settings, roles: ["admin", "pm", "gerente_soporte"], anyPermission: CONFIG_PERMS, keywords: ["ajustes", "catálogos", "permisos"] },
];

/** Filtra la navegación por rol + permisos. Mismo criterio en todas las superficies. */
export function visibleNav(role: string | null | undefined, perms?: Set<string> | null): NavItem[] {
  return MAIN_NAV.filter(
    (item) =>
      (role != null && item.roles.includes(role)) ||
      (item.anyPermission.length > 0 && item.anyPermission.some((p) => perms?.has(p))),
  );
}
