import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Ticket, ChevronDown, ChevronRight, Building2, FileText,
  Settings, Eye, CheckCircle2, AlertTriangle, Lock, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useSupportClients, useCreateSupportTicket, type SupportTicket } from "@/hooks/useSupportTickets";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";

// ─── Schema de validación ──────────────────────────────────────────────────

const ticketSchema = z.object({
  // Sección A — obligatorios
  client_id: z.string().min(1, "Cliente requerido"),
  asunto: z.string().trim().min(3, "Mínimo 3 caracteres").max(200, "Máximo 200"),
  descripcion: z.string().trim().min(10, "Descripción muy corta (mín. 10 chars)").max(5000),
  tipo: z.string().min(1, "Tipo requerido"),
  prioridad: z.string().min(1, "Prioridad requerida"),
  producto: z.string().optional(),

  // Sección B — contexto técnico (opcional)
  ubicacion_error: z.string().max(1000).optional(),
  unidad_fabricacion: z.string().max(200).optional(),

  // Sección C — asignación interna (solo admin/PM)
  prioridad_interna: z.string().optional(),
  orden_atencion: z.coerce.number().int().min(0).max(9999).optional(),
  fecha_entrega: z.string().optional(),
  fecha_estimada_cierre: z.string().optional(),
  responsable: z.string().optional(),

  // Seguridad
  is_confidential: z.boolean().optional(),
});

type TicketForm = z.infer<typeof ticketSchema>;

// ─── Opciones de los selects ──────────────────────────────────────────────

const TIPOS = [
  "Requerimiento", "Correccion", "Consulta", "Incidente", "Pregunta", "Problema",
  "Critica, Impacto Negocio",
];
const PRIORIDADES_CLIENTE = [
  { v: "Critica, Impacto Negocio", l: "🔥 Crítica — Impacto de negocio" },
  { v: "Alta",  l: "🔴 Alta" },
  { v: "Media", l: "🟡 Media" },
  { v: "Baja",  l: "🟢 Baja" },
];
const PRIORIDADES_INTERNAS = [
  { v: "critica", l: "Crítica" },
  { v: "alta",    l: "Alta" },
  { v: "media",   l: "Media" },
  { v: "baja",    l: "Baja" },
  { v: "pendiente", l: "Pendiente (sin clasificar)" },
];
// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClientId?: string;
  /** "admin" muestra las 3 secciones. "cliente" oculta la C (asignación interna). */
  mode?: "admin" | "cliente";
  onCreated?: (ticketId: string) => void;
}

// ─── Helper de sección colapsable ──────────────────────────────────────────

