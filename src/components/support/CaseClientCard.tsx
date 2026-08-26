import { Building2, ExternalLink, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSupportClients, useSupportTickets } from "@/hooks/useSupportTickets";
import { useSlaCompliance, formatCutoff } from "@/hooks/useSlaCompliance";
import { useReopenRate90d } from "@/hooks/useTicketReopens";
import { useClientContracts } from "@/hooks/useClientContracts";
import { isTicketClosed } from "@/lib/ticketStatus";
import { meterTone } from "@/lib/meterTone";
import { ShieldAlert, ShieldCheck } from "lucide-react";


function Meter({
  label, value, pct, note, higherIsBetter,
}: { label: string; value: string; pct: number | null; note: string; higherIsBetter: boolean }) {
  const tone = meterTone(pct, higherIsBetter);
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground truncate">{label}</p>
      <p className={`mt-0.5 text-[19px] font-extrabold leading-none tabular-nums ${tone.text}`}>{value}</p>
      <div className="mt-1.5 h-[5px] rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${pct === null ? 0 : Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[10.5px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[11px] font-semibold text-foreground truncate text-right">{value}</span>
    </div>
  );
}

interface Props {
  clientId: string;
  /** Caso abierto actualmente: se excluye de "otros casos abiertos". */
  currentTicketId?: string;
  /** Abre otro caso del mismo cliente desde la lista. */
  onOpenTicket?: (ticketId: string) => void;
}

/**
 * Ficha del cliente del caso (§9) — se lee de arriba abajo: identidad,
 * dos medidores, tres pares, otros casos abiertos y reincidencia.
 *
 * Sustituye a la lista plana de pares clave/valor: con quince pares seguidos
 * no hay forma de saber cuál mirar primero. Los medidores ponen adelante las
 * dos cifras que deciden si este caso se escala.
 *
 * Omite deliberadamente "cliente desde" y el chip de plan del prototipo: el
 * modelo de clientes no tiene fecha de alta ni plan comercial, y rellenarlos
 * con un valor inventado haría que la ficha mienta.
 */
