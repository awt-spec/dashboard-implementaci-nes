import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Shield, Briefcase, Eye, Trash2, KeyRound, Link2, Mail, User,
  Loader2, Users2, KeySquare, AlertCircle, Search, X, Copy, RefreshCw, Sparkles,
  CheckCircle2, ShieldAlert,
} from "lucide-react";
import { GerenteAssignmentsDialog } from "./GerenteAssignmentsDialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────

type StaffRole = "admin" | "pm" | "gerente" | "colaborador";

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

interface SysdeTeamRow {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  department: string | null;
  is_active: boolean | null;
  user_id: string | null;
}

// ─── Meta de roles ─────────────────────────────────────────────────────────

const ROLE_META: Record<StaffRole, { label: string; short: string; hint: string; Icon: typeof Shield; tone: string; gradient: string }> = {
  admin: {
    label: "Administrador", short: "Admin",
    hint: "Acceso total: usuarios, RBAC, configuración del sistema, IA.",
    Icon: ShieldAlert, tone: "bg-destructive/15 text-destructive border-destructive/30",
    gradient: "from-destructive/20 to-destructive/5",
  },
  pm: {
    label: "Project Manager", short: "PM",
    hint: "Gestiona clientes, sprints, equipo y backlog. Sin admin de sistema.",
    Icon: Briefcase, tone: "bg-primary/15 text-primary border-primary/30",
    gradient: "from-primary/20 to-primary/5",
  },
  gerente: {
    label: "Gerente (Cliente)", short: "Gerente",
    hint: "Gerente del lado cliente — ve clientes asignados, no edita.",
    Icon: Eye, tone: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  colaborador: {
    label: "Colaborador SYSDE", short: "Colab",
    hint: "Equipo SYSDE — registra horas, atiende casos, daily, scrum.",
    Icon: User, tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function initials(name: string | null | undefined, email: string | null | undefined, fallback: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]).join("").toUpperCase();
  }
  if (email) return email[0].toUpperCase() + (email[1] || "").toUpperCase();
  return fallback.slice(0, 2).toUpperCase();
}

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

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function SystemUsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [team, setTeam] = useState<SysdeTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<StaffRole | "all">("all");
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [accessMember, setAccessMember] = useState<SysdeTeamRow | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, teamRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("user_roles").select("user_id, role"),
      (supabase.from("sysde_team_members" as any).select("id, name, email, role, department, is_active, user_id").order("name") as any),
    ]);
    const profiles = profilesRes.data;
    const roles = rolesRes.data;
    if (profiles && roles) {
      const rolesMap = Object.fromEntries(roles.map((r) => [r.user_id, r.role]));
      setUsers(
        profiles.map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          role: rolesMap[p.user_id] || "sin rol",
        }))
      );
    }
    setTeam(((teamRes.data as any[]) || []) as SysdeTeamRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  // Mutaciones
  const handleCreate = async (args: { name: string; email: string; password: string; role: StaffRole }) => {
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "create", email: args.email, password: args.password, full_name: args.name, role: args.role },
    });
    if (res.error || res.data?.error) {
      throw new Error(res.error?.message || res.data?.error);
    }
    toast({ title: "Usuario creado", description: `${args.name} (${ROLE_META[args.role]?.label || args.role})` });
    fetchUsers();
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "update_role", user_id: userId, role },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Error", description: res.error?.message || res.data?.error, variant: "destructive" });
    } else {
      toast({ title: "Rol actualizado" });
      fetchUsers();
    }
  };

  const handleDelete = async (userId: string) => {
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "delete", user_id: userId },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Error", description: res.error?.message || res.data?.error, variant: "destructive" });
    } else {
      toast({ title: "Usuario eliminado" });
      fetchUsers();
    }
  };

  const handleResetPassword = async (userId: string, password: string) => {
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "update_password", user_id: userId, password },
    });
    if (res.error || res.data?.error) {
      throw new Error(res.error?.message || res.data?.error);
    }
    toast({ title: "Contraseña actualizada" });
  };

  const handleCreateAccess = async (member: SysdeTeamRow, password: string) => {
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "create_team_access", team_member_id: member.id, password },
    });
    if (res.error || res.data?.error) {
      throw new Error(res.error?.message || res.data?.error);
    }
    toast({ title: "Acceso creado", description: `${member.name} ya puede iniciar sesión` });
    fetchUsers();
  };

  const handleBulkAccess = async (password: string) => {
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "create_bulk_team_access", password },
    });
    if (res.error || res.data?.error) {
      throw new Error(res.error?.message || res.data?.error);
    }
    const results = res.data?.results || [];
    const ok = results.filter((r: any) => r.success).length;
    const skipped = results.filter((r: any) => r.skipped).length;
    toast({ title: "Accesos en bloque", description: `${ok} creados · ${skipped} omitidos` });
    fetchUsers();
  };

  // Stats por rol
  const stats = useMemo(() => {
    const c = { admin: 0, pm: 0, gerente: 0, colaborador: 0, otros: 0 };
    users.forEach((u) => {
      if (u.role in c) (c as any)[u.role] = ((c as any)[u.role] || 0) + 1;
      else c.otros += 1;
    });
    return c;
  }, [users]);

  // Filtrado + búsqueda
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (!q) return true;
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, search, filterRole]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        {/* ════════ HERO ════════ */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Users2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                  Gestión de Usuarios
                </p>
                <h2 className="text-xl font-black leading-tight mt-0.5">Equipo y accesos del sistema</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {users.length === 0 ? "Sin usuarios todavía" :
                   `${users.length} ${users.length === 1 ? "usuario activo" : "usuarios activos"} · ${team.length} en Equipo SYSDE`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <BulkAccessDialog onSubmit={handleBulkAccess} />
              <InviteDialog onSubmit={handleCreate} />
            </div>
          </div>

          {/* Stats por rol — clickables = filtros */}
          {users.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-border/40">
              {(["admin", "pm", "gerente", "colaborador"] as StaffRole[]).map((r) => {
                const m = ROLE_META[r];
                const n = (stats as any)[r] || 0;
                const active = filterRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => setFilterRole(active ? "all" : r)}
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all",
                      active
                        ? "border-primary bg-primary/[0.06] ring-2 ring-primary/30"
                        : "border-border/50 hover:border-primary/40 hover:bg-muted/20"
                    )}
                  >
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border", m.tone)}>
                      <m.Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-black tabular-nums leading-none">{n}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 truncate">{m.short}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ════════ BÚSQUEDA ════════ */}
        {users.length > 4 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
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
            {filterRole !== "all" && (
              <Badge variant="outline" className="gap-1 h-9 px-2 cursor-pointer" onClick={() => setFilterRole("all")}>
                {ROLE_META[filterRole].short} <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}

        {/* ════════ LISTA DE USUARIOS ════════ */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <Card className="border-dashed border-2 border-primary/30 bg-primary/[0.02]">
            <CardContent className="py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-base font-bold">Empezá invitando al primer usuario</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Creá accesos para tu equipo SYSDE, PMs y administradores. Cada uno verá lo que su rol permite.
                </p>
              </div>
              <InviteDialog onSubmit={handleCreate} triggerLabel="Crear primer usuario" />
            </CardContent>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <Search className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">Sin resultados</p>
              <Button size="sm" variant="outline" onClick={() => { setSearch(""); setFilterRole("all"); }} className="h-7 text-xs">
                Limpiar filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence>
              {filteredUsers.map((u) => {
                const meta = ROLE_META[u.role as StaffRole];
                const seed = u.email || u.user_id;
                const avColor = avatarColor(seed);
                const displayName = u.full_name || u.email?.split("@")[0] || "Usuario";

                return (
                  <motion.div
                    key={u.user_id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className="group relative overflow-hidden border-border hover:border-primary/40 transition-all hover:shadow-lg">
                      {/* Accent stripe por rol */}
                      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", meta?.gradient || "from-muted to-transparent")} />

                      <CardContent className="p-4 pt-5">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "h-12 w-12 rounded-2xl bg-gradient-to-br text-white text-sm font-black flex items-center justify-center shrink-0 shadow-md",
                            avColor
                          )}>
                            {initials(u.full_name, u.email, u.user_id)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-bold truncate">{displayName}</p>
                              {meta ? (
                                <Badge variant="outline" className={cn("gap-1 text-[10px]", meta.tone)}>
                                  <meta.Icon className="h-3 w-3" />
                                  {meta.short}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  {u.role}
                                </Badge>
                              )}
                            </div>
                            {u.email && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(u.email);
                                  toast({ title: "Email copiado" });
                                }}
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5 group/email"
                                title="Click para copiar"
                              >
                                <Mail className="h-2.5 w-2.5" />
                                <span className="truncate">{u.email}</span>
                                <Copy className="h-2.5 w-2.5 opacity-0 group-hover/email:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Role picker visual */}
                        <div className="mt-4">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Rol</p>
                          <ToggleGroup
                            type="single"
                            value={u.role}
                            onValueChange={(v) => {
                              if (v && v !== u.role) handleUpdateRole(u.user_id, v);
                            }}
                            className="gap-1 w-full grid grid-cols-4"
                          >
                            {(Object.keys(ROLE_META) as StaffRole[]).map((k) => {
                              const m = ROLE_META[k];
                              return (
                                <Tooltip key={k}>
                                  <TooltipTrigger asChild>
                                    <ToggleGroupItem
                                      value={k}
                                      className="h-8 text-[10px] gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                    >
                                      <m.Icon className="h-3 w-3" />
                                      <span className="hidden sm:inline">{m.short}</span>
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

                        {/* Acciones */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
                          <PasswordResetDialog
                            userEmail={u.email || u.user_id.slice(0, 8)}
                            onSubmit={(pwd) => handleResetPassword(u.user_id, pwd)}
                          />
                          {u.role === "gerente" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-[11px] border-amber-500/30 text-amber-500 hover:bg-amber-500/5"
                              onClick={() => setAssignUserId(u.user_id)}
                            >
                              <Link2 className="h-3 w-3" /> Clientes
                            </Button>
                          )}
                          <DeleteUserDialog
                            userEmail={u.email || displayName}
                            onSubmit={() => handleDelete(u.user_id)}
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

        {/* ════════ EQUIPO SYSDE ════════ */}
        <div className="space-y-3 pt-4 border-t border-border/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" /> Equipo Colaborador SYSDE
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Miembros del equipo registrados — creá accesos individuales o usá "Acceso en bloque".
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="gap-1 text-[10px] bg-emerald-500/5 text-emerald-500 border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3" />
                {team.filter((t) => t.user_id).length} con acceso
              </Badge>
              <Badge variant="outline" className="gap-1 text-[10px] bg-amber-500/5 text-amber-500 border-amber-500/30">
                <KeySquare className="h-3 w-3" />
                {team.filter((t) => !t.user_id && t.is_active).length} sin acceso
              </Badge>
            </div>
          </div>

          {team.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Users2 className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">No hay miembros en el Equipo SYSDE</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {team.map((m) => {
                const hasAccess = !!m.user_id;
                const noEmail = !m.email;
                const seed = m.email || m.id;
                const avColor = avatarColor(seed);
                return (
                  <Card key={m.id} className={cn(
                    "border-border/40 hover:border-primary/30 transition-colors",
                    hasAccess && "bg-emerald-500/[0.02]"
                  )}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-xl bg-gradient-to-br text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm",
                        avColor
                      )}>
                        {initials(m.name, m.email, m.id)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          {m.email ? (
                            <><Mail className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{m.email}</span></>
                          ) : (
                            <span className="text-amber-500 inline-flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />Sin email
                            </span>
                          )}
                        </p>
                        {(m.role || m.department) && (
                          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                            {m.role}{m.role && m.department ? " · " : ""}{m.department}
                          </p>
                        )}
                      </div>
                      {hasAccess ? (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 text-[10px] shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Activo
                        </Badge>
                      ) : !m.is_active ? (
                        <Badge variant="outline" className="text-muted-foreground text-[10px] shrink-0">Inactivo</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5 shrink-0"
                          disabled={noEmail}
                          onClick={() => setAccessMember(m)}
                        >
                          <KeyRound className="h-3 w-3" /> Crear acceso
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Dialog de acceso individual */}
        <IndividualAccessDialog
          member={accessMember}
          onClose={() => setAccessMember(null)}
          onSubmit={(pwd) => handleCreateAccess(accessMember!, pwd)}
        />

        {/* Dialog de asignaciones de gerente */}
        {assignUserId && (
          <GerenteAssignmentsDialog
            userId={assignUserId}
            userName={users.find((u) => u.user_id === assignUserId)?.full_name || ""}
            open={!!assignUserId}
            onOpenChange={(o) => { if (!o) setAssignUserId(null); }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INVITE DIALOG — con generador de password + role picker visual
// ═══════════════════════════════════════════════════════════════════════════

function InviteDialog({
  onSubmit,
  triggerLabel = "Nuevo usuario",
}: {
  onSubmit: (args: { name: string; email: string; password: string; role: StaffRole }) => Promise<void>;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("colaborador");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setName(""); setEmail(""); setPassword(""); setRole("colaborador"); setShowPwd(false);
  };

  const handleGenerate = () => {
    const p = generatePassword();
    setPassword(p);
    setShowPwd(true);
  };

  const handleSubmit = async () => {
    if (!email || !name || password.length < 6) {
      toast({ title: "Faltan datos", description: "Nombre, email y contraseña (≥6 chars)", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name, email, password, role });
      reset();
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs h-9 shadow-lg shadow-primary/20">
          <UserPlus className="h-3.5 w-3.5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Crear nuevo usuario
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Identidad */}
          <div className="space-y-2">
            <Label htmlFor="su-name" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Nombre completo *</Label>
            <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Juan Pérez" className="text-sm h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="su-email" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Email *</Label>
            <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@empresa.com" className="text-sm h-10" />
          </div>

          {/* Password con generador */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="su-pwd" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Contraseña inicial *</Label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Generar segura
              </button>
            </div>
            <div className="relative">
              <Input
                id="su-pwd"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="≥6 caracteres"
                className="text-sm h-10 font-mono pr-20"
              />
              <div className="absolute right-1 top-1 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
                  title={showPwd ? "Ocultar" : "Ver"}
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {password && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(password); toast({ title: "Contraseña copiada" }); }}
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

          {/* Role picker visual */}
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Rol del sistema</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(ROLE_META) as StaffRole[]).map((k) => {
                const m = ROLE_META[k];
                const active = role === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRole(k)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                      active
                        ? "border-primary bg-primary/[0.04] ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40 hover:bg-muted/20"
                    )}
                  >
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border", m.tone)}>
                      <m.Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{m.hint}</p>
                    </div>
                    {active && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
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
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK ACCESS DIALOG
// ═══════════════════════════════════════════════════════════════════════════

function BulkAccessDialog({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleGenerate = () => {
    setPwd(generatePassword());
    setShowPwd(true);
  };

  const handleSubmit = async () => {
    if (pwd.length < 6) {
      toast({ title: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(pwd);
      setPwd(""); setOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
          <KeySquare className="h-3.5 w-3.5" /> Acceso en bloque
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            Acceso para todo el equipo SYSDE
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <p className="font-bold flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Atención</p>
            <p className="text-[11px] leading-relaxed">
              Genera credenciales de colaborador para todos los miembros activos del Equipo SYSDE que aún no tengan acceso. Todos compartirán la misma contraseña inicial — recordales que la cambien.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Contraseña común *</Label>
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
                type={showPwd ? "text" : "password"}
                placeholder="≥6 caracteres"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="text-sm h-10 font-mono pr-20"
              />
              <div className="absolute right-1 top-1 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {pwd && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(pwd); toast({ title: "Copiada" }); }}
                    className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || pwd.length < 6} className="gap-2">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeySquare className="h-3.5 w-3.5" />}
            Crear accesos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL ACCESS DIALOG (member del equipo SYSDE)
// ═══════════════════════════════════════════════════════════════════════════

function IndividualAccessDialog({
  member,
  onClose,
  onSubmit,
}: {
  member: SysdeTeamRow | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleGenerate = () => {
    setPwd(generatePassword());
    setShowPwd(true);
  };

  const handleSubmit = async () => {
    if (pwd.length < 6) {
      toast({ title: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(pwd);
      setPwd(""); onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => { if (!o) { setPwd(""); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Crear acceso para {member?.name}
          </DialogTitle>
        </DialogHeader>

        {member && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-bold">{member.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Rol:</span>
                <Badge variant="outline" className={cn("gap-1 text-[10px]", ROLE_META.colaborador.tone)}>
                  <User className="h-3 w-3" /> Colaborador SYSDE
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Contraseña inicial *</Label>
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
                  type={showPwd ? "text" : "password"}
                  placeholder="≥6 caracteres"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className="text-sm h-10 font-mono pr-20"
                />
                <div className="absolute right-1 top-1 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  {pwd && (
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(pwd); toast({ title: "Copiada" }); }}
                      className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || pwd.length < 6} className="gap-2">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Crear acceso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PASSWORD RESET DIALOG
// ═══════════════════════════════════════════════════════════════════════════

function PasswordResetDialog({
  userEmail,
  onSubmit,
}: {
  userEmail: string;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleGenerate = () => {
    setPwd(generatePassword());
    setShowPwd(true);
  };

  const handle = async () => {
    if (pwd.length < 6) {
      toast({ title: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(pwd);
      setPwd(""); setOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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
          <DialogTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            Resetear contraseña — {userEmail}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Nueva contraseña *</Label>
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
              type={showPwd ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="≥6 caracteres"
              className="text-sm h-10 font-mono pr-20"
            />
            <div className="absolute right-1 top-1 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
              >
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {pwd && (
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(pwd); toast({ title: "Copiada" }); }}
                  className="h-8 w-8 rounded hover:bg-muted/60 flex items-center justify-center"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handle} disabled={submitting || pwd.length < 6}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Actualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE USER DIALOG
// ═══════════════════════════════════════════════════════════════════════════

function DeleteUserDialog({
  userEmail,
  onSubmit,
}: {
  userEmail: string;
  onSubmit: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    setSubmitting(true);
    try { await onSubmit(); } finally { setSubmitting(false); }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive ml-auto">
          <Trash2 className="h-3 w-3" /> Eliminar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Eliminar usuario
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción elimina permanentemente la cuenta de <span className="font-bold">{userEmail}</span>.
            Sus tickets, horas y comentarios quedan en el sistema pero ya no podrá iniciar sesión.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handle}
            disabled={submitting}
          >
            {submitting ? "Eliminando…" : "Eliminar permanentemente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
