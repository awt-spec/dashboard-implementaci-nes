import { Loader2 } from "lucide-react";
import { type AccountStatement } from "@/hooks/useAccountStatement";
import { useSysdeStatementData } from "@/hooks/useSysdeStatementData";
import sysdelogo from "@/assets/logo-sysde.png";

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};
const n2 = (v: number) => Number(v).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RED = "#8B1E1E";

/**
 * Documento de estado de cuenta con el formato clásico de SYSDE (logo, tabla de
 * "Paquetes de servicio" y "Solicitudes de servicio"). Reutilizado en el modal
 * de detalle y como vista principal del estado de cuenta.
 */
export function AccountStatementDocument({ stmt, clientId }: { stmt: AccountStatement; clientId: string }) {
  const { loadingPkgs, pkgRows, rows, totals } = useSysdeStatementData(stmt, clientId);
  const { contracted: totContract, consumed: totConsumed, balance: totBalance, saldoActivas, invertido: totalInvertido } = totals;

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-white text-black">
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
          <span className="font-bold">{fmtDate(stmt.period.start)}</span>
          <span className="font-bold">{fmtDate(stmt.period.end)}</span>
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
  );
}
