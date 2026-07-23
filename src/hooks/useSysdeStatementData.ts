import { useMemo } from "react";
import { type AccountStatement } from "@/hooks/useAccountStatement";
import { useServicePackages, useTicketsByIds } from "@/hooks/useServicePackages";
import { type SysdeExportData, type SysdeAnalytics } from "@/lib/exportAccountStatementPdf";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesLabel = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1] ?? "?"} ${ym.slice(0, 4)}`;

/**
 * Calcula los datos del estado de cuenta con el formato SYSDE (paquetes de
 * servicio + solicitudes de servicio), atribuyendo cada solicitud a un paquete
 * por fecha de registro. Compartido por AccountStatementDetail (pantalla) y por
 * el exportador de PDF.
 */
export function useSysdeStatementData(stmt: AccountStatement | undefined, clientId?: string) {
  const { data: packages = [], isLoading: loadingPkgs } = useServicePackages(clientId);

  const items = useMemo(
    () => (stmt?.consumption.by_item ?? []).filter((it) => it.source === "ticket"),
    [stmt?.consumption.by_item],
  );
  const ticketIds = useMemo(() => items.map((it) => it.item_id), [items]);
  const { data: ticketMap } = useTicketsByIds(ticketIds);

  const pStart = stmt?.period.start ?? "9999-12-31";
  const pEnd = stmt?.period.end ?? "0000-01-01";
  const today = new Date().toISOString().slice(0, 10);

  const shownPkgs = useMemo(
    () =>
      packages
        .filter((p) => p.start_date <= pEnd && p.end_date >= pStart)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [packages, pStart, pEnd],
  );

  const { rows, consumedByPkg, totalInvertido } = useMemo(() => {
    const consumed: Record<string, number> = {};
    const fallback = [...shownPkgs].sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
    const rows = items
      .map((it) => {
        const t = ticketMap?.get(it.item_id);
        const freg = t?.fecha_registro?.slice(0, 10) ?? null;
        let pkg = freg ? shownPkgs.find((p) => freg >= p.start_date && freg <= p.end_date) : undefined;
        if (!pkg) pkg = fallback;
        if (pkg) consumed[pkg.id] = (consumed[pkg.id] ?? 0) + Number(it.hours);
        return {
          item_id: it.item_id,
          hours: Number(it.hours),
          ticket_code: t?.ticket_id ?? it.ticket_info?.ticket_id ?? "—",
          consecutivo_cliente: t?.consecutivo_cliente ?? null,
          producto: t?.producto ?? "—",
          asunto: t?.asunto ?? it.ticket_info?.asunto ?? "—",
          fecha_registro: freg,
          tipo: t?.tipo ?? "—",
          package_number: pkg?.package_number ?? null,
        };
      })
      .sort((a, b) => (a.fecha_registro ?? "").localeCompare(b.fecha_registro ?? ""));
    const totalInvertido = rows.reduce((s, r) => s + r.hours, 0);
    return { rows, consumedByPkg: consumed, totalInvertido };
  }, [items, ticketMap, shownPkgs]);

  const pkgRows = useMemo(
    () =>
      shownPkgs.map((p) => {
        const consumed = consumedByPkg[p.id] ?? 0;
        const balance = Number(p.hours_contracted) - consumed;
        const estado = p.end_date >= today ? "Activo" : "Vencido";
        return { ...p, consumed, balance, estado };
      }),
    [shownPkgs, consumedByPkg, today],
  );

  const totContract = pkgRows.reduce((s, p) => s + Number(p.hours_contracted), 0);
  const totConsumed = pkgRows.reduce((s, p) => s + p.consumed, 0);
  const totBalance = pkgRows.reduce((s, p) => s + p.balance, 0);
  const saldoActivas = pkgRows
    .filter((p) => p.estado === "Activo")
    .reduce((s, p) => s + p.balance, 0);
  // Horas contratadas que vencieron sin usarse (pólizas Vencidas con saldo > 0).
  // No son usables; se muestran aparte para que el "saldo total" no engañe.
  const expiradas = pkgRows
    .filter((p) => p.estado === "Vencido")
    .reduce((s, p) => s + Math.max(0, p.balance), 0);

  const totals = {
    contracted: totContract,
    consumed: totConsumed,
    balance: totBalance,
    saldoActivas,
    expiradas,
    invertido: totalInvertido,
  };

  // ── Analítica del período (solo horas): consumo por mes/tipo, utilización
  //    y proyección de cobertura del saldo activo al ritmo actual (run-rate).
  const analytics: SysdeAnalytics = useMemo(() => {
    const porMes: Record<string, number> = {};
    const porTipo: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.fecha_registro) {
        const ym = r.fecha_registro.slice(0, 7);
        porMes[ym] = (porMes[ym] ?? 0) + r.hours;
      }
      const t = r.tipo && r.tipo !== "—" ? r.tipo : "Sin tipo";
      porTipo[t] = (porTipo[t] ?? 0) + r.hours;
    });
    const byMonth = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, hours]) => ({ ym, label: mesLabel(ym), hours }));
    const byTipo = Object.entries(porTipo)
      .sort(([, a], [, b]) => b - a)
      .map(([tipo, hours]) => ({ tipo, hours }));
    const utilizacionPct = totContract > 0 ? (totConsumed / totContract) * 100 : 0;
    const runRate = byMonth.length ? totalInvertido / byMonth.length : 0;
    // Proyección solo con ≥2 meses de datos y saldo activo real; es un estimado.
    let mesesCobertura: number | null = null;
    let agotamientoLabel: string | null = null;
    if (saldoActivas > 0.001 && runRate > 0.001 && byMonth.length >= 2) {
      mesesCobertura = saldoActivas / runRate;
      const d = new Date();
      d.setMonth(d.getMonth() + Math.max(0, Math.round(mesesCobertura)));
      agotamientoLabel = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    }
    return { byMonth, byTipo, utilizacionPct, runRate, mesesCobertura, agotamientoLabel };
  }, [rows, totContract, totConsumed, totalInvertido, saldoActivas]);

  return { loadingPkgs, pkgRows, rows, totals, analytics };
}

export type SysdeStatementData = ReturnType<typeof useSysdeStatementData>;

/** Convierte el resultado del hook al payload que consume el exportador PDF. */
export function toSysdeExportData(d: {
  pkgRows: SysdeStatementData["pkgRows"];
  rows: SysdeStatementData["rows"];
  totals: SysdeStatementData["totals"];
  analytics?: SysdeStatementData["analytics"];
}): SysdeExportData {
  return {
    packages: d.pkgRows.map((p) => ({
      policy_number: p.policy_number,
      package_number: p.package_number,
      hours_contracted: Number(p.hours_contracted),
      consumed: p.consumed,
      balance: p.balance,
      start_date: p.start_date,
      end_date: p.end_date,
      estado: p.estado,
    })),
    solicitudes: d.rows.map((r) => ({
      ticket_code: r.ticket_code,
      package_number: r.package_number,
      producto: r.producto,
      consecutivo_cliente: r.consecutivo_cliente,
      asunto: r.asunto,
      fecha_registro: r.fecha_registro,
      tipo: r.tipo,
      hours: r.hours,
    })),
    totals: d.totals,
    analytics: d.analytics,
  };
}