function Section({
  Icon, title, subtitle, defaultOpen = true, required = false, children,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border/60 rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
        {required && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Obligatorio</Badge>}
        {subtitle && <span className="text-[11px] text-muted-foreground ml-auto truncate hidden sm:inline">{subtitle}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 space-y-3 bg-card">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

export function NewTicketForm({
  open, onOpenChange, defaultClientId, mode = "admin", onCreated,
}: Props) {
  const { data: clients = [] } = useSupportClients();
  const { data: members = [] } = useSysdeTeamMembers();
  const create = useCreateSupportTicket();

  // Estado de "ticket creado" para mostrar confirmación
  const [created, setCreated] = useState<SupportTicket | null>(null);

  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      client_id: defaultClientId || "",
      asunto: "",
      descripcion: "",
      tipo: "Consulta",
      prioridad: "Media",
      producto: "",
      // Campos post-migración: dejar undefined para que el sanitize los omita
      // si el usuario no los completa. Defaults vienen del schema de la BD.
      prioridad_interna: undefined,
      orden_atencion: undefined,
      is_confidential: false,
    },
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = form;
  const selectedClient = clients.find(c => c.id === watch("client_id"));

  const resetAndClose = () => {
    reset();
    setCreated(null);
    onOpenChange(false);
  };

  const onSubmit = async (values: TicketForm) => {
    try {
      // zod garantiza client_id+asunto no vacíos pero TS los infiere opcionales
      // por defaultValues — refinamos con assertion para satisfacer la firma.
      const inserted = await create.mutateAsync({
        ...values,
        client_id: values.client_id,
        asunto: values.asunto,
        estado: "PENDIENTE",
        fecha_registro: new Date().toISOString().slice(0, 10),
        dias_antiguedad: 0,
        fuente: mode === "cliente" ? "cliente" : "interno",
      });
      toast.success(`Caso ${inserted.ticket_id} creado`, {
        description: `Consecutivo cliente #${inserted.consecutivo_cliente} · Global ${inserted.consecutivo_global}${
          inserted.is_confidential ? " · 🔒 confidencial" : ""
        }`,
      });
      setCreated(inserted);
      onCreated?.(inserted.id);
    } catch (e: any) {
      toast.error(e.message || "Error al crear el caso");
    }
  };

  const handleCopyTicketId = async () => {
    if (!created?.ticket_id) return;
    try {
      await navigator.clipboard.writeText(created.ticket_id);
      toast.success("ID del caso copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {created ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Ticket className="h-5 w-5 text-primary" />}
            {created ? "Caso recibido" : "Nuevo caso de soporte"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {created
              ? "El equipo SVA ha sido notificado. Guarda el ID del caso para referencia."
              : mode === "cliente"
              ? "Describe tu solicitud. El equipo SVA recibirá el caso en estado PENDIENTE y lo atenderá según el SLA contratado."
              : "Registra un caso completo con todos los campos del formulario legacy (Gurunet). El consecutivo e ID se asignan automáticamente."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Confirmación post-creación ── */}
        {created && (
          <div className="flex-1 overflow-auto space-y-4 py-2">
            <div className="p-5 rounded-lg border-2 border-success/30 bg-success/5 space-y-3">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-success/20 mx-auto">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">Caso registrado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === "cliente"
                    ? "El equipo SVA ha sido notificado y comenzará la gestión en la bandeja de entrada."
                    : "El caso se registró en la base de datos con consecutivos auto-asignados. Ya aparece en la Bandeja de soporte."}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-md bg-background border border-border/60">
                  <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Caso ID</p>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <code className="text-sm font-mono font-bold">{created.ticket_id}</code>
                    <button onClick={handleCopyTicketId} className="p-1 rounded hover:bg-muted transition-colors" title="Copiar">
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="p-2.5 rounded-md bg-background border border-border/60">
                  <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Consecutivo cliente</p>
                  <p className="text-sm font-bold mt-1 tabular-nums">#{created.consecutivo_cliente}</p>
                </div>
                <div className="p-2.5 rounded-md bg-background border border-border/60">
                  <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Consecutivo global</p>
                  <p className="text-sm font-bold mt-1 tabular-nums">#{created.consecutivo_global}</p>
                </div>
              </div>
              {created.is_confidential && (
                <div className="flex items-center gap-2 p-2.5 rounded bg-warning/10 border border-warning/30 text-xs">
                  <Lock className="h-4 w-4 text-warning shrink-0" />
                  <span>
                    <strong>Caso marcado como confidencial.</strong> La descripción se cifra y solo el equipo SVA autorizado puede descifrarla.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <form id="new-ticket-form" onSubmit={handleSubmit(onSubmit)} className={`flex-1 overflow-auto space-y-3 pr-1 ${created ? "hidden" : ""}`}>

          {/* ── Sección A: Datos de la solicitud ── */}
          <Section Icon={FileText} title="Datos de la solicitud" required>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cliente *</Label>
                {mode === "cliente" && selectedClient ? (
                  // El gerente solo puede crear casos para SU cliente. Mostramos info, no selector.
                  <div className="h-9 px-3 flex items-center rounded-md border border-input bg-muted/30">
                    <Building2 className="h-3.5 w-3.5 text-primary mr-2 shrink-0" />
                    <span className="text-sm font-medium truncate">{selectedClient.name}</span>
                    {selectedClient.nivel_servicio && (
                      <Badge variant="outline" className="ml-auto text-[10px] bg-info/10 text-info border-info/30">
                        {selectedClient.nivel_servicio}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Select value={watch("client_id")} onValueChange={(v) => setValue("client_id", v, { shouldValidate: true })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar cliente…" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-medium">{c.name}</span>
                          {c.nivel_servicio && <span className="text-muted-foreground ml-2 text-[10px]">· {c.nivel_servicio}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.client_id && <p className="text-[11px] text-destructive mt-0.5">{errors.client_id.message}</p>}
                {selectedClient && mode !== "cliente" && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
                    {selectedClient.nivel_servicio && <Badge variant="outline" className="bg-info/10 text-info border-info/30">Nivel {selectedClient.nivel_servicio}</Badge>}
                    {selectedClient.categoria_interna && <Badge variant="outline">{selectedClient.categoria_interna}</Badge>}
                    {selectedClient.ranking_position != null && <Badge variant="outline">Rank #{selectedClient.ranking_position}</Badge>}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">Producto</Label>
                <Input {...register("producto")} className="h-9" placeholder="Ej: Gurunet, SAF+, FileMaster" />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">Asunto *</Label>
                <Input {...register("asunto")} className="h-9" placeholder="Ej: Devengamiento de interés 21 de Abril" />
                {errors.asunto && <p className="text-[11px] text-destructive mt-0.5">{errors.asunto.message}</p>}
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">Descripción *</Label>
                <Textarea {...register("descripcion")} rows={4} className="text-xs"
                  placeholder="Ej: El departamento de contabilidad nos informó que no se generó el devengamiento correspondiente al cierre de caja del día 20-04-2026…"
                />
                {errors.descripcion && <p className="text-[11px] text-destructive mt-0.5">{errors.descripcion.message}</p>}
              </div>

              {/* Checkbox confidencial */}
              <div className="md:col-span-2">
                <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-border/60 hover:bg-muted/30 transition-colors cursor-pointer">
                  <Checkbox
                    checked={watch("is_confidential") === true}
                    onCheckedChange={(checked) => setValue("is_confidential", checked === true)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-warning" />
                      <span className="text-xs font-semibold">Marcar caso como confidencial</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      La descripción se cifra con clave simétrica del proyecto. Solo el equipo SVA autorizado podrá descifrarla.
                      Usar para datos sensibles como credenciales, información financiera o datos personales.
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <Label className="text-xs">Tipo *</Label>
                <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v, { shouldValidate: true })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Prioridad cliente *</Label>
                <Select value={watch("prioridad")} onValueChange={(v) => setValue("prioridad", v, { shouldValidate: true })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES_CLIENTE.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* ── Sección B: Contexto técnico ── */}
          <Section Icon={Building2} title="Contexto técnico" subtitle="Opcional" defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs">Ubicación del error</Label>
                <Textarea {...register("ubicacion_error")} rows={2} className="text-xs"
                  placeholder="Módulo / pantalla / proceso donde ocurre el error"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">Unidad de fabricación</Label>
                <Input {...register("unidad_fabricacion")} className="h-9" placeholder="- No asignada -" />
              </div>
            </div>
          </Section>

          {/* ── Sección C: Asignación interna (solo admin) ── */}
          {mode === "admin" && (
            <Section Icon={Settings} title="Asignación interna" subtitle="Admin/PM" defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Prioridad interna</Label>
                  <Select value={watch("prioridad_interna")} onValueChange={(v) => setValue("prioridad_interna", v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES_INTERNAS.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Orden de atención</Label>
                  <Input type="number" min={0} max={9999} {...register("orden_atencion")} className="h-9" placeholder="0" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Desempate dentro de la misma prioridad</p>
                </div>

                <div>
                  <Label className="text-xs">Fecha estimada de entrega</Label>
                  <Input type="date" {...register("fecha_entrega")} className="h-9" />
                </div>

                <div>
                  <Label className="text-xs">Fecha estimada de cierre</Label>
                  <Input type="date" {...register("fecha_estimada_cierre")} className="h-9" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Auto: entrega + 2 días si queda vacío</p>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs">Responsable</Label>
                  <Select value={watch("responsable") || ""} onValueChange={(v) => setValue("responsable", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m: any) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>
          )}

          {/* ── Preview del caso ── */}
          {watch("client_id") && watch("asunto") && (
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide font-bold text-primary flex items-center gap-1">
                <Eye className="h-3 w-3" /> Preview
              </p>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                <span>
                  <strong>{selectedClient?.name || "—"}</strong> · {watch("tipo")} · {watch("prioridad")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                El ID del caso y el consecutivo se asignan automáticamente al guardar.
              </p>
            </div>
          )}
        </form>

        <DialogFooter>
          {created ? (
            <>
              <Button variant="ghost" onClick={() => { reset(); setCreated(null); }}>
                Crear otro
              </Button>
              <Button onClick={resetAndClose}>Cerrar</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" form="new-ticket-form" disabled={create.isPending} className="gap-1.5">
                {create.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <AlertTriangle className="h-3.5 w-3.5" />}
                Crear caso
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
