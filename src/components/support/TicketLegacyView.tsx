import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Pencil, X, Info, Lock, Radio, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import type { SupportTicket, SupportClient } from "@/hooks/useSupportTickets";
import { useUpdateSupportTicket, useDecryptTicket } from "@/hooks/useSupportTickets";

// ─── Helper: label + valor en layout vertical (como Gurunet) ──────────────

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  emphasis?: boolean;
}

function LegacyField({ label, hint, children, emphasis }: FieldProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-start gap-3 py-2.5 border-b border-border/40 last:border-b-0">
      <div className="text-right pr-3 md:pt-1">
        <div className={`text-[13px] font-semibold ${emphasis ? "text-foreground" : "text-muted-foreground"}`}>
          {label}:
        </div>
        {hint && <div className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{hint}</div>}
      </div>
      <div className="text-sm min-h-[1.5rem]">{children}</div>
    </div>
  );
}

// ─── Tipos de valor ──────────────────────────────────────────────────────

function TextValue({ value, placeholder = "—" }: { value: string | null | undefined; placeholder?: string }) {
  if (!value) return <span className="text-muted-foreground italic">{placeholder}</span>;
  return <span>{value}</span>;
}

function MultilineValue({ value, placeholder = "—" }: { value: string | null | undefined; placeholder?: string }) {
  if (!value) return <span className="text-muted-foreground italic">{placeholder}</span>;
  return (
    <div className="border border-border/50 rounded-md px-3 py-2 bg-muted/20 whitespace-pre-wrap text-sm leading-snug">
      {value}
    </div>
  );
}

function PendienteValue({ value, formatter }: { value: any; formatter?: (v: any) => string }) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground italic">-Pendiente-</span>;
  }
  return <span>{formatter ? formatter(value) : String(value)}</span>;
}

function PriorityValue({ prio }: { prio: string | null | undefined }) {
  if (!prio) return <span className="text-muted-foreground italic">—</span>;
  const color =
    /critica/i.test(prio) ? "bg-destructive/15 text-destructive border-destructive/30" :
    prio === "Alta"       ? "bg-warning/15 text-warning border-warning/30" :
    prio === "Media"      ? "bg-info/10 text-info border-info/30" :
                            "bg-muted/40 text-muted-foreground border-border";
  return <Badge variant="outline" className={`${color} font-medium`}>{prio === "Critica, Impacto Negocio" ? "Crítica" : prio}</Badge>;
}

