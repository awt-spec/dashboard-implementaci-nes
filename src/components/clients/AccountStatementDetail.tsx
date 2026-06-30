import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Download, Building2, Calendar, Clock, TrendingUp, Wallet,
  Package, Receipt, Users, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { type AccountStatement } from "@/hooks/useAccountStatement";
import { useBilledPackages } from "@/hooks/useBilledPackages";
import { exportAccountStatementPdf } from "@/lib/exportAccountStatementPdf";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stmt: AccountStatement;
  clientId: string;
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente", facturado: "Facturado", pagado: "Pagado", anulado: "Anulado",
};
const STATUS_TONE: Record<string, string> = {
  pendiente: "bg-muted text-muted-foreground",
  facturado: "bg-info/15 text-info border-info/30",
  pagado: "bg-success/15 text-success border-success/30",
  anulado: "bg-destructive/10 text-destructive border-destructive/30",
};

/**
 * Detalle estructurado, estilo documento contable, del estado de cuenta.
 * Reutilizable en el Portal Cliente y en el portal interno SYSDE.
 */
export function AccountStatementDetail({ open, onOpenChange, stmt, clientId }: Props) {
  const cur = stmt.currency;
  const { data: packages = [] } = useBilledPackages(clientId);

  const periodPackages = useMemo(() => {
    const from = stmt.period.start, to = stmt.period.end;
    return packages.filter(p => p.billed_date && p.billed_date >= from && p.billed_date <= to && p.status !== "anulado");
  }, [packages, stmt.period]);

  const money = (n: number) => `${Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  const moneyShort = (n: number) => Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hourlyRate = stmt.contract?.hourly_rate ?? 0;
  const monthly = stmt.contract?.monthly_value ?? 0;
  const overageHours = stmt.consumption.overage_hours ?? 0;
  const overageCost = overageHours * hourlyRate;
  const packagesTotal = periodPackages.reduce((s, p) => s + Number(p.total_amount), 0);
  const quotesTotal = stmt.quotes.approved_in_period.reduce((s, q) => s + Number(q.total_amount), 0);
  const totalHours = Number(stmt.consumption.total_hours);
  const includedHours = Number(stmt.consumption.included_hours) || 0;
  const utilization = stmt.consumption.utilization_pct;
  const utilPct = utilization != null ? Math.min(Number(utilization), 100) : (includedHours > 0 ? Math.min((totalHours / includedHours) * 100, 100) : 0);
  const overage = overageHours > 0;

  const charges: Array<{ concepto: string; detalle: string; monto: number; Icon: typeof Wallet }> = [];
  if (stmt.contract) charges.push({ concepto: "Cuota del contrato", detalle: `${stmt.contract.contract_type} · ${includedHours} h incluidas`, monto: monthly, Icon: Wallet });
  if (overageCost > 0) charges.push({ concepto: "Sobreconsumo de horas", detalle: `${overageHours.toFixed(2)} h × ${money(hourlyRate)}/h`, monto: overageCost, Icon: AlertTriangle });
  if (packagesTotal > 0) charges.push({ concepto: "Paquetes facturados", detalle: `${periodPackages.length} paquete(s)`, monto: packagesTotal, Icon: Package });
  if (quotesTotal > 0) charges.push({ concepto: "Cotizaciones aprobadas", detalle: `${stmt.quotes.approved_in_period.length} cotización(es)`, monto: quotesTotal, Icon: Receipt });
  const totalCargos = charges.reduce((s, c) => s + c.monto, 0);

  const stmtNumber = `EC-${(clientId || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}-${stmt.period.start.replace(/-/g, "").slice(0, 6)}`;

  const handleExport = () => {
    try { exportAccountStatementPdf(stmt); toast.success("PDF descargado"); }
    catch (e: any) { toast.error(e?.message || "Error al generar PDF"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 gap-0">
        {/* ── Encabezado tipo documento ── */}
        <div className="relative bg-gradient-to-br from-[#C8200F] to-[#8e1608] text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap pr-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/70">Estado de cuenta</p>
              <h2 className="text-2xl font-black leading-tight mt-0.5">{stmt.client.name}</h2>
              <p className="text-xs text-white/80 mt-1 flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                {stmt.client.country || "—"} · <span className="font-mono">{stmtNumber}</span>
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <p className="text-white/70 flex items-center justify-end gap-1"><Calendar className="h-3 w-3" /> Período</p>
              <p className="font-bold text-sm">{stmt.period.start} → {stmt.period.end}</p>
              <p className="text-white/70 mt-1.5">Emitido {new Date(stmt.generated_at).toLocaleDateString("es-CR")} · {cur}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ── KPIs hero ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Total del período</p>
              <p className="text-xl font-black tabular-nums mt-1">{moneyShort(totalCargos)}<span className="text-[10px] font-medium text-muted-foreground ml-1">{cur}</span></p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Horas consumidas</p>
              <p className="text-xl font-black tabular-nums mt-1">{totalHours.toFixed(1)}<span className="text-[10px] font-medium text-muted-foreground ml-1">/ {includedHours} h</span></p>
              {includedHours > 0 && (
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${overage ? "bg-destructive" : utilPct > 85 ? "bg-warning" : "bg-success"}`} style={{ width: `${utilPct}%` }} />
                </div>
              )}
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Utilización</p>
              <p className={`text-xl font-black tabular-nums mt-1 ${overage ? "text-destructive" : ""}`}>{utilization != null ? `${utilization}%` : "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{overage ? `Sobreconsumo ${overageHours.toFixed(1)} h` : includedHours > 0 ? `Saldo ${(includedHours - totalHours).toFixed(1)} h` : "Sin bolsa"}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> Cotizaciones aprob.</p>
              <p className="text-xl font-black tabular-nums mt-1">{moneyShort(quotesTotal)}<span className="text-[10px] font-medium text-muted-foreground ml-1">{cur}</span></p>
              {stmt.quotes.pending_count > 0 && <p className="text-[10px] text-info mt-0.5">+{stmt.quotes.pending_count} pend. ({moneyShort(Number(stmt.quotes.pending_total))})</p>}
            </div>
          </div>

          {/* ── Resumen de cargos ── */}
          <Section icon={<Wallet className="h-3.5 w-3.5" />} title="Resumen de cargos del período">
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-[10px] uppercase">Concepto</TableHead>
                    <TableHead className="text-[10px] uppercase">Detalle</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-5">Sin cargos en el período</TableCell></TableRow>
                  ) : charges.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium"><span className="inline-flex items-center gap-1.5"><c.Icon className="h-3 w-3 text-muted-foreground" />{c.concepto}</span></TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.detalle}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{money(c.monto)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-gradient-to-r from-primary/5 to-transparent">
                    <TableCell className="text-sm font-black" colSpan={2}>Total cargos del período</TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-black text-primary">{money(totalCargos)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Section>

          {/* ── Consumo de horas ── */}
          <Section icon={<Clock className="h-3.5 w-3.5" />} title="Consumo de horas">
            {stmt.consumption.by_item.length > 0 ? (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-[10px] uppercase">Caso / ítem</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Entradas</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Horas</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Valor ({cur})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stmt.consumption.by_item.map((it, i) => (
                      <TableRow key={`${it.item_id}-${i}`}>
                        <TableCell className="text-xs">
                          {it.ticket_info ? (
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{it.ticket_info.ticket_id}</span>
                              <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">{it.ticket_info.estado}</Badge>
                              <span className="truncate">{it.ticket_info.asunto}</span>
                            </span>
                          ) : `${it.source}: ${it.item_id}`}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{it.entries_count}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums font-medium">{Number(it.hours).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{money(Number(it.hours) * hourlyRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">Sin horas registradas en el período.</p>
            )}

            {stmt.consumption.by_user.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/30 text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> Por colaborador SYSDE
                </div>
                <Table>
                  <TableBody>
                    {stmt.consumption.by_user.map(u => (
                      <TableRow key={u.user_id}>
                        <TableCell className="text-xs">{u.user_name}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground w-24">{u.entries_count} entradas</TableCell>
                        <TableCell className="text-xs text-right tabular-nums font-medium w-20">{Number(u.hours).toFixed(2)} h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>

          {/* ── Cotizaciones ── */}
          {(stmt.quotes.approved_in_period.length > 0 || stmt.quotes.pending_count > 0) && (
            <Section icon={<Receipt className="h-3.5 w-3.5" />} title="Cotizaciones">
              {stmt.quotes.approved_in_period.length > 0 && (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-[10px] uppercase">Aprobadas en el período</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stmt.quotes.approved_in_period.map(q => (
                        <TableRow key={q.id}>
                          <TableCell className="text-xs"><span className="text-[10px] text-muted-foreground tabular-nums mr-1.5">{q.quote_number}</span>{q.title}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums font-medium">{money(Number(q.total_amount))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {stmt.quotes.pending_count > 0 && (
                <div className="rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-[11px] text-info flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 shrink-0" />
                  {stmt.quotes.pending_count} cotización(es) pendiente(s) de aprobar por <strong>{money(Number(stmt.quotes.pending_total))}</strong>.
                </div>
              )}
            </Section>
          )}

          {/* ── Paquetes facturados ── */}
          {periodPackages.length > 0 && (
            <Section icon={<Package className="h-3.5 w-3.5" />} title="Paquetes facturados">
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-[10px] uppercase">Paquete</TableHead>
                      <TableHead className="text-[10px] uppercase">Factura</TableHead>
                      <TableHead className="text-[10px] uppercase">Estado</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodPackages.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{p.name}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{p.invoice_number || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[9px] ${STATUS_TONE[p.status] || ""}`}>{STATUS_LABEL[p.status] || p.status}</Badge></TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{money(Number(p.total_amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Section>
          )}

          {/* ── Estado financiero acumulado (NO del período) ── */}
          {stmt.financials && (
            <Section icon={<Wallet className="h-3.5 w-3.5" />} title="Estado financiero (acumulado)" subtitle="Cifras históricas del cliente — no corresponden al período seleccionado.">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <FinCell label="Valor contrato" value={money(Number(stmt.financials.contract_value))} />
                <FinCell label="Facturado" value={money(Number(stmt.financials.billed))} />
                <FinCell label="Pagado" value={money(Number(stmt.financials.paid))} tone="text-success" />
                <FinCell label="Pendiente" value={money(Number(stmt.financials.pending))} tone="text-warning" />
              </div>
            </Section>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t bg-muted/20 sticky bottom-0">
          <p className="text-[10px] text-muted-foreground italic">Generado el {new Date(stmt.generated_at).toLocaleString("es-CR")}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button size="sm" onClick={handleExport} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Exportar PDF</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1.5">
          <span className="text-primary">{icon}</span>{title}
        </h3>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function FinCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums mt-0.5 ${tone || ""}`}>{value}</p>
    </div>
  );
}