export function CaseClientCard({ clientId, currentTicketId, onOpenTicket }: Props) {
  const navigate = useNavigate();
  const { data: clients = [] } = useSupportClients();
  const { data: tickets = [] } = useSupportTickets(clientId);
  const { data: contracts = [] } = useClientContracts(clientId);
  const { data: reopen } = useReopenRate90d(clientId);
  const { rows, summary, cutoff } = useSlaCompliance(clientId);
  const desde = formatCutoff(cutoff);

  const client = clients.find((c: { id: string }) => c.id === clientId);

  // Otros casos abiertos del mismo cliente, los vencidos primero: si hay uno
  // roto, es lo que hay que ver antes de seguir con éste.
  const levelByTicket = new Map(rows.map(r => [r.ticket.id, r]));
  // La cobertura sale de la misma fila que el SLA: una sola consulta, y la
  // regla la resolvió la base contra la fecha del caso.
  const currentCoverage = currentTicketId ? levelByTicket.get(currentTicketId)?.coverage ?? null : null;
  const currentIsOpen = tickets.some(t => t.id === currentTicketId && !isTicketClosed(t.estado));
  const others = tickets
    .filter(t => !isTicketClosed(t.estado) && t.id !== currentTicketId)
    .sort((a, b) => (levelByTicket.get(b.id)?.pct ?? -1) - (levelByTicket.get(a.id)?.pct ?? -1));

  const contract = contracts.find((c: { is_active?: boolean }) => c.is_active) ?? contracts[0];
  const includedHours = Number(contract?.included_hours) || 0;
  // Horas facturables del mes en curso. La tabla guarda MINUTOS y la fecha
  // local, no UTC: en UTC-6 un caso del día 1 caía en el mes anterior.
  const monthKey = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const usedHours = tickets.reduce((sum, t) => {
    const created = (t.created_at || "").slice(0, 7);
    return created === monthKey ? sum + (Number(t.tiempo_cobrado_minutos) || 0) / 60 : sum;
  }, 0);
  const hoursPct = includedHours > 0 ? Math.round((usedHours / includedHours) * 100) : null;

  if (!client) return null;

  return (
    <div className="min-h-0 overflow-y-auto space-y-3">
      {/* 1 · Identidad */}
      <div className="flex items-start gap-2.5">
        <div className="h-[34px] w-[34px] shrink-0 rounded-[9px] bg-primary/10 flex items-center justify-center">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          {/* Al expediente 360: el caso y el riesgo del proyecto suelen ser el
              mismo problema y hasta ahora vivían en pantallas distintas. */}
          <button
            type="button"
            onClick={() => navigate(`/clientes/${clientId}?ctx=soporte`)}
            className="flex min-w-0 items-center gap-1 text-left"
            title="Abrir el expediente del cliente"
          >
            <span className="truncate text-[12.5px] font-bold leading-tight text-foreground hover:text-primary">
              {client.name}
            </span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
          <p className="text-[10.5px] text-muted-foreground truncate">
            {[client.country, client.industry].filter(Boolean).join(" · ") || "Sin datos de ficha"}
          </p>
        </div>
      </div>

      {/* 2 · Dos medidores */}
      <div className="grid grid-cols-2 gap-3">
        <Meter
          label="Cumplimiento SLA"
          value={summary.compliancePct === null ? "—" : `${summary.compliancePct}%`}
          pct={summary.compliancePct}
          higherIsBetter
          // El medidor mide desde el corte; el conteo de incumplidos que
          // acompaña tiene que ser el mismo subconjunto, o la nota estaría
          // explicando un número que no es el de arriba.
          note={
            summary.compliancePct === null
              ? desde ? `sin casos desde el ${desde}` : "sin casos con SLA aplicable"
              : `meta 90% · ${summary.measuredBreached} incumplido${summary.measuredBreached === 1 ? "" : "s"} de ${summary.measured}`
          }
        />
        <Meter
          label="Horas del mes"
          value={includedHours > 0 ? `${Math.round(usedHours)} / ${includedHours} h` : "—"}
          pct={hoursPct}
          higherIsBetter={false}
          note={
            hoursPct !== null
              ? `${hoursPct}% del contrato`
              : "el contrato no define horas incluidas"
          }
        />
      </div>

      {/* 2b · Cobertura contractual del caso abierto */}
      {/* Va arriba de los pares y no entre ellos: si el caso no tiene respaldo,
          eso pesa más que el tipo de contrato o el conteo de abiertos. */}
      {currentCoverage && currentCoverage !== "cubierto" && (
        <div className="rounded-[10px] border border-destructive/35 bg-destructive/[0.06] p-2.5">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-[11px] font-bold text-destructive">
              {currentCoverage === "sin_contrato" ? "Cliente sin contrato" : "Caso fuera de vigencia"}
            </p>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {currentCoverage === "sin_contrato"
              ? "No hay contrato registrado que respalde este caso."
              : "La fecha de registro no cae dentro de ningún contrato del cliente."}
          </p>
        </div>
      )}
      {currentCoverage === "cubierto" && (
        <p className="flex items-center gap-1 text-[10px] text-success">
          <ShieldCheck className="h-3 w-3 shrink-0" /> Caso dentro de contrato
        </p>
      )}

      {/* 3 · Tres pares */}
      <div className="border-t border-border pt-1.5">
        <Pair label="Contrato" value={contract?.contract_type || "Sin contrato registrado"} />
        {/* El caso que se está viendo puede estar cerrado: sólo suma si sigue abierto. */}
        <Pair label="Casos abiertos" value={`${others.length + (currentIsOpen ? 1 : 0)}`} />
        <Pair
          label="Reaperturas 90d"
          value={reopen ? `${reopen.reopens_90d} de ${reopen.entregados_90d}` : "—"}
        />
      </div>

      {/* 4 · Otros casos abiertos */}
      <div className="border-t border-border pt-2.5">
        <p className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
          Otros casos abiertos {others.length > 0 && <span className="tabular-nums">· {others.length}</span>}
        </p>
        {others.length === 0 ? (
          <p className="text-[10.5px] text-muted-foreground">Sin otros casos abiertos.</p>
        ) : (
          <div className="space-y-1">
            {others.slice(0, 5).map(t => {
              const row = levelByTicket.get(t.id);
              const tone =
                row?.level === "breached" ? "text-destructive"
                : row?.level === "at_risk" ? "text-warning"
                : "text-muted-foreground";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTicket?.(t.id)}
                  disabled={!onOpenTicket}
                  className="w-full flex items-center gap-2 rounded-[9px] bg-background border border-border px-2 py-1.5 text-left transition-colors enabled:hover:bg-accent/50 disabled:cursor-default"
                >
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
                    {t.ticket_id}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[10.5px] text-foreground">{t.asunto}</span>
                  <span className={`text-[10px] font-bold tabular-nums shrink-0 ${tone}`}>
                    {row ? `${row.pct}%` : "sin SLA"}
                  </span>
                </button>
              );
            })}
            {others.length > 5 && (
              <p className="pt-0.5 text-center text-[10px] text-muted-foreground">
                y {others.length - 5} más…
              </p>
            )}
          </div>
        )}
      </div>

      {/* 5 · Reincidencia */}
      {reopen && reopen.reopens_90d > 0 && (
        <div className="rounded-[10px] border border-warning/35 bg-warning/[0.06] p-2.5">
          <div className="flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5 text-warning shrink-0" />
            <p className="text-[11px] font-bold text-warning">
              Reincidencia · {reopen.rate_pct}%
            </p>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {reopen.reopens_90d} reapertura{reopen.reopens_90d === 1 ? "" : "s"} sobre {reopen.entregados_90d} caso
            {reopen.entregados_90d === 1 ? "" : "s"} entregado{reopen.entregados_90d === 1 ? "" : "s"} en 90 días.
          </p>
        </div>
      )}
    </div>
  );
}
