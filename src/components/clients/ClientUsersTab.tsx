import { useMemo, useState } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  UserPlus, Mail, Users, Shield, ShieldCheck, Eye, Loader2, Trash2, KeyRound,
  Search, X, Copy, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

const PERMISSION_META: Record<ClientePermission, { label: string; short: string; hint: string; Icon: typeof Shield; tone: string; dot: string; gradient: string }> = {
  viewer: {
    label: "Solo lectura", short: "Lectura",
    hint: "Puede ver casos, minutas y horas. No puede crear ni modificar.",
    Icon: Eye, tone: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground", gradient: "from-muted-foreground/20 to-muted-foreground/5",
  },
  editor: {
    label: "Editor", short: "Editor",
    hint: "Puede crear casos nuevos y responder con notas externas.",
    Icon: Shield, tone: "bg-info/15 text-info border-info/30",
    dot: "bg-info", gradient: "from-info/20 to-info/5",
  },
  admin: {
    label: "Admin del cliente", short: "Admin",
    hint: "Todo lo anterior + gestionar otros usuarios del cliente.",
    Icon: ShieldCheck, tone: "bg-primary/15 text-primary border-primary/30",
    dot: "bg-primary", gradient: "from-primary/20 to-primary/5",
  },
};

// Genera iniciales para el avatar (max 2 chars)
function initials(name: string | null, email: string | null, fallback: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]).join("").toUpperCase();
  }
  if (email) return email[0].toUpperCase() + (email[1] || "").toUpperCase();
  return fallback.slice(0, 2).toUpperCase();
}

