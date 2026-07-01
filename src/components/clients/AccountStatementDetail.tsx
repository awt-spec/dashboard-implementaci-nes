import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type AccountStatement } from "@/hooks/useAccountStatement";
import { useServicePackages, useTicketsByIds } from "@/hooks/useServicePackages";
import { exportAccountStatementPdf } from "@/lib/exportAccountStatementPdf";
import sysdelogo from "@/assets/logo-sysde.png";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stmt: AccountStatement;
  clientId: string;
}

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};
const n2 = (v: number) => Number(v).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Estado de cuenta con el formato clásico de SYSDE: encabezado con logo,
 * tabla de "Paquetes de servicio" (pólizas con horas/vigencia/estado) y
 * tabla de "Solicitudes de servicio" (detalle de consumo por caso).
 */
export function AccountStatementDetail({ open, onOpenChange, stmt, clientId }: Props) {
  const { data: packages = [], isLoading: loadingPkgs } = useServicePackages(clientId);

  // Solicitudes = consumo por ticket en el período (from stmt.consumption.by_item).
  const items = useMemo(
    () => stmt.consumption.by_item.filter(it => it.source === "ticket"),
    [stmt.consumption.by_item],
  );
  const ticketIds = useMemo(() => items.map(it => it.item_id), [items]);
  const { data: ticketMap } = useTicketsByIds(ticketIds);

  const pStart = stmt.period.start, pEnd = stmt.period.end;
  const today = new Date().toISOString().slice(0, 10);

  // Paquetes que solapan el período del estado de cuenta.
  const shownPkgs = useMemo(
    () => packages.filter(p => p.start_date <= pEnd && p.end_date >= pStart)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [packages, pStart, pEnd],
  );

  // Atribuir cada solicitud a un paquete (por fecha_registro; fallback = paquete
  // vigente con vencimiento más tardío). Calcular horas consumidas por paquete.
  const { rows, consumedByPkg, totalInvertido } = useMemo(() => {
    const consumed: Record<string, number> = {};
    const fallback = [...shownPkgs].sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
    const rows = items.map(it => {
      const t = ticketMap?.get(it.item_id);
      const freg = t?.fecha_registro?.slice(0, 10) ?? null;
      let pkg = freg ? shownPkgs.find(p => freg >= p.start_date && freg <= p.end_date) : undefined;
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
    }).sort((a, b) => (a.fecha_registro ?? "").localeCompare(b.fecha_registro ?? ""));
    const totalInvertido = rows.reduce((s, r) => s + r.hours, 0);
    return { rows, consumedByPkg: consumed, totalInvertido };
  }, [items, ticketMap, shownPkgs]);

  const pkgRows = shownPkgs.map(p => {
    const consumed = consumedByPkg[p.id] ?? 0;
    const balance = Number(p.hours_contracted) - consumed;
    const estado = p.end_date >= today ? "Activo" : "Vencido";
    return { ...p, consumed, balance, estado };
  });
  const totContract = pkgRows.reduce((s, p) => s + Number(p.hours_contracted), 0);
  const totConsumed = pkgRows.reduce((s, p) => s + p.consumed, 0);
  const totBalance = pkgRows.reduce((s, p) => s + p.balance, 0);
  const saldoActivas = pkgRows.filter(p => p.estado === "Activo").reduce((s, p) => s + p.balance, 0);

  const handleExport = () => {
    try { exportAccountStatementPdf(stmt); toast.success("PDF descargado"); }
    catch (e: any) { toast.error(e?.message || "Error al generar PDF"); }
  };

  const RED = "#8B1E1E";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 gap-0 bg-white text-black">
        <div className="p-8 space-y-6">
          {/* ── Encabezado ── */}
          <div className="flex items-start justify-between">
            <img src={sysdelogo} alt="Sysde" className="h-12 object-contain" />
            <div className="w-10 h-16" style={{ background: RED }} />
          </div>
          <h1 className="text-2xl font-black tracking-tight">ESTADO DE CUENTA</h1>

          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-bold">Estimado cliente: </span>
              <span className="font-bold" style={{ color: RED }}>{stmt.client.name}</span>
            </p>
            <div className="flex items-center gap-6 text-sm">
              <span>Estado de cuenta para el periodo definido entre las siguientes fechas:</span>
              <span className="font-bold">{fmtDate(pStart)}</span>
              <span className="font-bold">{fmtDate(pEnd)}</span>
            </div>
          </div>

          {/* ── Tabla: Paquetes de servicio ── */}
          <div className="border" style={{ borderColor: RED }}>
            <div className="text-center font-bold py-1.5 border-b" style={{ borderColor: RED }}>Paquetes de servicio</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: RED }} className="text-white">
                  {["Póliza", "Paquete Servicio", "Horas contratadas", "Horas consumidas", "Saldo horas póliza", "Fecha inicial", "Fecha vencimiento", "Estado"].map(h => (
                    <th key={h} className="px-2 py-1.5 font-bold border" style={{ borderColor: "#fff3" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingPkgs ? (
                  <tr><td colSpan={8} className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
                ) : pkgRows.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-3 text-neutral-500">Sin paquetes en el período</td></tr>
                ) : pkgRows.map(p => (
                  <tr key={p.id} className="text-center">
                    <td className="border px-2 py-1.5">{p.policy_number}</td>
                    <td className="border px-2 py-1.5">{p.package_number}</td>
                    <td className="border px-2 py-1.5 text-right">{n2(p.hours_contracted)}</td>
                    <td className="border px-2 py-1.5 text-right">{n2(p.consumed)}</td>
                    <td className="border px-2 py-1.5 text-right">{n2(p.balance)}</td>
                    <td className="border px-2 py-1.5">{fmtDate(p.start_date)}</td>
                    <td className="border px-2 py-1.5">{fmtDate(p.end_date)}</td>
                    <td className="border px-2 py-1.5">{p.estado}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="border px-2 py-1.5" style={{ color: RED }}>TOTALES</td>
                  <td className="border px-2 py-1.5"></td>
                  <td className="border px-2 py-1.5 text-right">{n2(totContract)}</td>
                  <td className="border px-2 py-1.5 text-right">{n2(totConsumed)}</td>
                  <td className="border px-2 py-1.5 text-right">{n2(totBalance)}</td>
                  <td className="border px-2 py-1.5" colSpan={3}></td>
                </tr>
              </tbody>
            </table>
            <div className="flex">
              <div className="flex-1 px-2 py-2 font-bold text-white" style={{ background: RED }}>TOTAL SALDO HORAS ACTIVAS:</div>
              <div className="w-40 px-4 py-2 font-bold text-right">{n2(saldoActivas)}</div>
            </div>
          </div>

          {/* ── Tabla: Solicitudes de servicio ── */}
          <div className="space-y-2">
            <p className="text-sm">Estado cuenta definido con el siguiente detalle de consumo:</p>
            <div className="border" style={{ borderColor: RED }}>
              <div className="text-center font-bold py-1.5 border-b" style={{ borderColor: RED }}>Solicitudes de servicio</div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: RED }} className="text-white">
                    {["Id", "Paquete Servicio", "Producto", "Cons. cliente", "Asunto", "Fecha registro", "Tipo", "Medio descuento", "Tiempo invertido"].map(h => (
                      <th key={h} className="px-2 py-1.5 font-bold border" style={{ borderColor: "#fff3" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-3 text-neutral-500">Sin consumo registrado en el período</td></tr>
                  ) : rows.map(r => (
                    <tr key={r.item_id}>
                      <td className="border px-2 py-1.5">{r.ticket_code}</td>
                      <td className="border px-2 py-1.5 text-center">{r.package_number ?? "—"}</td>
                      <td className="border px-2 py-1.5">{r.producto}</td>
                      <td className="border px-2 py-1.5 text-center">{r.consecutivo_cliente ?? "—"}</td>
                      <td className="border px-2 py-1.5 max-w-[240px] truncate">{r.asunto}</td>
                      <td className="border px-2 py-1.5 text-center">{fmtDate(r.fecha_registro)}</td>
                      <td className="border px-2 py-1.5">{r.tipo}</td>
                      <td className="border px-2 py-1.5 text-center">Póliza</td>
                      <td className="border px-2 py-1.5 text-right">{n2(r.hours)}</td>
                    </tr>
                  ))}
                  {rows.length > 0 && (
                    <tr className="font-bold">
                      <td colSpan={8} className="border px-2 py-1.5 text-right" style={{ color: RED }}>TOTAL TIEMPO INVERTIDO</td>
                      <td className="border px-2 py-1.5 text-right">{n2(totalInvertido)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pie ── */}
          <div className="flex items-end justify-between pt-6 text-[11px] text-neutral-600">
            <div>
              <p className="font-bold">SYSDE</p>
              <p>MetroPark Free Zone, P.O. box: 12133-1000</p>
              <p>Costa Rica. Tel.: (506) 2293-2864. Fax: (506) 2293-2812</p>
            </div>
            <p>{new Date(stmt.generated_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </div>

        {/* Barra de acciones (no imprime) */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t bg-neutral-50 sticky bottom-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button size="sm" onClick={handleExport} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Exportar PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
