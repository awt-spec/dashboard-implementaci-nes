import { useHasPermission } from "@/hooks/usePermissions";

/**
 * Niveles de acceso a información financiera (Mafe/Eduardo):
 *  - canAmounts: montos comerciales (valor mensual, facturado/pagado/pendiente,
 *    cotizaciones, paquetes, penalidades).
 *  - canCosts: costos/tarifas internas por perfil (lo más sensible).
 * Sin permiso → los valores se enmascaran ("Referir a Eduardo").
 * Las horas / saldo de horas NO se gatean.
 */
export function useFinanceAccess() {
  const canAmounts = useHasPermission("finanzas.ver_montos");
  const canCosts = useHasPermission("finanzas.ver_costos");
  return { canAmounts, canCosts };
}
