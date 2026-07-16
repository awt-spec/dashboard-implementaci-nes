import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Confidential } from "@/components/common/Confidential";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { useAccountStatement360 } from "@/hooks/useAccountStatement360";
import {
  Loader2, ChevronRight, TriangleAlert, Gem, Building2,
} from "lucide-react";

const money = (n: number, c: string) => `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${c}`;

function Section({ title, tag, fig, figTone, defaultOpen, children }: {
  title: string; tag?: string; fig?: React.ReactNode; figTone?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen((o) => !o)}>
        <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="text-sm font-semibold">{title}</span>
        {tag && <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{tag}</span>}
        {fig != null && <span className={`ml-auto text-sm font-bold tabular-nums ${figTone || ""}`}>{fig}</span>}
      </button>
      {open && <CardContent className="pt-0 pb-4 border-t border-border">{children}</CardContent>}
    </Card>
  );
}

const CHIP: Record<string, string> = {
  pagado: "bg-success/10 text-success border-success/30", facturado: "bg-info/10 text-info border-info/30",
  pendiente: "bg-warning/10 text-warning border-warning/30", anulado: "bg-muted text-muted-foreground",
  fuera: "bg-destructive/10 text-destructive border-destructive/30", dudoso: "bg-warning/10 text-warning border-warning/30",
  cumplido: "bg-success/10 text-success border-success/30", propuesto: "bg-muted text-muted-foreground",
  confirmado: "bg-info/10 text-info border-info/30",
};

