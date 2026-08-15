import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileSignature, ShieldCheck, Wallet, CalendarClock, RefreshCw, Milestone,
  FileText, Shield, TriangleAlert, Clock, History,
} from "lucide-react";
import { SectionLabel } from "@/components/common/StatCard";
import { Confidential } from "@/components/common/Confidential";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { ContractMilestonesPanel } from "./ContractMilestonesPanel";
import { useServicePackages } from "@/hooks/useServicePackages";
import { useBilledPackages } from "@/hooks/useBilledPackages";
import { useContractDocuments } from "@/hooks/useContractKb";
import { useClientSLAs, type ClientContract, CONTRACT_STATUS_META, type ContractStatus } from "@/hooks/useClientContracts";
import { useContractHistory, useContractAmendments } from "@/hooks/useContractLifecycle";

const CONTRACT_TYPES: Record<string, string> = {
  bolsa_horas: "Bolsa de horas",
  fee_mensual: "Fee mensual fijo",
  proyecto_cerrado: "Proyecto cerrado",
  tiempo_materiales: "Tiempo y materiales",
};

const n0 = (v: number) => Number(v || 0).toLocaleString("es-CR", { maximumFractionDigits: 0 });
const n2 = (v: number) => Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

/** Meses completos transcurridos desde el inicio, acotado al fin de vigencia. */
function mesesTranscurridos(start?: string | null, end?: string | null): number | null {
  if (!start) return null;
  const s = new Date(start);
  const hoy = new Date();
  const tope = end && new Date(end) < hoy ? new Date(end) : hoy;
  if (isNaN(s.getTime()) || tope < s) return null;
  return (tope.getFullYear() - s.getFullYear()) * 12 + (tope.getMonth() - s.getMonth());
}

function vigenciaPct(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  return Math.min(100, Math.max(0, ((Date.now() - s) / (e - s)) * 100));
}


const FIELD_LABEL: Record<string, string> = {
  contract_type: "Tipo", monthly_value: "Valor mensual", hourly_rate: "Tarifa hora",
  included_hours: "Horas incluidas", currency: "Moneda", start_date: "Inicio",
  end_date: "Fin", auto_renewal: "Renovación automática", payment_terms: "Términos de pago",
  penalty_clause: "Cláusula de penalidad", notes: "Notas", status: "Estado",
};
const ACTION_LABEL: Record<string, string> = {
  created: "Creado", updated: "Modificado", deleted: "Archivado", restored: "Restaurado",
};
const val = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

