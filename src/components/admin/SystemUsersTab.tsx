import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Shield, Briefcase, Eye, Trash2, KeyRound, Link2 } from "lucide-react";
import { GerenteAssignmentsDialog } from "./GerenteAssignmentsDialog";

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

const roleBadge: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  admin: { label: "Admin", icon: <Shield className="h-3 w-3" />, className: "bg-destructive text-destructive-foreground" },
  pm: { label: "Project Manager", icon: <Briefcase className="h-3 w-3" />, className: "bg-primary text-primary-foreground" },
  gerente: { label: "Gerente (Cliente)", icon: <Eye className="h-3 w-3" />, className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

export function SystemUsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("pm");
  const [creating, setCreating] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    if (profiles && roles) {
      const rolesMap = Object.fromEntries(roles.map(r => [r.user_id, r.role]));
      setUsers(profiles.map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        role: rolesMap[p.user_id] || "sin rol",
      })));
    }
    setLoading(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Gestión de Usuarios</h2>
          <p className="text-sm text-muted-foreground">Crea, edita y elimina usuarios del sistema. Asigna roles y clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Nuevo Usuario</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombre completo</label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Juan Pérez" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Correo electrónico</label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="juan@empresa.com" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Contraseña</label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 caracteres" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Rol</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="pm">Project Manager</SelectItem>
                    <SelectItem value="gerente">Gerente (Cliente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? "Creando..." : "Crear Usuario"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="w-[180px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay usuarios registrados.</TableCell></TableRow>
              ) : users.map(u => {
                const rb = roleBadge[u.role] || { label: u.role, icon: null, className: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={val => handleUpdateRole(u.user_id, val)}>
                        <SelectTrigger className="w-[170px] h-8">
                          <Badge className={`${rb.className} gap-1`}>{rb.icon}{rb.label}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="pm">Project Manager</SelectItem>
                          <SelectItem value="gerente">Gerente (Cliente)</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {u.role === "gerente" && (
                          <Button variant="ghost" size="icon" title="Asignar clientes" onClick={() => setAssignUserId(u.user_id)}>
                            <Link2 className="h-4 w-4 text-amber-400" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Resetear contraseña" onClick={() => handleResetPassword(u.user_id)}>
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Eliminar usuario" onClick={() => handleDelete(u.user_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {assignUserId && (
        <GerenteAssignmentsDialog
          userId={assignUserId}
          userName={users.find(u => u.user_id === assignUserId)?.full_name || ""}
          open={!!assignUserId}
          onOpenChange={(open) => { if (!open) setAssignUserId(null); }}
        />
      )}
    </div>
  );
}
