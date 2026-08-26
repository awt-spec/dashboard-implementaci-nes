import { ShieldCheck, ShieldAlert, CalendarClock, RefreshCw } from "lucide-react";
import { useClientContracts } from "@/hooks/useClientContracts";
import { useContractCoverage } from "@/hooks/useContractCoverage";
import { useSlaCompliance } from "@/hooks/useSlaCompliance";

function fmt(d: string | null | undefined): string | null {
  if (!d) return null;
  // Mediodía y no medianoche: en UTC-6 un date puro se corre al día anterior.
  return new Date(d + "T12:00:00").toLocaleDateString("es-CR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

/**
 * Vigencia del contrato y cuántos casos quedan fuera de ella.
 *
 * Se muestra del lado del cliente, no sólo del nuestro. La razón: si un caso
 * se está atendiendo fuera de contrato, el cliente es quien puede resolverlo
 * —renovando, ampliando o aclarando que hay una prórroga— y hasta ahora era el
 * único que no lo veía. Enterarse al recibir la factura es tarde.
 *
 * El tono es informativo, no acusatorio: la franja dice qué dice el registro y
 * a quién escribirle, no reclama nada.
 */
export function ContractValidityStrip({ clientId }: { clientId: string }) {
  const { data: contracts = [] } = useClientContracts(clientId);
  const { data: coverage } = useContractCoverage(clientId);
  const { summary } = useSlaCompliance(clientId);

  // El mismo criterio que el resto de la app: el vigente más reciente, y si no
  // hay ninguno vigente, el último cargado — que es el que acaba de vencer.
  const contract = contracts.find((c: { is_active?: boolean }) => c.is_active) ?? contracts[0];
  if (!contract && !coverage) return null;

  const vencido = contract?.status === "vencido";
  const sinContrato = !contract || coverage?.coverage === "sin_contrato";
  const hasta = fmt(contract?.end_date);
  const desde = fmt(contract?.start_date);

  const tone = sinContrato || vencido ? "destructive" : "success";
  const box = tone === "destructive"
    ? "border-destructive/40 bg-destructive/[0.06]"
    : "border-success/30 bg-success/[0.05]";
  const ink = tone === "destructive" ? "text-destructive" : "text-success";

  return (
    <div className={`rounded-xl border p-3 ${box}`}>
      <div className="flex items-start gap-2.5">
        {tone === "destructive"
          ? <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${ink}`} />
          : <ShieldCheck className={`h-4 w-4 shrink-0 mt-0.5 ${ink}`} />}
        <div className="min-w-0 flex-1">
          <p className={`text-[12.5px] font-bold ${ink}`}>
            {sinContrato ? "Sin contrato registrado"
              : vencido ? "Contrato vencido"
              : "Contrato vigente"}
          </p>

          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {sinContrato ? (
              "No hay un contrato cargado para esta cuenta. Escribinos para regularizarlo."
            ) : vencido ? (
              <>La vigencia terminó el {hasta}. Los casos que se registren desde ahora quedan sin respaldo contractual hasta que se renueve.</>
            ) : hasta ? (
              <>
                Vigencia {desde ? <>del {desde} </> : null}hasta el {hasta}.
                {contract?.auto_renewal && " Se renueva automáticamente por su mismo plazo."}
              </>
            ) : (
              <>Contrato sin fecha de vencimiento{desde ? <>, desde el {desde}</> : null}.</>
            )}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
            {contract?.contract_type && (
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {contract.contract_type.replace(/_/g, " ")}
              </span>
            )}
            {contract?.auto_renewal && !vencido && (
              <span className="flex items-center gap-1 text-success">
                <RefreshCw className="h-3 w-3" /> renovación automática
              </span>
            )}
            {/* Sólo si hay algo que decir. Un cero no aporta y suma ruido. */}
            {summary.uncovered > 0 && (
              <span className="font-semibold text-destructive">
                {summary.uncovered} caso{summary.uncovered === 1 ? "" : "s"} abierto
                {summary.uncovered === 1 ? "" : "s"} fuera de vigencia
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
