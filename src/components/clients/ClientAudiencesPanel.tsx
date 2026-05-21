import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Bell, Users, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useClientAudiences, useUpsertAudience, useDeleteAudience,
  useAudienceMembers, useSetAudienceMembers,
  useClientUsersForAudience,
  type NotificationAudience, type AudienceChannel,
} from "@/hooks/useNotificationAudiences";

const CHANNEL_OPTIONS: Array<{ value: AudienceChannel; label: string }> = [
  { value: "both",   label: "Email + In-app" },
  { value: "email",  label: "Solo email" },
  { value: "in_app", label: "Solo in-app" },
];

const EVENT_FILTERS: Array<{ key: string; label: string; hint: string }> = [
  { key: "ticket_created",        label: "Ticket creado",          hint: "Cuando se abre una solicitud nueva del cliente" },
  { key: "ticket_resolved",       label: "Ticket resuelto",        hint: "Cuando un caso pasa a ENTREGADA / RESUELTO" },
  { key: "ticket_reopened",       label: "Ticket reabierto",       hint: "Reincidencias o reaperturas" },
  { key: "sla_at_risk",           label: "SLA en riesgo",          hint: "Caso a punto de violar SLA" },
  { key: "quote_sent",            label: "Cotización enviada",     hint: "Cliente recibe nueva cotización para aprobar" },
  { key: "quote_approved",        label: "Cotización aprobada",    hint: "Cliente aprobó una cotización" },
  { key: "monthly_statement",     label: "Estado de cuenta mensual", hint: "Statement automático fin de mes" },
];

interface Props {
  clientId: string;
}

