import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Shield, Briefcase, Eye } from "lucide-react";

const roles = [
  { key: "admin", label: "Admin", icon: <Shield className="h-3.5 w-3.5" />, color: "bg-destructive/20 text-destructive border-destructive/30" },
  { key: "pm", label: "Project Manager", icon: <Briefcase className="h-3.5 w-3.5" />, color: "bg-primary/20 text-primary border-primary/30" },
  { key: "gerente", label: "Gerente (Cliente)", icon: <Eye className="h-3.5 w-3.5" />, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
];

interface Permission {
  module: string;
  action: string;
  admin: boolean;
  pm: boolean;
  gerente: boolean;
}

const permissions: Permission[] = [
  // Usuarios
  { module: "Usuarios", action: "Ver todos los usuarios", admin: true, pm: false, gerente: false },
  { module: "Usuarios", action: "Crear usuarios", admin: true, pm: false, gerente: false },
  { module: "Usuarios", action: "Eliminar usuarios", admin: true, pm: false, gerente: false },
  { module: "Usuarios", action: "Cambiar roles", admin: true, pm: false, gerente: false },
  { module: "Usuarios", action: "Resetear contraseñas", admin: true, pm: false, gerente: false },
  // Clientes
  { module: "Clientes", action: "Ver todos los clientes", admin: true, pm: true, gerente: false },
  { module: "Clientes", action: "Ver clientes asignados", admin: true, pm: true, gerente: true },
  { module: "Clientes", action: "Crear clientes", admin: true, pm: true, gerente: false },
  { module: "Clientes", action: "Editar clientes", admin: true, pm: true, gerente: false },
  // Tareas
  { module: "Tareas", action: "Ver tareas internas", admin: true, pm: true, gerente: false },
  { module: "Tareas", action: "Ver tareas externas", admin: true, pm: true, gerente: true },
  { module: "Tareas", action: "Crear/editar tareas", admin: true, pm: true, gerente: false },
  // Presentaciones
  { module: "Presentaciones", action: "Ver presentaciones", admin: true, pm: true, gerente: true },
  { module: "Presentaciones", action: "Editar presentaciones", admin: true, pm: true, gerente: false },
  { module: "Presentaciones", action: "Compartir presentaciones", admin: true, pm: true, gerente: false },
  { module: "Presentaciones", action: "Dar feedback", admin: false, pm: false, gerente: true },
  // Minutas
  { module: "Minutas", action: "Crear minutas", admin: true, pm: true, gerente: false },
  { module: "Minutas", action: "Ver minutas visibles", admin: true, pm: true, gerente: true },
  { module: "Minutas", action: "Editar minutas", admin: true, pm: true, gerente: false },
  // Soporte
  { module: "Soporte", action: "Ver dashboard soporte", admin: true, pm: true, gerente: false },
  { module: "Soporte", action: "Gestionar tickets", admin: true, pm: true, gerente: false },
  { module: "Soporte", action: "Clasificación IA", admin: true, pm: true, gerente: false },
  // Equipo
  { module: "Equipo SYSDE", action: "Ver equipo", admin: true, pm: true, gerente: false },
  { module: "Equipo SYSDE", action: "Gestionar miembros", admin: true, pm: false, gerente: false },
  // Dashboard
  { module: "Dashboard", action: "Ver KPIs", admin: true, pm: true, gerente: true },
  { module: "Dashboard", action: "Generar reportes", admin: true, pm: true, gerente: false },
  { module: "Dashboard", action: "Gráficos personalizados", admin: true, pm: true, gerente: true },
];

const Check = () => <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
const Cross = () => <XCircle className="h-4 w-4 text-muted-foreground/40" />;

export function RBACPermissionsTab() {
  const modules = [...new Set(permissions.map(p => p.module))];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Matriz de Permisos RBAC</h2>
        <p className="text-sm text-muted-foreground">Vista completa de los permisos por rol en el sistema</p>
      </div>

      <div className="flex items-center gap-3">
        {roles.map(r => (
          <Badge key={r.key} className={`${r.color} gap-1.5 px-3 py-1`}>
            {r.icon} {r.label}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Módulo</TableHead>
                <TableHead>Permiso</TableHead>
                <TableHead className="text-center w-[100px]">Admin</TableHead>
                <TableHead className="text-center w-[100px]">PM</TableHead>
                <TableHead className="text-center w-[100px]">Gerente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map(mod => {
                const modPerms = permissions.filter(p => p.module === mod);
                return modPerms.map((p, idx) => (
                  <TableRow key={`${mod}-${idx}`} className={idx === 0 ? "border-t-2 border-border/60" : ""}>
                    <TableCell className="font-medium text-xs">
                      {idx === 0 ? (
                        <Badge variant="outline" className="text-[10px] font-semibold">{mod}</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{p.action}</TableCell>
                    <TableCell className="text-center">{p.admin ? <Check /> : <Cross />}</TableCell>
                    <TableCell className="text-center">{p.pm ? <Check /> : <Cross />}</TableCell>
                    <TableCell className="text-center">{p.gerente ? <Check /> : <Cross />}</TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
