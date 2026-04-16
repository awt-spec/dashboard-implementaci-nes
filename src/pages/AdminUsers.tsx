import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Shield, Briefcase, Eye, Trash2, Users } from "lucide-react";
import { SysdeTeamManager } from "@/components/support/SysdeTeamManager";

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

const roleBadge: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  admin: { label: "Admin", icon: <Shield className="h-3 w-3" />, className: "bg-destructive text-destructive-foreground" },
  pm: { label: "Project Manager", icon: <Briefcase className="h-3 w-3" />, className: "bg-primary text-primary-foreground" },
  gerente: { label: "Gerente", icon: <Eye className="h-3 w-3" />, className: "bg-info text-info-foreground" },
};

export default function AdminUsers() {
  const { role: myRole } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("pm");
  const [creating, setCreating] = useState(false);
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
    if (!confirm("¿Eliminar este usuario?")) return;
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

  if (myRole !== "admin") {
    return <p className="text-muted-foreground p-8">No tienes permisos para ver esta sección.</p>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Usuarios del Sistema</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Equipo SYSDE</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Gestión de Usuarios</h2>
              <p className="text-sm text-muted-foreground">Administra usuarios y sus roles en el sistema</p>
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
                        <SelectItem value="gerente">Gerente</SelectItem>
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
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : users.map(u => {
                    const rb = roleBadge[u.role] || { label: u.role, icon: null, className: "bg-muted text-muted-foreground" };
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Select value={u.role} onValueChange={val => handleUpdateRole(u.user_id, val)}>
                            <SelectTrigger className="w-[160px] h-8">
                              <Badge className={`${rb.className} gap-1`}>{rb.icon}{rb.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="pm">Project Manager</SelectItem>
                              <SelectItem value="gerente">Gerente</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(u.user_id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <SysdeTeamManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
