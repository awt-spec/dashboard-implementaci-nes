import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  UserPlus, Mail, Users, Shield, ShieldCheck, Eye, Loader2, Trash2, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ClientePermission = "viewer" | "editor" | "admin";

interface ClienteUser {
  assignment_id: string;
  user_id: string;
  permission_level: ClientePermission;
  created_at: string;
  profile: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

const PERMISSION_META: Record<ClientePermission, { label: string; hint: string; Icon: typeof Shield; tone: string }> = {
  viewer: { label: "Solo lectura", hint: "Puede ver casos, minutas y horas. No puede crear ni modificar.", Icon: Eye,         tone: "bg-muted text-muted-foreground border-border" },
  editor: { label: "Editor",       hint: "Puede crear casos nuevos y responder con notas externas.",      Icon: Shield,      tone: "bg-info/15 text-info border-info/30" },
  admin:  { label: "Admin",        hint: "Todo lo anterior + gestionar otros usuarios del cliente.",       Icon: ShieldCheck, tone: "bg-primary/15 text-primary border-primary/30" },
};

async function invokeManageUsers(body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("manage-users", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

interface Props {
  clientId: string;
  clientName: string;
}

export function ClientUsersTab({ clientId, clientName }: Props) {
  const qc = useQueryClient();
  const { role } = useAuth();

  const canManage = role === "admin" || role === "pm";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["cliente-users", clientId],
    queryFn: async () => {
      const res = await invokeManageUsers({ action: "list_cliente_users", client_id: clientId });
      return (res?.users ?? []) as ClienteUser[];
    },
    enabled: canManage,
  });

  const inviteMutation = useMutation({
    mutationFn: async (args: { email: string; password: string; full_name: string; permission_level: ClientePermission }) => {
      return invokeManageUsers({
        action: "create_cliente",
        email: args.email,
        password: args.password,
        full_name: args.full_name,
        client_id: clientId,
        permission_level: args.permission_level,
      });
    },
    onSuccess: () => {
      toast.success("Usuario cliente creado");
      qc.invalidateQueries({ queryKey: ["cliente-users", clientId] });
    },
    onError: (err: any) => toast.error(err.message || "Error creando usuario"),
  });

  const permissionMutation = useMutation({
    mutationFn: async (args: { user_id: string; permission_level: ClientePermission }) =>
      invokeManageUsers({
        action: "update_cliente_permission",
        user_id: args.user_id,
        client_id: clientId,
        permission_level: args.permission_level,
      }),
    onSuccess: () => {
      toast.success("Permiso actualizado");
      qc.invalidateQueries({ queryKey: ["cliente-users", clientId] });
    },
    onError: (err: any) => toast.error(err.message || "Error actualizando permiso"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (args: { user_id: string; delete_user: boolean }) =>
      invokeManageUsers({
        action: "remove_cliente_assignment",
        user_id: args.user_id,
        client_id: clientId,
        delete_user: args.delete_user,
      }),
    onSuccess: () => {
      toast.success("Acceso revocado");
      qc.invalidateQueries({ queryKey: ["cliente-users", clientId] });
    },
    onError: (err: any) => toast.error(err.message || "Error revocando acceso"),
  });

  const passwordMutation = useMutation({
    mutationFn: async (args: { user_id: string; password: string }) =>
      invokeManageUsers({
        action: "update_password",
        user_id: args.user_id,
        password: args.password,
      }),
    onSuccess: () => toast.success("Contraseña actualizada"),
    onError: (err: any) => toast.error(err.message || "Error actualizando contraseña"),
  });

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold">Sin permisos para ver usuarios del cliente</p>
          <p className="text-xs text-muted-foreground">Requiere rol admin o pm.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Usuarios del cliente
          </h2>
          <p className="text-xs text-muted-foreground">
            Gente de {clientName} con acceso al portal. Cada usuario ve sólo los datos de su empresa.
          </p>
        </div>
        <InviteDialog
          onSubmit={(args) => inviteMutation.mutateAsync(args)}
          isSubmitting={inviteMutation.isPending}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Sin usuarios cliente todavía</p>
            <p className="text-xs text-muted-foreground">
              Invitá a alguien de {clientName} para que acceda al portal.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const meta = PERMISSION_META[u.permission_level] ?? PERMISSION_META.viewer;
            return (
              <Card key={u.assignment_id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">
                        {u.profile?.full_name ?? u.profile?.email ?? u.user_id.slice(0, 8)}
                      </p>
                      <Badge variant="outline" className={`gap-1 text-[10px] ${meta.tone}`}>
                        <meta.Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{u.profile?.email ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Acceso desde {format(new Date(u.created_at), "dd/MM/yyyy", { locale: es })}
                    </p>

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Select
                        value={u.permission_level}
                        onValueChange={(v) =>
                          permissionMutation.mutate({ user_id: u.user_id, permission_level: v as ClientePermission })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PERMISSION_META) as ClientePermission[]).map(k => (
                            <SelectItem key={k} value={k} className="text-xs">
                              {PERMISSION_META[k].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <PasswordResetDialog
                        userEmail={u.profile?.email ?? u.user_id.slice(0, 8)}
                        onSubmit={(password) => passwordMutation.mutateAsync({ user_id: u.user_id, password })}
                        isSubmitting={passwordMutation.isPending}
                      />

                      <RevokeDialog
                        userEmail={u.profile?.email ?? u.user_id.slice(0, 8)}
                        clientName={clientName}
                        onSubmit={(delete_user) =>
                          revokeMutation.mutateAsync({ user_id: u.user_id, delete_user })
                        }
                        isSubmitting={revokeMutation.isPending}
                      />
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-2 leading-snug">{meta.hint}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Invite dialog ──────────────────────────────────────────────────────

function InviteDialog({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (args: { email: string; password: string; full_name: string; permission_level: ClientePermission }) => Promise<any>;
  isSubmitting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState<ClientePermission>("viewer");

  const reset = () => {
    setEmail(""); setFullName(""); setPassword(""); setPermission("viewer");
  };

  const handleSubmit = async () => {
    if (!email || !password || password.length < 8) {
      toast.error("Email y password (≥8 chars) son requeridos");
      return;
    }
    await onSubmit({ email, password, full_name: fullName, permission_level: permission });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs">
          <UserPlus className="h-3.5 w-3.5" /> Invitar usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Invitar usuario cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="full_name" className="text-xs">Nombre completo</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej: María Pérez" className="text-sm" />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs">Email *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@cliente.com" className="text-sm" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs">Contraseña inicial * (≥8 caracteres)</Label>
            <Input id="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Generá una segura" className="text-sm font-mono" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Copiala y envíasela al usuario por un canal seguro. Podrá cambiarla después.
            </p>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Nivel de acceso</Label>
            <Select value={permission} onValueChange={(v) => setPermission(v as ClientePermission)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PERMISSION_META) as ClientePermission[]).map(k => (
                  <SelectItem key={k} value={k} className="text-sm">
                    <div className="flex flex-col">
                      <span>{PERMISSION_META[k].label}</span>
                      <span className="text-[10px] text-muted-foreground">{PERMISSION_META[k].hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Crear acceso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Password reset dialog ──────────────────────────────────────────────

function PasswordResetDialog({
  userEmail,
  onSubmit,
  isSubmitting,
}: {
  userEmail: string;
  onSubmit: (password: string) => Promise<any>;
  isSubmitting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");

  const handle = async () => {
    if (pwd.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    await onSubmit(pwd);
    setPwd("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
          <KeyRound className="h-3 w-3" /> Contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Resetear contraseña — {userEmail}</DialogTitle>
        </DialogHeader>
        <Input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Nueva contraseña (≥8)" className="font-mono" />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handle} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Actualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Revoke dialog ──────────────────────────────────────────────────────

function RevokeDialog({
  userEmail,
  clientName,
  onSubmit,
  isSubmitting,
}: {
  userEmail: string;
  clientName: string;
  onSubmit: (delete_user: boolean) => Promise<any>;
  isSubmitting: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive">
          <Trash2 className="h-3 w-3" /> Revocar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revocar acceso de {userEmail}</AlertDialogTitle>
          <AlertDialogDescription>
            Se elimina la asignación a <span className="font-semibold">{clientName}</span>. Si este usuario no tiene acceso a otro cliente, también se elimina su cuenta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => { await onSubmit(true); }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Revocando…" : "Revocar acceso"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