export function AccountStatement360({ clientId }: { clientId: string }) {
  const { data: s, isLoading } = useAccountStatement360(clientId);
  const { canAmounts } = useFinanceAccess();

  if (isLoading) return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;
  if (!s) return null;

  const c$ = (n: number) => <Confidential show={canAmounts}>{money(n, s.currency)}</Confidential>;
  const hoursTone = s.hours.over > 0 ? "text-destructive" : s.hours.pct >= 80 ? "text-warning" : "";
  const subActive = s.subscription?.active;

  return (
    <div className="space-y-4">
      {/* Encabezado de salud */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="text-sm font-bold flex items-center gap-1.5"><Building2 className="h-4 w-4 text-primary" /> Estado de Cuenta 360</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {s.contract ? `${s.contract.contract_type} · ${s.currency} · ${s.contract.start_date || "—"} → ${s.contract.end_date || "indef."}` : "Sin contrato activo"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {s.subscription && <Badge variant="outline" className={`text-[10px] ${subActive ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>{subActive ? "Servicio al día" : "Pago vencido"}</Badge>}
            {s.hours.included > 0 && <Badge variant="outline" className={`text-[10px] ${s.hours.over > 0 ? "bg-destructive/10 text-destructive border-destructive/30" : s.hours.pct >= 80 ? "bg-warning/10 text-warning border-warning/30" : "bg-muted"}`}>Horas {Math.round(s.hours.pct)}%</Badge>}
            {s.scope.fuera > 0 && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">{s.scope.fuera} fuera de alcance</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* KPI ledger */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Valor contrato" value={c$(s.financials.contractValue)} />
        <KPI label="Pagado" value={c$(s.financials.paid)} tone="text-success" />
        <KPI label="Pendiente" value={c$(s.financials.pending)} tone={s.financials.pending > 0 ? "text-warning" : ""} />
        <KPI label="Consumo horas" value={<span className={hoursTone}>{s.hours.consumed}/{s.hours.included}h</span>} sub={s.hours.periodLabel || undefined} />
      </div>

      {/* Análisis (insights) */}
      {(s.insights.risks.length > 0 || s.insights.opportunities.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {s.insights.risks.length > 0 && (
            <Card><CardContent className="p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-destructive flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" /> Riesgos</p>
              <ul className="mt-2 space-y-1.5 text-[12.5px] text-foreground/85 list-disc pl-4">{s.insights.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </CardContent></Card>
          )}
          {s.insights.opportunities.length > 0 && (
            <Card><CardContent className="p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-success flex items-center gap-1.5"><Gem className="h-3.5 w-3.5" /> Oportunidades</p>
              <ul className="mt-2 space-y-1.5 text-[12.5px] text-foreground/85 list-disc pl-4">{s.insights.opportunities.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* Secciones con subzoom */}
      <div className="space-y-2.5">
        {/* Financiero */}
        <Section title="Financiero" tag="pendiente" fig={c$(s.financials.pending)} figTone={s.financials.pending > 0 ? "text-warning" : ""} defaultOpen>
          {s.invoices.length === 0 ? <p className="text-sm text-muted-foreground py-3">Sin documentos de facturación.</p> : (
            <div className="overflow-x-auto pt-3"><table className="w-full text-xs">
              <thead><tr className="text-[10px] uppercase text-muted-foreground"><th className="text-left font-semibold pb-1.5">Paquete</th><th className="text-right font-semibold pb-1.5">Monto</th><th className="text-left font-semibold pb-1.5 pl-3">Estado</th></tr></thead>
              <tbody>{s.invoices.slice(0, 12).map((p: any) => (
                <tr key={p.id} className="border-t border-border/60"><td className="py-1.5">{p.name}</td><td className="py-1.5 text-right tabular-nums font-mono">{c$(Number(p.total_amount || 0))}</td><td className="py-1.5 pl-3"><Badge variant="outline" className={`text-[9px] ${CHIP[p.status] || ""}`}>{p.status}</Badge></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Section>

        {/* Bolsa de horas */}
        <Section title="Bolsa de horas" tag="consumo del mes" fig={<span className={hoursTone}>{s.hours.consumed}/{s.hours.included}h</span>}>
          <div className="pt-3 space-y-1.5">
            {s.hours.byMonth.length === 0 ? <p className="text-sm text-muted-foreground">Sin horas registradas.</p> : s.hours.byMonth.slice().reverse().map((m, i) => {
              const p = s.hours.included > 0 ? (m.hours / s.hours.included) * 100 : 0;
              const tone = p >= 100 ? "bg-destructive" : p >= 80 ? "bg-warning" : "bg-primary";
              return (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="w-14 text-muted-foreground">{m.label}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(3, p))}%` }} /></div>
                  <span className="w-20 text-right tabular-nums font-mono">{m.hours}/{s.hours.included}h</span>
                </div>
              );
            })}
            {s.hours.over > 0 && <p className="text-[11px] text-destructive pt-1">Excedido {s.hours.over.toFixed(1)} h sobre el cupo en {s.hours.periodLabel}.</p>}
          </div>
        </Section>

        {/* Suscripción */}
        {s.subscription && (
          <Section title="Suscripción & pagos" tag="próximo pago" fig={<span className="font-mono">{s.subscription.nextPayment || "—"}</span>} figTone={subActive ? "" : "text-destructive"}>
            <div className="pt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
              <span><span className="text-muted-foreground">Ciclo:</span> {s.subscription.cycle}</span>
              {s.subscription.amount != null && <span><span className="text-muted-foreground">Monto:</span> {c$(s.subscription.amount)}</span>}
              <span><span className="text-muted-foreground">Estado:</span> <span className={subActive ? "text-success" : "text-destructive"}>{subActive ? "activa · al día" : "vencida"}</span></span>
            </div>
          </Section>
        )}

        {/* SLA */}
        {s.slas.length > 0 && (
          <Section title="Acuerdos de servicio (SLA)" tag="configurados" fig={<span>{s.slas.length}</span>}>
            <div className="overflow-x-auto pt-3"><table className="w-full text-xs">
              <thead><tr className="text-[10px] uppercase text-muted-foreground"><th className="text-left font-semibold pb-1.5">Prioridad</th><th className="text-right font-semibold pb-1.5">Respuesta</th><th className="text-right font-semibold pb-1.5">Resolución</th><th className="text-right font-semibold pb-1.5">Penalidad</th></tr></thead>
              <tbody>{s.slas.map((sl, i) => (
                <tr key={i} className="border-t border-border/60"><td className="py-1.5"><Badge variant="outline" className="text-[9px]">{sl.priority_level}</Badge></td><td className="py-1.5 text-right tabular-nums font-mono">{sl.response_time_hours}h</td><td className="py-1.5 text-right tabular-nums font-mono">{sl.resolution_time_hours}h</td><td className="py-1.5 text-right tabular-nums font-mono">{sl.penalty_amount ? c$(Number(sl.penalty_amount)) : "—"}</td></tr>
              ))}</tbody>
            </table></div>
          </Section>
        )}

        {/* Hitos */}
        {s.milestones.length > 0 && (
          <Section title="Hitos de facturación" tag="avance" fig={<span>{s.milestones.filter((m) => m.status === "facturado").length}/{s.milestones.length}</span>}>
            <div className="pt-3 flex flex-col gap-1.5">{s.milestones.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">{m.descripcion}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {m.monto != null && <span className="tabular-nums font-mono text-muted-foreground">{c$(Number(m.monto))}</span>}
                  <Badge variant="outline" className={`text-[9px] ${CHIP[m.status] || ""}`}>{m.status}</Badge>
                </div>
              </div>
            ))}</div>
          </Section>
        )}

        {/* Alcance */}
        <Section title="Alcance del contrato (auditoría IA)" tag={s.scope.ranAt ? "fuera de alcance" : "sin correr"} fig={<span className={s.scope.fuera > 0 ? "text-destructive" : "text-success"}>{s.scope.fuera}</span>}>
          <div className="pt-3">
            {!s.scope.ranAt ? (
              <p className="text-sm text-muted-foreground">Aún no se ha corrido la auditoría de alcance. Corréla en Contratos & SLA → Auditoría → "Auditar alcance".</p>
            ) : s.scope.hallazgos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin gestiones auditadas.</p>
            ) : (
              <>
                <div className="overflow-x-auto"><table className="w-full text-xs">
                  <thead><tr className="text-[10px] uppercase text-muted-foreground"><th className="text-left font-semibold pb-1.5">Caso</th><th className="text-left font-semibold pb-1.5">Motivo</th><th className="text-left font-semibold pb-1.5 pl-2">Veredicto</th></tr></thead>
                  <tbody>{s.scope.hallazgos.filter((h) => h.veredicto !== "dentro").slice(0, 10).map((h, i) => (
                    <tr key={i} className="border-t border-border/60"><td className="py-1.5 font-mono">{h.ticket_id}</td><td className="py-1.5 text-muted-foreground">{h.razon}</td><td className="py-1.5 pl-2"><Badge variant="outline" className={`text-[9px] ${CHIP[h.veredicto] || ""}`}>{h.veredicto}</Badge></td></tr>
                  ))}</tbody>
                </table></div>
                {s.scope.facturableFuera > 0 && <p className="text-[11px] text-success pt-2">≈ {s.scope.horasFuera.toFixed(1)} h fuera de alcance → {c$(s.scope.facturableFuera)} facturables.</p>}
              </>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`text-xl font-black tabular-nums mt-1 ${tone || ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}
