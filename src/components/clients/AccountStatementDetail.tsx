import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Building2, Calendar, FileText } from "lucide-react";
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

/**
 * Detalle estructurado, estilo contable, del estado de cuenta.
 * Reúne contrato, consumo (horas valorizadas), paquetes facturados y
 * cotizaciones en un libro de cargos/abonos + desgloses. Reutilizable en el
 * Portal Cliente y en el portal interno SYSDE (lo abre AccountStatementPanel).
 */
export function AccountStatementDetail({ open, onOpenChange, stmt, clientId }: Props) {
  const cur = stmt.currency;
  const { data: packages = [] } = useBilledPackages(clientId);

  // Paquetes facturados dentro del período (por billed_date).
  const periodPackages = useMemo(() => {
    const from = stmt.period.start, to = stmt.period.end;
    return packages.filter(p => p.billed_date && p.billed_date >= from && p.billed_date <= to && p.status !== "anulado");
  }, [packages, stmt.period]);

  const money = (n: number) => `${Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

  // ── Libro de cargos del período ──
  const hourlyRate = stmt.contract?.hourly_rate ?? 0;
  const monthly = stmt.contract?.monthly_value ?? 0;
  const overageHours = stmt.consumption.overage_hours ?? 0;
  const overageCost = overageHours * hourlyRate;
  const packagesTotal = periodPackages.reduce((s, p) => s + Number(p.total_amount), 0);
  const quotesTotal = stmt.quotes.approved_in_period.reduce((s, q) => s + Number(q.total_amount), 0);

  const charges: Array<{ concepto: string; detalle: string; monto: number }> = [];
  if (stmt.contract) {
    charges.push({
      concepto: "Cuota del contrato",
      detalle: `${stmt.contract.contract_type} · ${stmt.contract.included_hours} h incluidas`,
      monto: monthly,
    });
  }
  if (overageCost > 0) {
    charges.push({
      concepto: "Sobreconsumo de horas",
      detalle: `${overageHours.toFixed(2)} h × ${money(hourlyRate)}/h`,
      monto: overageCost,
    });
  }
  if (packagesTotal > 0) {
    charges.push({
      concepto: "Paquetes facturados",
      detalle: `${periodPackages.length} paquete(s) en el período`,
      monto: packagesTotal,
    });
  }
  if (quotesTotal > 0) {
    charges.push({
      concepto: "Cotizaciones aprobadas",
      detalle: `${stmt.quotes.approved_in_period.length} cotización(es)`,
      monto: quotesTotal,
    });
  }
  const totalCargos = charges.reduce((s, c) => s + c.monto, 0);

  const handleExport = () => {
    try { exportAccountStatementPdf(stmt); toast.success("PDF descargado"); }
    catch (e: any) { toast.error(e?.message || "Error al generar PDF"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Detalle del estado de cuenta
          </DialogTitle>
        </DialogHeader>

        {/* Encabezado contable */}
        <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Cliente</p>
            <p className="font-semibold">{stmt.client.name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Período</p>
            <p className="font-semibold">{stmt.period.start} → {stmt.period.end}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Moneda</p>
            <p className="font-semibold">{cur}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Emitido</p>
            <p className="font-semibold">{new Date(stmt.generated_at).toLocaleDateString("es-CR")}</p>
          </div>
        </div>

        {/* Resumen de cargos (libro) */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Resumen de cargos del período</h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Concepto</TableHead>
                  <TableHead className="text-xs">Detalle</TableHead>
                  <TableHead className="text-xs text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">Sin cargos en el período</TableCell></TableRow>
                ) : charges.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{c.concepto}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{c.detalle}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{money(c.monto)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-muted/40">
                  <TableCell className="text-sm font-bold" colSpan={2}>Total cargos del período</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-bold">{money(totalCargos)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Estado financiero acumulado (NO del período) */}
        {stmt.financials && (
          <section className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Estado financiero (acumulado)</h3>
            <p className="text-[10px] text-muted-foreground">Cifras acumuladas históricas del cliente — no corresponden al período seleccionado.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center pt-1">
              <div className="rounded-lg border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Valor contrato</p>
                <p className="text-sm font-bold tabular-nums">{money(Number(stmt.financials.contract_value))}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Facturado</p>
                <p className="text-sm font-bold tabular-nums">{money(Number(stmt.financials.billed))}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Pagado</p>
                <p className="text-sm font-bold tabular-nums text-success">{money(Number(stmt.financials.paid))}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Pendiente</p>
                <p className="text-sm font-bold tabular-nums text-warning">{money(Number(stmt.financials.pending))}</p>
              </div>
            </div>
          </section>
        )}

        {/* Consumo de horas */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Consumo de horas</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Consumidas</p>
              <p className="text-lg font-bold tabular-nums">{Number(stmt.consumption.total_hours).toFixed(2)} h</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Incluidas</p>
              <p className="text-lg font-bold tabular-nums">{stmt.consumption.included_hours} h</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Sobreconsumo</p>
              <p className={`text-lg font-bold tabular-nums ${overageHours > 0 ? "text-destructive" : ""}`}>{overageHours.toFixed(2)} h</p>
            </div>
          </div>

          {stmt.consumption.by_item.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Caso / ítem</TableHead>
                    <TableHead className="text-xs text-right">Entradas</TableHead>
                    <TableHead className="text-xs text-right">Horas</TableHead>
                    <TableHead className="text-xs text-right">Valor ({cur})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stmt.consumption.by_item.map((it, i) => (
                    <TableRow key={`${it.item_id}-${i}`}>
                      <TableCell className="text-xs">
                        {it.ticket_info ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground tabular-nums">{it.ticket_info.ticket_id}</span>
                            <Badge variant="outline" className="text-[9px] h-3.5 px-1">{it.ticket_info.estado}</Badge>
                            <span className="truncate">{it.ticket_info.asunto}</span>
                          </span>
                        ) : `${it.source}: ${it.item_id}`}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{it.entries_count}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{Number(it.hours).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{money(Number(it.hours) * hourlyRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {stmt.consumption.by_user.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Colaborador SYSDE</TableHead>
                    <TableHead className="text-xs text-right">Entradas</TableHead>
                    <TableHead className="text-xs text-right">Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stmt.consumption.by_user.map(u => (
                    <TableRow key={u.user_id}>
                      <TableCell className="text-xs">{u.user_name}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{u.entries_count}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{Number(u.hours).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Paquetes facturados */}
        {periodPackages.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Paquetes facturados</h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Paquete</TableHead>
                    <TableHead className="text-xs">Factura</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodPackages.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{p.name}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{p.invoice_number || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px]">{STATUS_LABEL[p.status] || p.status}</Badge></TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{money(Number(p.total_amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {/* Cotizaciones */}
        {(stmt.quotes.approved_in_period.length > 0 || stmt.quotes.pending_count > 0) && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Cotizaciones</h3>
            {stmt.quotes.approved_in_period.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Aprobadas en el período</TableHead>
                      <TableHead className="text-xs text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stmt.quotes.approved_in_period.map(q => (
                      <TableRow key={q.id}>
                        <TableCell className="text-xs">
                          <span className="text-[10px] text-muted-foreground tabular-nums mr-1.5">{q.quote_number}</span>{q.title}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{money(Number(q.total_amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {stmt.quotes.pending_count > 0 && (
              <p className="text-[11px] text-info">
                {stmt.quotes.pending_count} cotización(es) pendiente(s) de aprobar por {money(Number(stmt.quotes.pending_total))}.
              </p>
            )}
          </section>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={handleExport} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Exportar PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
