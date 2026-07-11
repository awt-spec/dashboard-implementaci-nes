import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ShieldCheck, Clock, Milestone, Bell, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ExtractedTerms } from "@/hooks/useContractKb";

// Editor de los términos extraídos por la IA: todo corregible antes de aplicar.
const CONTRACT_TYPES = ["bolsa_horas", "fee_mensual", "proyecto_cerrado", "tiempo_materiales"];
const CURRENCIES = ["USD", "CRC", "EUR", "MXN", "GTQ"];
const CYCLES = ["mensual", "trimestral", "semestral", "anual"];
const PRIORITIES = ["Crítica", "Alta", "Media", "Baja"];
const CASE_TYPES = ["all", "Incidente", "Requerimiento", "Mejora", "Consulta"];

function num(v: string): number | undefined { const n = Number(v); return v === "" || isNaN(n) ? undefined : n; }

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function ContractTermsEditor({ terms, onChange }: { terms: ExtractedTerms; onChange: (t: ExtractedTerms) => void }) {
  const set = (patch: Partial<ExtractedTerms>) => onChange({ ...terms, ...patch });
  const ct = terms.contrato || {};
  const setCt = (patch: any) => set({ contrato: { ...ct, ...patch } });

  // Helpers de arrays.
  const setArr = <K extends keyof ExtractedTerms>(key: K, i: number, patch: any) => {
    const arr = [...(((terms[key] as any[]) || []))]; arr[i] = { ...arr[i], ...patch }; set({ [key]: arr } as any);
  };
  const addArr = <K extends keyof ExtractedTerms>(key: K, item: any) => set({ [key]: [...(((terms[key] as any[]) || [])), item] } as any);
  const delArr = <K extends keyof ExtractedTerms>(key: K, i: number) => set({ [key]: (((terms[key] as any[]) || [])).filter((_, x) => x !== i) } as any);

  const [newModule, setNewModule] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Términos extraídos <span className="text-[10px] font-normal text-muted-foreground">(editable)</span></h4>
        <Badge variant="outline" className="text-[10px]">Confianza {terms.confianza}%</Badge>
      </div>

      <Field label="Resumen">
        <Textarea value={terms.resumen || ""} onChange={(e) => set({ resumen: e.target.value })} rows={3} className="text-sm" />
      </Field>

      <Field label="Servicio contratado">
        <Input value={terms.servicio_contratado || ""} onChange={(e) => set({ servicio_contratado: e.target.value })} className="h-8 text-sm" />
      </Field>

      {/* Stack técnico */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Stack técnico</p>
        <Field label="Versión core">
          <Input value={terms.version_core || ""} onChange={(e) => set({ version_core: e.target.value })} className="h-8 text-sm" placeholder="ej. SVA Core 4.5" />
        </Field>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Módulos</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {(terms.modulos || []).map((m, i) => (
              <Badge key={i} variant="outline" className="text-[10px] gap-1">{m}
                <button onClick={() => set({ modulos: (terms.modulos || []).filter((_, x) => x !== i) })}><X className="h-2.5 w-2.5" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            <Input value={newModule} onChange={(e) => setNewModule(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newModule.trim()) { set({ modulos: [...(terms.modulos || []), newModule.trim()] }); setNewModule(""); } }} placeholder="Agregar módulo…" className="h-7 text-xs" />
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { if (newModule.trim()) { set({ modulos: [...(terms.modulos || []), newModule.trim()] }); setNewModule(""); } }}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </div>

      {/* Estructura del contrato */}
      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estructura del contrato</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Tipo">
            <Select value={ct.tipo || ""} onValueChange={(v) => setCt({ tipo: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{CONTRACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Moneda">
            <Select value={ct.moneda || ""} onValueChange={(v) => setCt({ moneda: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Valor mensual"><Input type="number" value={ct.valor_mensual ?? ""} onChange={(e) => setCt({ valor_mensual: num(e.target.value) })} className="h-8 text-xs" /></Field>
          <Field label="Tarifa/hora"><Input type="number" value={ct.tarifa_hora ?? ""} onChange={(e) => setCt({ tarifa_hora: num(e.target.value) })} className="h-8 text-xs" /></Field>
          <Field label="Horas incluidas"><Input type="number" value={ct.horas_incluidas ?? ""} onChange={(e) => setCt({ horas_incluidas: num(e.target.value) })} className="h-8 text-xs" /></Field>
          <Field label="Términos de pago"><Input value={ct.terminos_pago || ""} onChange={(e) => setCt({ terminos_pago: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Inicio"><Input type="date" value={ct.fecha_inicio || ""} onChange={(e) => setCt({ fecha_inicio: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Fin"><Input type="date" value={ct.fecha_fin || ""} onChange={(e) => setCt({ fecha_fin: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <div className="flex items-center gap-4 flex-wrap pt-1">
          <label className="flex items-center gap-2 text-xs"><Switch checked={!!ct.renovacion_automatica} onCheckedChange={(v) => setCt({ renovacion_automatica: v })} /> Renovación automática</label>
          <label className="flex items-center gap-2 text-xs"><Switch checked={!!ct.es_suscripcion} onCheckedChange={(v) => setCt({ es_suscripcion: v })} /> Es suscripción</label>
        </div>
        {ct.es_suscripcion && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Ciclo de facturación">
              <Select value={ct.ciclo_facturacion || "mensual"} onValueChange={(v) => setCt({ ciclo_facturacion: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Próxima fecha de pago"><Input type="date" value={ct.proxima_fecha_pago || ""} onChange={(e) => setCt({ proxima_fecha_pago: e.target.value })} className="h-8 text-xs" /></Field>
          </div>
        )}
      </div>

      {/* SLAs */}
      <EditorSection icon={<ShieldCheck className="h-3.5 w-3.5" />} title="SLAs" onAdd={() => addArr("slas", { prioridad: "Alta", tipo_caso: "all", tiempo_respuesta_horas: 4, tiempo_resolucion_horas: 24 })}>
        {(terms.slas || []).map((s, i) => (
          <div key={i} className="rounded-lg border p-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Prioridad">
                <Select value={s.prioridad || "Alta"} onValueChange={(v) => setArr("slas", i, { prioridad: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de caso">
                <Select value={s.tipo_caso || "all"} onValueChange={(v) => setArr("slas", i, { tipo_caso: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CASE_TYPES.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "Todos" : c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Respuesta (h)"><Input type="number" value={s.tiempo_respuesta_horas ?? ""} onChange={(e) => setArr("slas", i, { tiempo_respuesta_horas: num(e.target.value) })} className="h-7 text-xs" /></Field>
              <Field label="Resolución (h)"><Input type="number" value={s.tiempo_resolucion_horas ?? ""} onChange={(e) => setArr("slas", i, { tiempo_resolucion_horas: num(e.target.value) })} className="h-7 text-xs" /></Field>
              <Field label="Penalidad (monto)"><Input type="number" value={s.penalidad_monto ?? ""} onChange={(e) => setArr("slas", i, { penalidad_monto: num(e.target.value) })} className="h-7 text-xs" /></Field>
            </div>
            <RowFooter onDelete={() => delArr("slas", i)} ref={s.clausula_referencia} />
          </div>
        ))}
      </EditorSection>

      {/* Paquetes de horas */}
      <EditorSection icon={<Clock className="h-3.5 w-3.5" />} title="Paquetes de horas" onAdd={() => addArr("paquetes_horas", { descripcion: "" })}>
        {(terms.paquetes_horas || []).map((p, i) => (
          <div key={i} className="rounded-lg border p-2.5 space-y-2">
            <Field label="Descripción"><Input value={p.descripcion || ""} onChange={(e) => setArr("paquetes_horas", i, { descripcion: e.target.value })} className="h-7 text-xs" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Horas"><Input type="number" value={p.horas_incluidas ?? ""} onChange={(e) => setArr("paquetes_horas", i, { horas_incluidas: num(e.target.value) })} className="h-7 text-xs" /></Field>
              <Field label="Tarifa/h"><Input type="number" value={p.tarifa_hora ?? ""} onChange={(e) => setArr("paquetes_horas", i, { tarifa_hora: num(e.target.value) })} className="h-7 text-xs" /></Field>
              <Field label="Vencimiento"><Input value={p.vencimiento || ""} onChange={(e) => setArr("paquetes_horas", i, { vencimiento: e.target.value })} className="h-7 text-xs" /></Field>
            </div>
            <RowFooter onDelete={() => delArr("paquetes_horas", i)} ref={p.clausula_referencia} />
          </div>
        ))}
      </EditorSection>

      {/* Hitos de facturación */}
      <EditorSection icon={<Milestone className="h-3.5 w-3.5" />} title="Hitos de facturación" onAdd={() => addArr("hitos_facturacion", { descripcion: "", condicion: "" })}>
        {(terms.hitos_facturacion || []).map((h, i) => (
          <div key={i} className="rounded-lg border p-2.5 space-y-2">
            <Field label="Descripción"><Input value={h.descripcion || ""} onChange={(e) => setArr("hitos_facturacion", i, { descripcion: e.target.value })} className="h-7 text-xs" /></Field>
            <Field label="Condición"><Input value={h.condicion || ""} onChange={(e) => setArr("hitos_facturacion", i, { condicion: e.target.value })} className="h-7 text-xs" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="N°"><Input type="number" value={h.numero ?? ""} onChange={(e) => setArr("hitos_facturacion", i, { numero: num(e.target.value) })} className="h-7 text-xs" /></Field>
              <Field label="Monto"><Input type="number" value={h.monto ?? ""} onChange={(e) => setArr("hitos_facturacion", i, { monto: num(e.target.value) })} className="h-7 text-xs" /></Field>
              <Field label="%"><Input type="number" value={h.porcentaje ?? ""} onChange={(e) => setArr("hitos_facturacion", i, { porcentaje: num(e.target.value) })} className="h-7 text-xs" /></Field>
            </div>
            <RowFooter onDelete={() => delArr("hitos_facturacion", i)} ref={h.clausula_referencia} />
          </div>
        ))}
      </EditorSection>

      {/* Disparadores de alerta */}
      <EditorSection icon={<Bell className="h-3.5 w-3.5" />} title="Disparadores de alerta" onAdd={() => addArr("disparadores_alerta", { titulo: "", condicion: "" })}>
        {(terms.disparadores_alerta || []).map((a, i) => (
          <div key={i} className="rounded-lg border p-2.5 space-y-2">
            <Field label="Título"><Input value={a.titulo || ""} onChange={(e) => setArr("disparadores_alerta", i, { titulo: e.target.value })} className="h-7 text-xs" /></Field>
            <Field label="Condición"><Input value={a.condicion || ""} onChange={(e) => setArr("disparadores_alerta", i, { condicion: e.target.value })} className="h-7 text-xs" /></Field>
            <RowFooter onDelete={() => delArr("disparadores_alerta", i)} ref={a.umbral} />
          </div>
        ))}
      </EditorSection>
    </div>
  );
}

function EditorSection({ icon, title, onAdd, children }: { icon: React.ReactNode; title: string; onAdd: () => void; children: React.ReactNode }) {
  const count = Array.isArray((children as any)?.props?.children) ? (children as any).props.children.length : (Array.isArray(children) ? children.length : 0);
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1.5"><span className="text-primary">{icon}</span>{title}{count ? ` (${count})` : ""}</h5>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1" onClick={onAdd}><Plus className="h-3 w-3" /> Agregar</Button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function RowFooter({ onDelete, ref }: { onDelete: () => void; ref?: string }) {
  return (
    <div className="flex items-center justify-between pt-0.5">
      {ref ? <span className="text-[10px] text-muted-foreground truncate">Ref: {ref}</span> : <span />}
      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive gap-1" onClick={onDelete}><Trash2 className="h-3 w-3" /> Quitar</Button>
    </div>
  );
}
