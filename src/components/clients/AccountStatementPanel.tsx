import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Calendar, Clock, FileText, Users, AlertTriangle, TrendingUp, ListTree, Package, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip } from "recharts";
import { useAccountStatement, getPeriodDates, type StatementPeriod } from "@/hooks/useAccountStatement";
import { exportAccountStatementPdf } from "@/lib/exportAccountStatementPdf";
import { useSysdeStatementData, toSysdeExportData } from "@/hooks/useSysdeStatementData";
import { AccountStatementDetail } from "./AccountStatementDetail";

const PERIOD_OPTIONS: Array<{ value: StatementPeriod; label: string }> = [
  { value: "current_month",    label: "Mes corriente" },
  { value: "previous_month",   label: "Mes anterior" },
  { value: "last_30_days",     label: "Últimos 30 días" },
  { value: "current_quarter",  label: "Trimestre corriente" },
  { value: "year_to_date",     label: "Año a la fecha" },
  { value: "custom",           label: "Personalizado" },
];

interface Props {
  clientId: string;
}

const n2 = (v: number) => Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

export function AccountStatementPanel({ clientId }: Props) {
  const [period, setPeriod] = useState<StatementPeriod>("current_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  const dates = useMemo(
    () => getPeriodDates(period, { from: customFrom, to: customTo }),
    [period, customFrom, customTo],
  );

  const { data: stmt, isLoading, error, refetch } = useAccountStatement(clientId, dates);

  const { loadingPkgs, pkgRows, rows, totals } = useSysdeStatementData(stmt, clientId);

  const handleExport = async () => {
    if (!stmt) return;
    try {
      await exportAccountStatementPdf(stmt, toSysdeExportData({ pkgRows, rows, totals }));
      toast.success("PDF descargado");
    } catch (e: any) {
      toast.error(e?.message || "Error al generar PDF");
    }
  };

  const overage = stmt && stmt.consumption.overage_hours > 0;
  const utilization = stmt?.consumption.utilization_pct ?? null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={period} onValueChange={(v) => setPeriod(v as StatementPeriod)}>
              <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-xs w-[140px]"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-xs w-[140px]"
              />
            </>
          )}
          <span className="text-[10px] text-muted-foreground ml-2">
            {dates.from} → {dates.to}
          </span>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-8 text-xs">
              Actualizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDetailOpen(true)}
              disabled={!stmt || isLoading}
              className="h-8 gap-1.5"
            >
              <ListTree className="h-3.5 w-3.5" /> Ver detalle
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={!stmt || isLoading}
              className="h-8 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-xs text-destructive">
            {(error as Error).message || "No se pudo cargar el estado de cuenta."}
          </CardContent>
        </Card>
      )}

      {stmt && !isLoading && (
        <>
          {/* Resumen — 3 KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Horas consumidas</p>
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {Number(stmt.consumption.total_hours).toFixed(1)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">h</span>
                </p>
                {stmt.consumption.included_hours > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    de {stmt.consumption.included_hours} h contratadas
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className={overage ? "border-destructive/40 bg-destructive/5" : utilization !== null && utilization > 85 ? "border-warning/40 bg-warning/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Utilización</p>
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                {utilization !== null ? (
                  <>
                    <p className={`text-2xl font-bold tabular-nums ${overage ? "text-destructive" : ""}`}>
                      {utilization}<span className="text-xs font-normal text-muted-foreground ml-1">%</span>
                    </p>
                    {overage && (
                      <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Sobreconsumo de {Number(stmt.consumption.overage_hours).toFixed(1)} h
                      </p>
                    )}
                    {!overage && stmt.consumption.included_hours > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Saldo: {(stmt.consumption.included_hours - stmt.consumption.total_hours).toFixed(1)} h
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sin contrato activo</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Cotizaciones aprobadas</p>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {stmt.quotes.approved_in_period
                    .reduce((s, q) => s + Number(q.total_amount), 0)
                    .toFixed(2)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">{stmt.currency}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stmt.quotes.approved_in_period.length} cotizacion(es) en el período
                </p>
                {stmt.quotes.pending_count > 0 && (
                  <p className="text-[10px] text-info mt-1">
                    +{stmt.quotes.pending_count} pendiente(s) ({Number(stmt.quotes.pending_total).toFixed(0)} {stmt.currency})
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contrato */}
          {stmt.contract && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Contrato activo</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 pt-0">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Tipo</p>
                  <p className="text-xs font-medium">{stmt.contract.contract_type}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Bolsa</p>
                  <p className="text-xs font-medium">{stmt.contract.included_hours} h/mes</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Tarifa</p>
                  <p className="text-xs font-medium">{Number(stmt.contract.hourly_rate).toFixed(2)} {stmt.currency}/h</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Mensual</p>
                  <p className="text-xs font-medium">{Number(stmt.contract.monthly_value).toFixed(2)} {stmt.currency}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paquetes de servicio — estructura SYSDE (pólizas) */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Paquetes de servicio ({pkgRows.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingPkgs ? (
                <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : pkgRows.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">Sin paquetes en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-muted-foreground border-b">
                        <th className="text-left font-medium py-1.5 pr-2">Póliza</th>
                        <th className="text-left font-medium py-1.5 px-2">Paquete</th>
                        <th className="text-right font-medium py-1.5 px-2">Contratadas</th>
                        <th className="text-right font-medium py-1.5 px-2">Consumidas</th>
                        <th className="text-right font-medium py-1.5 px-2">Saldo</th>
                        <th className="text-left font-medium py-1.5 px-2">Vigencia</th>
                        <th className="text-center font-medium py-1.5 pl-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pkgRows.map(p => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-2 tabular-nums">{p.policy_number}</td>
                          <td className="py-1.5 px-2 tabular-nums">{p.package_number}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{n2(p.hours_contracted)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{n2(p.consumed)}</td>
                          <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${p.balance < 0 ? "text-destructive" : ""}`}>{n2(p.balance)}</td>
                          <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</td>
                          <td className="py-1.5 pl-2 text-center">
                            <Badge variant={p.estado === "Activo" ? "default" : "secondary"} className="text-[9px] h-4 px-1.5">{p.estado}</Badge>
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold border-t-2 border-border">
                        <td className="py-1.5 pr-2 text-primary" colSpan={2}>TOTALES</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{n2(totals.contracted)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{n2(totals.consumed)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{n2(totals.balance)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-2 flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Total saldo horas activas</span>
                    <span className="text-sm font-bold tabular-nums">{n2(totals.saldoActivas)} h</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sparkline por día */}
          {stmt.consumption.by_day.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Consumo por día</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-32 w-full">
                  <ResponsiveContainer>
                    <LineChart data={stmt.consumption.by_day}>
                      <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} width={30} />
                      <RTooltip
                        contentStyle={{ fontSize: 11, padding: "4px 8px" }}
                        labelFormatter={(d) => d}
                        formatter={(v: any) => [`${v} h`, "Horas"]}
                      />
                      <Line type="monotone" dataKey="hours" stroke="#C8200F" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Por colaborador */}
          {stmt.consumption.by_user.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  Por colaborador SYSDE ({stmt.consumption.by_user.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {stmt.consumption.by_user.map(u => (
                  <div key={u.user_id} className="flex justify-between items-center text-xs py-1 border-b last:border-0">
                    <span className="flex-1 truncate">{u.user_name}</span>
                    <span className="text-[10px] text-muted-foreground mx-2">{u.entries_count} entradas</span>
                    <span className="font-semibold tabular-nums w-16 text-right">{Number(u.hours).toFixed(2)} h</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Solicitudes de servicio — estructura SYSDE */}
          {rows.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  Solicitudes de servicio ({rows.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase text-muted-foreground border-b">
                      <th className="text-left font-medium py-1.5 pr-2">Id</th>
                      <th className="text-center font-medium py-1.5 px-2">Paq.</th>
                      <th className="text-left font-medium py-1.5 px-2">Producto</th>
                      <th className="text-left font-medium py-1.5 px-2">Asunto</th>
                      <th className="text-center font-medium py-1.5 px-2">Fecha</th>
                      <th className="text-left font-medium py-1.5 px-2">Tipo</th>
                      <th className="text-right font-medium py-1.5 pl-2">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.item_id} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 tabular-nums text-muted-foreground whitespace-nowrap">{r.ticket_code}</td>
                        <td className="py-1.5 px-2 text-center tabular-nums">{r.package_number ?? "—"}</td>
                        <td className="py-1.5 px-2 whitespace-nowrap">{r.producto}</td>
                        <td className="py-1.5 px-2 max-w-[240px] truncate">{r.asunto}</td>
                        <td className="py-1.5 px-2 text-center text-muted-foreground whitespace-nowrap">{fmtDate(r.fecha_registro)}</td>
                        <td className="py-1.5 px-2 whitespace-nowrap">{r.tipo}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums font-medium">{n2(r.hours)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold border-t-2 border-border">
                      <td colSpan={6} className="py-1.5 pr-2 text-right text-primary">Total tiempo invertido</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{n2(totals.invertido)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Cotizaciones aprobadas en período */}
          {stmt.quotes.approved_in_period.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  Cotizaciones aprobadas en el período
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {stmt.quotes.approved_in_period.map(q => (
                  <div key={q.id} className="flex justify-between items-center text-xs py-1 border-b last:border-0">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">{q.quote_number}</p>
                      <p className="truncate">{q.title}</p>
                    </div>
                    <span className="font-semibold tabular-nums shrink-0">
                      {Number(q.total_amount).toFixed(2)} {q.currency}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Financials */}
          {stmt.financials && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Estado financiero</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Valor contrato</p>
                  <p className="text-sm font-semibold tabular-nums">{Number(stmt.financials.contract_value).toFixed(2)} {stmt.currency}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Facturado</p>
                  <p className="text-sm font-semibold tabular-nums">{Number(stmt.financials.billed).toFixed(2)} {stmt.currency}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Pagado</p>
                  <p className="text-sm font-semibold tabular-nums text-success">{Number(stmt.financials.paid).toFixed(2)} {stmt.currency}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Pendiente</p>
                  <p className="text-sm font-semibold tabular-nums text-warning">{Number(stmt.financials.pending).toFixed(2)} {stmt.currency}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground text-center pt-2 italic">
            Generado el {new Date(stmt.generated_at).toLocaleString()}
          </p>

          <AccountStatementDetail
            open={detailOpen}
            onOpenChange={setDetailOpen}
            stmt={stmt}
            clientId={clientId}
          />
        </>
      )}
    </div>
  );
}