export function ClientAudiencesPanel({ clientId }: Props) {
  const { data: audiences, isLoading } = useClientAudiences(clientId);
  const upsert = useUpsertAudience();
  const del = useDeleteAudience();

  const [editing, setEditing] = useState<Partial<NotificationAudience> | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  const { data: existingMembers } = useAudienceMembers(editing?.id ?? undefined);
  const { data: clientUsers } = useClientUsersForAudience(clientId);
  const setMembers = useSetAudienceMembers();

  // Cuando se abre el dialog en modo edit, hidratar miembros seleccionados
  useEffect(() => {
    if (!editing?.id) {
      setMemberIds(new Set());
      return;
    }
    if (existingMembers) {
      setMemberIds(new Set(existingMembers.map(m => m.user_id)));
    }
  }, [editing?.id, existingMembers]);

  const handleNew = () => {
    setEditing({
      client_id: clientId,
      name: "",
      description: "",
      channel: "both",
      event_filters: {},
      is_active: true,
    });
    setMemberIds(new Set());
  };

  const handleSave = async () => {
    if (!editing?.name?.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      const audienceId = await upsert.mutateAsync({
        id: editing.id,
        client_id: clientId,
        name: editing.name.trim(),
        description: editing.description?.trim() || null,
        channel: editing.channel ?? "both",
        event_filters: editing.event_filters ?? {},
        is_active: editing.is_active ?? true,
      });
      // Sincronizar miembros (toAdd/toRemove diff lo maneja el hook)
      await setMembers.mutateAsync({ audienceId, userIds: Array.from(memberIds) });
      toast.success(editing.id ? "Audiencia actualizada" : "Audiencia creada");
      setEditing(null);
    } catch (e: any) {
      const msg = e?.message?.includes("duplicate") || e?.message?.includes("unique")
        ? "Ya existe una audiencia con ese nombre para este cliente"
        : (e?.message || "Error al guardar");
      toast.error(msg);
    }
  };

  const handleDelete = async (a: NotificationAudience) => {
    if (!confirm(`¿Eliminar la audiencia "${a.name}"? Sus miembros quedarán sin esta lista de distribución.`)) return;
    try {
      await del.mutateAsync({ id: a.id, clientId });
      toast.success("Audiencia eliminada");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar");
    }
  };

  const toggleMember = (userId: string) => {
    const next = new Set(memberIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setMemberIds(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Audiencias de notificación
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Grupos de destinatarios para notificaciones específicas. Ej: "Power-users", "Comité de aprobación".
          </p>
        </div>
        <Button size="sm" onClick={handleNew} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nueva audiencia
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !audiences || audiences.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-xs text-muted-foreground">
            Sin audiencias configuradas. Creá una para definir quién recibe notificaciones específicas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {audiences.map(a => (
            <AudienceCard
              key={a.id}
              audience={a}
              onEdit={() => setEditing(a)}
              onDelete={() => handleDelete(a)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar audiencia" : "Nueva audiencia"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Nombre *</Label>
                  <Input
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Ej: Power-users CMI"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Canal</Label>
                  <Select
                    value={editing.channel ?? "both"}
                    onValueChange={(v) => setEditing({ ...editing, channel: v as AudienceChannel })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNEL_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2 pb-0.5">
                  <Switch
                    checked={editing.is_active ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  <Label className="text-xs">Activa (recibe notif)</Label>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs">Descripción</Label>
                  <Textarea
                    value={editing.description ?? ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Ej: Personas que aprueban cotizaciones y reciben alertas críticas..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Event filters */}
              <div className="border-t pt-3">
                <Label className="text-xs font-semibold mb-2 block">Eventos que disparan notif a esta audiencia</Label>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Si no marcás ninguno, la audiencia solo recibe broadcasts manuales (cuando alguien la elige explícitamente).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EVENT_FILTERS.map(f => {
                    const filters = (editing.event_filters ?? {}) as Record<string, boolean>;
                    const checked = !!filters[f.key];
                    return (
                      <label key={f.key} className="flex items-start gap-2 p-2 rounded-md border bg-card cursor-pointer hover:bg-accent/30">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setEditing({
                              ...editing,
                              event_filters: { ...filters, [f.key]: !!v },
                            });
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{f.label}</p>
                          <p className="text-[10px] text-muted-foreground">{f.hint}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Miembros */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Miembros ({memberIds.size})
                  </Label>
                </div>
                {!clientUsers || clientUsers.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Este cliente no tiene usuarios externos vinculados todavía. Agregalos primero desde "Accesos Plataforma".</span>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto border rounded-md p-2">
                    {clientUsers.map(u => (
                      <label
                        key={u.user_id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/30 cursor-pointer"
                      >
                        <Checkbox
                          checked={memberIds.has(u.user_id)}
                          onCheckedChange={() => toggleMember(u.user_id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{u.full_name ?? u.email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px]">{u.permission_level}</Badge>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={upsert.isPending || setMembers.isPending}
              className="gap-1.5"
            >
              {(upsert.isPending || setMembers.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing?.id ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Card individual de audiencia (con conteo de miembros via query)
// ────────────────────────────────────────────────────────────────────────────

function AudienceCard({
  audience, onEdit, onDelete,
}: {
  audience: NotificationAudience;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: members } = useAudienceMembers(audience.id);
  const eventCount = Object.values(audience.event_filters ?? {}).filter(Boolean).length;

  const channelIcon =
    audience.channel === "email"  ? <Mail className="h-3 w-3" /> :
    audience.channel === "in_app" ? <Bell className="h-3 w-3" /> :
    <span className="flex"><Mail className="h-3 w-3" /><Bell className="h-3 w-3 -ml-1" /></span>;

  return (
    <Card className={!audience.is_active ? "opacity-60" : ""}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{audience.name}</span>
            <Badge variant="outline" className="text-[10px] gap-1">
              {channelIcon} {audience.channel}
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Users className="h-2.5 w-2.5" /> {members?.length ?? 0}
            </Badge>
            {eventCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                {eventCount} eventos
              </Badge>
            )}
            {!audience.is_active && (
              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">inactiva</Badge>
            )}
          </div>
          {audience.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{audience.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