// Color de avatar deterministic basado en el email/id
const AVATAR_COLORS = [
  "from-rose-500 to-pink-500",
  "from-orange-500 to-amber-500",
  "from-emerald-500 to-teal-500",
  "from-sky-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-indigo-500 to-blue-500",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#$%";
  let pwd = "";
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

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

  // Búsqueda local
  const [search, setSearch] = useState("");
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => {
      const name = u.profile?.full_name?.toLowerCase() || "";
      const email = u.profile?.email?.toLowerCase() || "";
      return name.includes(q) || email.includes(q);
    });
  }, [users, search]);

  // Conteos por permission level
  const counts = useMemo(() => {
    const c = { admin: 0, editor: 0, viewer: 0 };
    users.forEach(u => { c[u.permission_level] = (c[u.permission_level] || 0) + 1; });
    return c;
  }, [users]);

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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* ════════ HERO con stats por permiso ════════ */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                  Usuarios del cliente
                </p>
                <h2 className="text-xl font-black leading-tight mt-0.5">{clientName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {users.length === 0 ? "Sin usuarios todavía" :
                   users.length === 1 ? "1 persona con acceso al portal" :
                   `${users.length} personas con acceso al portal`}
                </p>
              </div>
            </div>
            <InviteDialog
              onSubmit={(args) => inviteMutation.mutateAsync(args)}
              isSubmitting={inviteMutation.isPending}
            />
          </div>

          {/* Stats por permission level */}
          {users.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/40">
              {(["admin", "editor", "viewer"] as ClientePermission[]).map(p => {
                const m = PERMISSION_META[p];
                const n = counts[p] || 0;
                return (
                  <div key={p} className="flex items-center gap-2.5">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", m.tone)}>
                      <m.Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-black tabular-nums leading-none">{n}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{m.short}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Búsqueda — sólo si hay > 3 users */}
        {users.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded hover:bg-muted/60 flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* ════════ LISTA ════════ */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          // Empty state inviting
          <Card className="border-dashed border-2 border-primary/30 bg-primary/[0.02]">
            <CardContent className="py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-base font-bold">Empezá invitando al primer usuario</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Cuando alguien de <span className="font-semibold">{clientName}</span> tenga acceso al portal, va a poder ver casos, minutas y horas de su empresa.
                </p>
              </div>
              <InviteDialog
                onSubmit={(args) => inviteMutation.mutateAsync(args)}
                isSubmitting={inviteMutation.isPending}
                triggerLabel="Invitar primer usuario"
              />
            </CardContent>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <Search className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">Sin resultados</p>
              <Button size="sm" variant="outline" onClick={() => setSearch("")} className="h-7 text-xs">
                Limpiar búsqueda
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence>
              {filteredUsers.map(u => {
                const meta = PERMISSION_META[u.permission_level] ?? PERMISSION_META.viewer;
                const displayName = u.profile?.full_name || u.profile?.email?.split("@")[0] || "Usuario";
                const seed = u.profile?.email || u.user_id;
                const avColor = avatarColor(seed);

                return (
                  <motion.div
                    key={u.assignment_id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className={cn(
                      "group relative overflow-hidden border-border hover:border-primary/40 transition-all hover:shadow-lg"
                    )}>
                      {/* Accent stripe por permission */}
                      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", meta.gradient)} />

                      <CardContent className="p-4 pt-5">
                        <div className="flex items-start gap-3">
                          {/* Avatar grande con initials + gradient color */}
                          <div className={cn(
                            "h-12 w-12 rounded-2xl bg-gradient-to-br text-white text-sm font-black flex items-center justify-center shrink-0 shadow-md",
                            avColor
                          )}>
                            {initials(u.profile?.full_name || null, u.profile?.email || null, u.user_id)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-bold truncate">{displayName}</p>
                              <Badge variant="outline" className={cn("gap-1 text-[10px]", meta.tone)}>
                                <meta.Icon className="h-3 w-3" />
                                {meta.short}
                              </Badge>
                            </div>
                            {u.profile?.email && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(u.profile!.email!);
                                  toast.success("Email copiado");
                                }}
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5 group/email"
                                title="Click para copiar"
                              >
                                <Mail className="h-2.5 w-2.5" />
                                <span className="truncate">{u.profile.email}</span>
                                <Copy className="h-2.5 w-2.5 opacity-0 group-hover/email:opacity-100 transition-opacity" />
                              </button>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              Activo {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: es })}
                            </p>
                          </div>
                        </div>

                        {/* Permission picker visual */}
                        <div className="mt-4">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Permisos</p>
                          <ToggleGroup
                            type="single"
                            value={u.permission_level}
                            onValueChange={(v) => {
                              if (v && v !== u.permission_level) {
                                permissionMutation.mutate({ user_id: u.user_id, permission_level: v as ClientePermission });
                              }
                            }}
                            className="gap-1 w-full grid grid-cols-3"
                          >
                            {(Object.keys(PERMISSION_META) as ClientePermission[]).map(k => {
                              const m = PERMISSION_META[k];
                              return (
                                <Tooltip key={k}>
                                  <TooltipTrigger asChild>
                                    <ToggleGroupItem
                                      value={k}
                                      className="h-8 text-[11px] gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                    >
                                      <m.Icon className="h-3 w-3" />
                                      {m.short}
                                    </ToggleGroupItem>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-[10px] max-w-[200px]">
                                    {m.hint}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </ToggleGroup>
                        </div>

                        {/* Actions: password + revoke en hover */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
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
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Invite dialog ──────────────────────────────────────────────────────

function InviteDialog({
  onSubmit,
  isSubmitting,
  triggerLabel = "Invitar usuario",
}: {
  onSubmit: (args: { email: string; password: string; full_name: string; permission_level: ClientePermission }) => Promise<any>;
  isSubmitting: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState<ClientePermission>("viewer");
  const [showPwd, setShowPwd] = useState(false);

  const reset = () => {
    setEmail(""); setFullName(""); setPassword(""); setPermission("viewer"); setShowPwd(false);
  };

  const handleGenerate = () => {
    const p = generatePassword();
    setPassword(p);
    setShowPwd(true);
  };

  const handleSubmit = async () => {
    if (!email || !password || password.length < 8) {
      toast.error("Email y contraseña (≥8 chars) son requeridos");
      return;
    }
    await onSubmit({ email, password, full_name: fullName, permission_level: permission });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs h-9">
          <UserPlus className="h-3.5 w-3.5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Invitar usuario al portal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Identidad */}
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Nombre completo</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej: María Pérez" className="text-sm h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Email *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@cliente.com" className="text-sm h-10" />
          </div>

          {/* Password con generador */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Contraseña inicial *</Label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Generar
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="≥8 caracteres"
                className="text-sm h-10 font-mono pr-20"
              />
              <div className="absolute right-1 top-1 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
                  title={showPwd ? "Ocultar" : "Ver"}
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {password && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(password); toast.success("Contraseña copiada"); }}
                    className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
                    title="Copiar"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              💡 Generá una segura, copiala y envíasela al usuario. Puede cambiarla después.
            </p>
          </div>

          {/* Permission picker visual con cards */}
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Nivel de acceso</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(PERMISSION_META) as ClientePermission[]).map(k => {
                const m = PERMISSION_META[k];
                const active = permission === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPermission(k)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                      active
                        ? "border-primary bg-primary/[0.04] ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40 hover:bg-muted/20"
                    )}
                  >
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", m.tone)}>
                      <m.Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{m.hint}</p>
                    </div>
                    {active && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
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