function minutesToHhMm(mins?: number | null) {
  if (mins == null) return "00:00 horas";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} horas`;
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  ticket: SupportTicket;
  client?: SupportClient | null;
  /** Si true, el usuario puede editar los campos internos (prioridad interna, tiempos, orden). */
  canEditInternal?: boolean;
}

// ─── Componente principal ────────────────────────────────────────────────

export function TicketLegacyView({ ticket, client, canEditInternal = false }: Props) {
  const update = useUpdateSupportTicket();
  const decrypt = useDecryptTicket();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<SupportTicket>>({});
  const [decryptedText, setDecryptedText] = useState<string | null>(null);

  const handleReveal = async () => {
    if (decryptedText) {
      setDecryptedText(null); // toggle hide
      return;
    }
    try {
      const r = await decrypt.mutateAsync(ticket.id);
      setDecryptedText(r.descripcion || "(vacío)");
      toast.success("Descripción descifrada — este acceso quedó registrado");
    } catch (e: any) {
      toast.error(e.message || "Error al descifrar");
    }
  };

  const clientProps = useMemo(() => {
    const parts: string[] = [];
    if (client?.categoria_interna) parts.push(`Categoría Interna: ${client.categoria_interna}`);
    parts.push(`Nivel de Servicio: ${client?.nivel_servicio || "Base"}`);
    parts.push(`Puesto en Ranking: ${client?.ranking_position ?? 999}`);
    return parts.join("\n");
  }, [client]);

  const handleSave = async () => {
    if (Object.keys(draft).length === 0) {
      setEditing(false);
      return;
    }
    try {
      await update.mutateAsync({ id: ticket.id, updates: draft });
      toast.success("Ticket actualizado");
      setEditing(false);
      setDraft({});
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    }
  };

  const handleCancel = () => {
    setDraft({});
    setEditing(false);
  };

  const set = <K extends keyof SupportTicket>(key: K, value: SupportTicket[K]) => {
    setDraft(d => ({ ...d, [key]: value }));
  };

  // Valor actual (draft si existe, sino ticket)
  const v = <K extends keyof SupportTicket>(key: K): SupportTicket[K] =>
    (draft[key] ?? ticket[key]) as SupportTicket[K];

  return (
    <div className="space-y-3">
      {/* Banner confidencial si aplica */}
      {ticket.is_confidential && (
        <div className="p-3 rounded-lg border-2 border-warning/40 bg-warning/5 space-y-2">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Ticket confidencial</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                La descripción original fue cifrada en la base de datos con clave simétrica del proyecto.
                Solo admin/pm con el secret `ENCRYPTION_KEY` puede descifrarla. Cada descifrado queda registrado en <code>ticket_access_log</code>.
              </p>
            </div>
            {canEditInternal && (
              <Button
                size="sm"
                variant={decryptedText ? "ghost" : "default"}
                onClick={handleReveal}
                disabled={decrypt.isPending}
                className="shrink-0 h-8 gap-1.5"
              >
                {decrypt.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : decryptedText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {decryptedText ? "Ocultar" : "Revelar"}
              </Button>
            )}
          </div>
          {decryptedText !== null && (
            <div className="mt-2 p-3 rounded border border-warning/30 bg-background/80">
              <p className="text-[10px] uppercase tracking-wide font-bold text-warning mb-1 flex items-center gap-1">
                <Eye className="h-3 w-3" /> Descripción descifrada
              </p>
              <pre className="text-sm whitespace-pre-wrap font-sans m-0">{decryptedText}</pre>
            </div>
          )}
        </div>
      )}

      {/* Banner origen del ticket */}
      {ticket.fuente && ticket.fuente !== "interno" && (
        <div className="p-2.5 rounded-lg border border-info/30 bg-info/5 flex items-center gap-2 text-xs">
          <Radio className="h-3.5 w-3.5 text-info shrink-0" />
          <span>
            Ticket creado desde{" "}
            <strong>
              {ticket.fuente === "cliente" ? "el portal del cliente" :
               ticket.fuente === "email" ? "un email" :
               ticket.fuente === "devops" ? "Azure DevOps" : "la API"}
            </strong>
          </span>
        </div>
      )}

      {/* Barra superior con modo edición */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Vista clásica (equivalente al formulario Gurunet)</span>
        </div>
        {canEditInternal && (
          editing ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8 gap-1">
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={update.isPending} className="h-8 gap-1">
                {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Guardar cambios
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-8 gap-1">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          )
        )}
      </div>

      {/* Formulario legacy */}
      <div className="border border-border/60 rounded-lg bg-card overflow-hidden">
        <div className="px-4 py-2 bg-muted/30 border-b border-border/40 text-xs font-semibold text-muted-foreground">
          {ticket.ticket_id}
        </div>

        <div className="px-4 divide-y divide-border/40">
          <LegacyField label="Consecutivo del centro de servicio" emphasis>
            <PendienteValue value={ticket.consecutivo_global} />
          </LegacyField>

          <LegacyField
            label="Consecutivo del cliente"
            hint="Número de solicitud de acuerdo al cliente"
            emphasis
          >
            <PendienteValue value={ticket.consecutivo_cliente} />
          </LegacyField>

          <LegacyField label="Cliente" hint="Cliente que realizó la solicitud" emphasis>
            <TextValue value={client?.name} />
          </LegacyField>

          <LegacyField
            label="Propiedades del Cliente"
            hint="Características del Cliente en cuanto a categoría y posición en el ranking"
          >
            <pre className="text-[13px] font-sans leading-relaxed whitespace-pre-wrap m-0">
              {clientProps}
            </pre>
          </LegacyField>

          <LegacyField
            label="Asunto"
            hint="Descripción breve del motivo por el cual se requiere el servicio"
            emphasis
          >
            {editing ? (
              <Input
                value={(v("asunto") as string) || ""}
                onChange={e => set("asunto", e.target.value)}
                className="h-9 max-w-2xl"
              />
            ) : (
              <MultilineValue value={ticket.asunto} />
            )}
          </LegacyField>

          <LegacyField
            label="Descripción"
            hint="Descripción de la solicitud de servicio"
            emphasis
          >
            {editing ? (
              <Textarea
                value={(v("descripcion") as string) || (v("notas") as string) || ""}
                onChange={e => set("descripcion", e.target.value)}
                rows={5}
                className="text-sm"
              />
            ) : (
              <MultilineValue value={ticket.descripcion || ticket.notas} placeholder="(sin descripción)" />
            )}
          </LegacyField>

          <LegacyField
            label="Prioridad interna"
            hint="Prioridad interna de acuerdo a la importancia de la solicitud"
          >
            {editing ? (
              <Select value={(v("prioridad_interna") as string) || "pendiente"} onValueChange={(val) => set("prioridad_interna", val)}>
                <SelectTrigger className="h-9 max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">-Pendiente-</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              ticket.prioridad_interna && ticket.prioridad_interna !== "pendiente"
                ? <Badge variant="outline" className="capitalize">{ticket.prioridad_interna}</Badge>
                : <PendienteValue value={null} />
            )}
          </LegacyField>

          <LegacyField label="Prioridad" hint="Prioridad de la solicitud para el cliente">
            <PriorityValue prio={ticket.prioridad} />
          </LegacyField>

          <LegacyField
            label="Orden Atención"
            hint="Número que indica el orden en que se desea que se atienda la solicitud con respecto a los de la misma prioridad"
          >
            {editing ? (
              <Input
                type="number"
                min={0} max={9999}
                value={(v("orden_atencion") as number) ?? 0}
                onChange={e => set("orden_atencion", Number(e.target.value))}
                className="h-9 w-24"
              />
            ) : (
              <span className="tabular-nums">{ticket.orden_atencion ?? 0}</span>
            )}
          </LegacyField>

          <LegacyField
            label="Ubicación del error"
            hint="Ubicación del error que causó la solicitud"
          >
            {editing ? (
              <Textarea
                value={(v("ubicacion_error") as string) || ""}
                onChange={e => set("ubicacion_error", e.target.value)}
                rows={3}
                className="text-sm"
              />
            ) : (
              <MultilineValue value={ticket.ubicacion_error} />
            )}
          </LegacyField>

          <LegacyField
            label="Unidad de fabricación"
            hint="Unidad de fabricación a la que se le asignará la solicitud"
          >
            {editing ? (
              <Input
                value={(v("unidad_fabricacion") as string) || ""}
                onChange={e => set("unidad_fabricacion", e.target.value)}
                className="h-9 max-w-xs"
                placeholder="- No asignada -"
              />
            ) : (
              <TextValue value={ticket.unidad_fabricacion} placeholder="- No asignada -" />
            )}
          </LegacyField>

          <LegacyField
            label="Tiempo consumido"
            hint="Tiempo consumido por el proceso de servicio al cliente"
          >
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={(v("tiempo_consumido_minutos") as number) ?? 0}
                  onChange={e => set("tiempo_consumido_minutos", Number(e.target.value))}
                  className="h-9 w-28"
                />
                <span className="text-xs text-muted-foreground">minutos</span>
              </div>
            ) : (
              <span className="tabular-nums">{minutesToHhMm(ticket.tiempo_consumido_minutos)}</span>
            )}
          </LegacyField>

          <LegacyField
            label="Tiempo cobrado"
            hint="Tiempo que se le cobra al cliente por este servicio"
          >
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={(v("tiempo_cobrado_minutos") as number) ?? 0}
                  onChange={e => set("tiempo_cobrado_minutos", Number(e.target.value))}
                  className="h-9 w-28"
                />
                <span className="text-xs text-muted-foreground">minutos</span>
              </div>
            ) : (
              <span className="tabular-nums">{minutesToHhMm(ticket.tiempo_cobrado_minutos)}</span>
            )}
          </LegacyField>

          <LegacyField
            label="Fecha estimada de entrega"
            hint="Fecha estimada de entrega de la solicitud de servicio"
          >
            {editing ? (
              <Input
                type="date"
                value={(v("fecha_entrega") as string) || ""}
                onChange={e => set("fecha_entrega", e.target.value)}
                className="h-9 max-w-[180px]"
              />
            ) : (
              <PendienteValue value={ticket.fecha_entrega} />
            )}
          </LegacyField>

          <LegacyField
            label="Fecha estimada de cierre"
            hint="Fecha estimada de cierre de la solicitud"
          >
            {editing ? (
              <Input
                type="date"
                value={(v("fecha_estimada_cierre") as string) || ""}
                onChange={e => set("fecha_estimada_cierre", e.target.value)}
                className="h-9 max-w-[180px]"
              />
            ) : (
              <PendienteValue value={ticket.fecha_estimada_cierre} />
            )}
          </LegacyField>
        </div>
      </div>
    </div>
  );
}
