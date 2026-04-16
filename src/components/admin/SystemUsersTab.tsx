import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Shield, Briefcase, Eye, Trash2, KeyRound, Link2, Mail, User, Loader2, Users2, KeySquare, AlertCircle } from "lucide-react";
import { GerenteAssignmentsDialog } from "./GerenteAssignmentsDialog";
import { motion, AnimatePresence } from "framer-motion";

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

const roleConfig: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string; gradient: string }> = {
  admin: {
    label: "Administrador",
    icon: <Shield className="h-3.5 w-3.5" />,
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/20",
    gradient: "from-destructive/5 to-destructive/15",
  },
  pm: {
    label: "Project Manager",
    icon: <Briefcase className="h-3.5 w-3.5" />,
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    gradient: "from-primary/5 to-primary/15",
  },
  gerente: {
    label: "Gerente (Cliente)",
    icon: <Eye className="h-3.5 w-3.5" />,
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/20",
    gradient: "from-amber-500/5 to-amber-500/15",
  },
  colaborador: {
    label: "Colaborador SYSDE",
    icon: <User className="h-3.5 w-3.5" />,
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/20",
    gradient: "from-emerald-500/5 to-emerald-500/15",
  },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function SystemUsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [team, setTeam] = useState<SysdeTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("pm");
  const [creating, setCreating] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [bulkPw, setBulkPw] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [accessMember, setAccessMember] = useState<SysdeTeamRow | null>(null);
  const [accessPw, setAccessPw] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);
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

  const handleCreateAccess = async () => {
    if (!accessMember || accessPw.length < 6) return;
    setAccessLoading(true);
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "create_team_access", team_member_id: accessMember.id, password: accessPw },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Error", description: res.error?.message || res.data?.error, variant: "destructive" });
    } else {
      toast({ title: "Acceso creado", description: `${accessMember.name} ya puede iniciar sesión` });
      setAccessMember(null);
      setAccessPw("");
      fetchUsers();
    }
    setAccessLoading(false);
  };

  const handleBulkAccess = async () => {
    if (bulkPw.length < 6) {
      toast({ title: "Error", description: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setCreating(true);
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "create_bulk_team_access", password: bulkPw },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Error", description: res.error?.message || res.data?.error, variant: "destructive" });
    } else {
      const results = res.data?.results || [];
      const ok = results.filter((r: any) => r.success).length;
      const skipped = results.filter((r: any) => r.skipped).length;
      toast({ title: "Accesos en bloque", description: `${ok} creados · ${skipped} omitidos` });
      setBulkOpen(false);
      setBulkPw("");
      fetchUsers();
    }
    setCreating(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!newEmail || !newPassword || !newName) return;
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email: newEmail, password: newPassword, full_name: newName, role: newRole },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Usuario creado", description: `${newName} (${newRole})` });
      setOpen(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("pm");
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCreating(false);
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
    if (!confirm("¿Eliminar este usuario permanentemente?")) return;
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

  const handleResetPassword = async (userId: string) => {
    const newPw = prompt("Nueva contraseña (min 6 caracteres):");
    if (!newPw || newPw.length < 6) return;
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "update_password", user_id: userId, password: newPw },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Error", description: res.error?.message || res.data?.error, variant: "destructive" });
    } else {
      toast({ title: "Contraseña actualizada" });
    }
  };

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    pms: users.filter((u) => u.role === "pm").length,
    gerentes: users.filter((u) => u.role === "gerente").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Gestión de Usuarios</h2>
            <p className="text-sm text-muted-foreground">Crea, edita y administra los accesos del sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <KeySquare className="h-4 w-4" />Acceso en bloque
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-primary" /> Crear acceso para todo el equipo SYSDE
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  Genera credenciales de colaborador para todos los miembros activos del Equipo SYSDE que aún no tengan acceso.
                  Todos compartirán la misma contraseña inicial (deberán cambiarla luego).
                </p>
                <Input type="password" placeholder="Contraseña común (min 6 chars)" value={bulkPw} onChange={(e) => setBulkPw(e.target.value)} className="h-11" />
                <Button onClick={handleBulkAccess} disabled={creating || bulkPw.length < 6} className="w-full h-11">
                  {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generando…</> : "Crear accesos"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20">
                <UserPlus className="h-4 w-4" />Nuevo Usuario
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-primary" />
                </div>
                Crear Nuevo Usuario
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre completo</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Juan Pérez" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Correo electrónico</label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="juan@empresa.com" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contraseña</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 caracteres" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Rol</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-destructive" /> Administrador</span>
                    </SelectItem>
                    <SelectItem value="pm">
                      <span className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-primary" /> Project Manager</span>
                    </SelectItem>
                    <SelectItem value="gerente">
                      <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-amber-500" /> Gerente (Cliente)</span>
                    </SelectItem>
                    <SelectItem value="colaborador">
                      <span className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-emerald-500" /> Colaborador SYSDE</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full h-11 mt-2">
                {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creando...</> : "Crear Usuario"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: <User className="h-4 w-4" />, color: "text-foreground", bg: "bg-muted/50" },
          { label: "Admins", value: stats.admins, icon: <Shield className="h-4 w-4" />, color: "text-destructive", bg: "bg-destructive/5" },
          { label: "PMs", value: stats.pms, icon: <Briefcase className="h-4 w-4" />, color: "text-primary", bg: "bg-primary/5" },
          { label: "Gerentes", value: stats.gerentes, icon: <Eye className="h-4 w-4" />, color: "text-amber-500", bg: "bg-amber-500/5" },
        ].map((s) => (
          <Card key={s.label} className={`${s.bg} border-border/30`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <User className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No hay usuarios registrados</p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {users.map((u, idx) => {
              const rc = roleConfig[u.role] || {
                label: u.role, icon: null, bg: "bg-muted/50", text: "text-muted-foreground",
                border: "border-border", gradient: "from-muted/5 to-muted/15",
              };
              return (
                <motion.div
                  key={u.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card className={`group hover:shadow-md transition-all duration-200 border-border/40 hover:${rc.border}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${rc.gradient} flex items-center justify-center border ${rc.border} shrink-0`}>
                          <span className={`text-sm font-bold ${rc.text}`}>
                            {u.full_name ? getInitials(u.full_name) : "?"}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{u.full_name || "Sin nombre"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3 shrink-0" /> {u.email}
                          </p>
                        </div>

                        {/* Role selector */}
                        <Select value={u.role} onValueChange={(val) => handleUpdateRole(u.user_id, val)}>
                          <SelectTrigger className={`w-auto h-8 gap-2 border ${rc.border} ${rc.bg} rounded-lg px-3`}>
                            <span className={`flex items-center gap-1.5 text-xs font-semibold ${rc.text}`}>
                              {rc.icon} {rc.label}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-destructive" /> Administrador</span>
                            </SelectItem>
                            <SelectItem value="pm">
                              <span className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-primary" /> Project Manager</span>
                            </SelectItem>
                            <SelectItem value="gerente">
                              <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-amber-500" /> Gerente (Cliente)</span>
                            </SelectItem>
                            <SelectItem value="colaborador">
                              <span className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-emerald-500" /> Colaborador SYSDE</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Actions */}
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            {u.role === "gerente" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAssignUserId(u.user_id)}>
                                    <Link2 className="h-3.5 w-3.5 text-amber-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Asignar clientes</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleResetPassword(u.user_id)}>
                                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Resetear contraseña</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => handleDelete(u.user_id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar usuario</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* SYSDE Team without access */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" /> Equipo Colaborador SYSDE
            </h3>
            <p className="text-xs text-muted-foreground">
              Miembros del equipo registrados. Crea accesos individuales o usa "Acceso en bloque".
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {team.filter(t => !t.user_id && t.is_active).length} sin acceso · {team.filter(t => t.user_id).length} con acceso
          </Badge>
        </div>

        {team.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Users2 className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">No hay miembros en el Equipo SYSDE</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {team.map((m) => {
              const hasAccess = !!m.user_id;
              const noEmail = !m.email;
              return (
                <Card key={m.id} className="border-border/40">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-500">{getInitials(m.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {m.email || <span className="text-amber-500 inline-flex items-center gap-1"><AlertCircle className="h-3 w-3" />Sin email</span>}
                        {m.role && <span> · {m.role}</span>}
                        {m.department && <span> · {m.department}</span>}
                      </p>
                    </div>
                    {hasAccess ? (
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 text-[10px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Acceso activo
                      </Badge>
                    ) : !m.is_active ? (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">Inactivo</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                        disabled={noEmail}
                        onClick={() => { setAccessMember(m); setAccessPw(""); }}
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

      {/* Individual access dialog */}
      <Dialog open={!!accessMember} onOpenChange={(o) => !o && setAccessMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Crear acceso para {accessMember?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-xs space-y-1 bg-muted/40 rounded-lg p-3">
              <p><span className="text-muted-foreground">Email:</span> <span className="font-medium">{accessMember?.email}</span></p>
              <p><span className="text-muted-foreground">Rol asignado:</span> <span className="font-medium">Colaborador SYSDE</span></p>
            </div>
            <Input type="password" placeholder="Contraseña inicial (min 6 chars)" value={accessPw} onChange={(e) => setAccessPw(e.target.value)} className="h-11" />
            <Button onClick={handleCreateAccess} disabled={accessLoading || accessPw.length < 6} className="w-full h-11">
              {accessLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creando…</> : "Crear acceso"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {assignUserId && (
        <GerenteAssignmentsDialog
          userId={assignUserId}
          userName={users.find((u) => u.user_id === assignUserId)?.full_name || ""}
          open={!!assignUserId}
          onOpenChange={(o) => { if (!o) setAssignUserId(null); }}
        />
      )}
    </div>
  );
}
