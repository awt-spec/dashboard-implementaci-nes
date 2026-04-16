import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Trash2, Users, Briefcase, Building2, Mail, CheckCircle2, XCircle, FileText, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  useSysdeTeamMembers,
  useCreateSysdeTeamMember,
  useDeleteSysdeTeamMember,
  useUpdateSysdeTeamMember,
} from "@/hooks/useTeamMembers";
import { CVAnalysisDialog } from "@/components/admin/CVAnalysisDialog";
import { useQueryClient } from "@tanstack/react-query";

const DEPARTMENTS = ["Soporte", "Desarrollo", "Consultoría", "QA", "Infraestructura", "Gerencia"];
const ROLES = ["Consultor", "Desarrollador", "QA", "Líder Técnico", "Gerente", "Administrador"];

export function SysdeTeamManager() {
  const { data: members = [], isLoading } = useSysdeTeamMembers();
  const createMember = useCreateSysdeTeamMember();
  const deleteMember = useDeleteSysdeTeamMember();
  const updateMember = useUpdateSysdeTeamMember();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Consultor");
  const [department, setDepartment] = useState("Soporte");

  const handleCreate = () => {
    if (!name.trim()) return;
    createMember.mutate(
      { name: name.trim(), email: email.trim(), role, department },
      {
        onSuccess: () => {
          toast.success("Miembro agregado");
          setOpen(false);
          setName(""); setEmail(""); setRole("Consultor"); setDepartment("Soporte");
        },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    updateMember.mutate(
      { id, updates: { is_active: !isActive } },
      { onSuccess: () => toast.success(isActive ? "Desactivado" : "Activado") }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar este miembro?")) return;
    deleteMember.mutate(id, { onSuccess: () => toast.success("Eliminado") });
  };

  const activeMembers = members.filter(m => m.is_active);
  const inactiveMembers = members.filter(m => !m.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold">Equipo SYSDE</h2>
            <p className="text-xs text-muted-foreground">Miembros disponibles para asignación en acuerdos y acciones</p>
          </div>
          <Badge variant="outline" className="ml-2">{activeMembers.length} activos</Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Agregar Miembro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Agregar Miembro al Equipo SYSDE</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombre completo</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Juan Pérez" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Correo electrónico</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@sysde.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Rol</label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Departamento</label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createMember.isPending || !name.trim()} className="w-full">
                {createMember.isPending ? "Creando..." : "Agregar Miembro"}
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
                <TableHead>Departamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : members.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay miembros del equipo. Agrega el primer miembro.</TableCell></TableRow>
              ) : members.map(m => (
                <TableRow key={m.id} className={!m.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Briefcase className="h-2.5 w-2.5" />{m.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Building2 className="h-2.5 w-2.5" />{m.department}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => handleToggleActive(m.id, m.is_active)} className="cursor-pointer">
                      {m.is_active ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Activo
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground gap-1 text-[10px]">
                          <XCircle className="h-2.5 w-2.5" /> Inactivo
                        </Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