interface Props {
  contract: ClientContract | null;
  clientId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Expediente completo de UN contrato: vigencia, economía (facturado contra
 * pactado), pólizas que originó, hitos, documentos y SLAs.
 *
 * Todo se arma filtrando los datos que ya se cargan a nivel cliente por
 * contract_id — sin consultas nuevas.
 */
export function ContractDetailSheet({ contract, clientId, open, onOpenChange }: Props) {
  const { canAmounts } = useFinanceAccess();
  const { data: allPkgs = [] } = useServicePackages(clientId);
  const { data: allBilled = [] } = useBilledPackages(clientId);
  const { data: allDocs = [] } = useContractDocuments(clientId);
  const { data: slas = [] } = useClientSLAs(clientId);
  const { data: history = [] } = useContractHistory(contract?.id);
  const { data: amendments = [] } = useContractAmendments(contract?.id);

  if (!contract) return null;

  const cur = contract.currency || "USD";
  const tipo = CONTRACT_TYPES[contract.contract_type] || contract.contract_type;

  const pkgs = allPkgs.filter(p => p.contract_id === contract.id);
  const docs = allDocs.filter(d => d.contract_id === contract.id);
  const horasPkgs = pkgs.reduce((s, p) => s + Number(p.hours_contracted || 0), 0);

  // Facturado: sólo paquetes de ESTE contrato y en SU misma moneda — sumar
  // monedas distintas daría un total sin significado. Los anulados no cuentan.
  const billed = allBilled.filter(b => b.contract_id === contract.id && b.status !== "anulado");
  const facturado = billed
    .filter(b => (b.currency || cur) === cur)
    .reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const otrasMonedas = [...new Set(billed.filter(b => (b.currency || cur) !== cur).map(b => b.currency))];
  const cobrado = billed
    .filter(b => b.status === "pagado" && (b.currency || cur) === cur)
    .reduce((s, b) => s + Number(b.total_amount || 0), 0);

  // Pactado a la fecha = valor mensual × meses transcurridos de vigencia.
  // Es una referencia, no una cifra contable: no contempla prorrateos ni
  // ajustes fuera del contrato.
  const meses = mesesTranscurridos(contract.start_date, contract.end_date);
  const pactado = meses != null ? Number(contract.monthly_value || 0) * meses : null;
  const brecha = pactado != null ? facturado - pactado : null;

  const pct = vigenciaPct(contract.start_date, contract.end_date);
  const dleft = contract.end_date
    ? Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4 text-primary" /> {tipo}
          </SheetTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${CONTRACT_STATUS_META[(contract.status || "vigente") as ContractStatus]?.tone ?? ""}`}>
              {CONTRACT_STATUS_META[(contract.status || "vigente") as ContractStatus]?.label ?? contract.status}
            </Badge>
            {contract.auto_renewal && (
              <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30">
                <RefreshCw className="h-2.5 w-2.5" /> Renovación auto
              </Badge>
            )}
            {contract.payment_terms && <Badge variant="outline" className="text-[10px]">{contract.payment_terms}</Badge>}
            <Badge variant="outline" className="text-[10px]">{cur}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* ── Vigencia ── */}
          <div>
            <SectionLabel className="mb-2">Vigencia</SectionLabel>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {fmtDate(contract.start_date)} → {contract.end_date ? fmtDate(contract.end_date) : "indefinido"}
              </span>
              <span className={`font-semibold ${
                contract.auto_renewal ? "text-success"
                : dleft == null ? "text-muted-foreground"
                : dleft < 0 ? "text-destructive"
                : dleft < 90 ? "text-warning" : "text-muted-foreground"}`}>
                {contract.auto_renewal ? "renueva solo"
                  : dleft == null ? "sin vencimiento"
                  : dleft < 0 ? `vencido hace ${Math.abs(dleft)}d`
                  : `faltan ${dleft} días`}
              </span>
            </div>
            {pct != null && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          {/* ── Economía ── */}
          <div>
            <SectionLabel className="mb-2">Economía</SectionLabel>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Card><CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-bold">Valor mensual</p>
                <p className="text-lg font-black tabular-nums"><Confidential show={canAmounts}>{n0(contract.monthly_value)}</Confidential></p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-bold">Tarifa hora</p>
                <p className="text-lg font-black tabular-nums"><Confidential show={canAmounts}>{n0(contract.hourly_rate)}</Confidential></p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-bold">Horas incl.</p>
                <p className="text-lg font-black tabular-nums">{n0(contract.included_hours)}</p>
              </CardContent></Card>
            </div>

            {/* Facturado contra pactado */}
            <Card><CardContent className="p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="h-3 w-3" /> Facturado</span>
                <span className="font-bold tabular-nums"><Confidential show={canAmounts}>{n0(facturado)} {cur}</Confidential></span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Cobrado</span>
                <span className="tabular-nums"><Confidential show={canAmounts}>{n0(cobrado)} {cur}</Confidential></span>
              </div>
              {pactado != null ? (
                <>
                  <div className="flex items-center justify-between text-xs border-t border-border pt-1.5">
                    <span className="text-muted-foreground">Pactado a la fecha ({meses} {meses === 1 ? "mes" : "meses"})</span>
                    <span className="tabular-nums"><Confidential show={canAmounts}>{n0(pactado)} {cur}</Confidential></span>
                  </div>
                  {Math.abs(brecha ?? 0) > 0.5 && (
                    <p className={`text-[11px] font-semibold ${(brecha ?? 0) < 0 ? "text-warning" : "text-success"}`}>
                      <Confidential show={canAmounts}>
                        {(brecha ?? 0) < 0
                          ? `Falta facturar ${n0(Math.abs(brecha ?? 0))} ${cur} respecto de lo pactado`
                          : `Facturado ${n0(brecha ?? 0)} ${cur} por encima de lo pactado`}
                      </Confidential>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground border-t border-border pt-1.5">
                  Sin fecha de inicio: no se puede calcular lo pactado a la fecha.
                </p>
              )}
              {otrasMonedas.length > 0 && (
                <p className="text-[11px] text-warning flex items-start gap-1">
                  <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0" />
                  Hay paquetes facturados en {otrasMonedas.join(", ")}; no se suman porque el contrato está en {cur}.
                </p>
              )}
            </CardContent></Card>
          </div>

          {/* ── Pólizas originadas por este contrato ── */}
          <div>
            <SectionLabel className="mb-2">Pólizas vinculadas ({pkgs.length})</SectionLabel>
            {pkgs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ninguna póliza está vinculada a este contrato. Se asignan desde la pestaña Pólizas.
              </p>
            ) : (
              <Card><CardContent className="p-3 space-y-2">
                {pkgs.map(p => {
                  const vigente = p.end_date >= new Date().toLocaleDateString("en-CA");
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <ShieldCheck className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">Póliza {p.policy_number} · Paquete {p.package_number}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums">{n2(p.hours_contracted)} h</span>
                        <Badge variant={vigente ? "default" : "secondary"} className="text-[9px]">{vigente ? "Vigente" : "Vencida"}</Badge>
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between text-xs font-bold border-t border-border pt-2">
                  <span>Total horas contratadas</span>
                  <span className="tabular-nums">{n2(horasPkgs)} h</span>
                </div>
              </CardContent></Card>
            )}
          </div>

          {/* ── Hitos ── */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5"><Milestone className="h-3 w-3" /> Hitos de facturación</SectionLabel>
            <ContractMilestonesPanel contractId={contract.id} />
          </div>

          {/* ── Documentos de la base de conocimiento ── */}
          <div>
            <SectionLabel className="mb-2">Documentos ({docs.length})</SectionLabel>
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin documentos asociados. Se cargan desde la pestaña Base de conocimiento.
              </p>
            ) : (
              <div className="space-y-1.5">
                {docs.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{d.filename}</span>
                    </span>
                    <Badge variant="outline" className="text-[9px] shrink-0">{d.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SLAs ── */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5"><Shield className="h-3 w-3" /> SLAs</SectionLabel>
            {/* Los SLAs se definen por CLIENTE, no por contrato: hoy el modelo no
                permite pactar tiempos distintos en dos contratos del mismo cliente. */}
            <p className="text-[11px] text-muted-foreground mb-2">
              Los SLAs se pactan a nivel de cliente, así que aplican a todos sus contratos.
            </p>
            {slas.filter(s => s.is_active).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin SLAs activos.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slas.filter(s => s.is_active).map(s => (
                  <Badge key={s.id} variant="outline" className="text-[10px] gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {s.priority_level}: {s.response_time_hours}h / {s.resolution_time_hours}h
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* ── Adendas ── */}
          <div>
            <SectionLabel className="mb-2">Adendas ({amendments.length})</SectionLabel>
            {amendments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin adendas. Son las modificaciones formales acordadas sobre el contrato original.
              </p>
            ) : (
              <div className="space-y-2">
                {amendments.map(a => (
                  <Card key={a.id}><CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold">
                        {a.numero != null ? `#${a.numero} · ` : ""}{a.titulo}
                      </p>
                      {a.effective_date && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(a.effective_date)}</span>
                      )}
                    </div>
                    {a.descripcion && <p className="text-[11px] text-muted-foreground mt-1">{a.descripcion}</p>}
                    <div className="flex gap-3 mt-1.5 text-[11px]">
                      {a.nuevo_valor_mensual != null && (
                        <span className="tabular-nums">
                          <Confidential show={canAmounts}>Nuevo valor: {n0(a.nuevo_valor_mensual)} {a.moneda || cur}</Confidential>
                        </span>
                      )}
                      {a.nueva_fecha_fin && <span>Nueva fecha fin: {fmtDate(a.nueva_fecha_fin)}</span>}
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            )}
          </div>

          {/* ── Historial ── */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5"><History className="h-3 w-3" /> Historial</SectionLabel>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin cambios registrados. La bitácora empieza a llenarse con las modificaciones posteriores a su activación.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="text-xs border-l-2 border-border pl-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{ACTION_LABEL[h.action] ?? h.action}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(h.changed_at).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    {Object.entries(h.changes || {}).map(([f, c]) => (
                      <p key={f} className="text-[11px] text-muted-foreground">
                        {FIELD_LABEL[f] ?? f}: <span className="line-through">{val(c.old)}</span> → <b className="text-foreground">{val(c.new)}</b>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {contract.notes && (
            <div>
              <SectionLabel className="mb-1.5">Notas</SectionLabel>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{contract.notes}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
