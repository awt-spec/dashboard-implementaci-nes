import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Shield, Briefcase, Eye, Lock, Users, FileText, Presentation, BookOpen, Headphones, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const roles = [
  { key: "admin", label: "Admin", icon: <Shield className="h-4 w-4" />, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  { key: "pm", label: "PM", icon: <Briefcase className="h-4 w-4" />, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
  { key: "gerente", label: "Gerente", icon: <Eye className="h-4 w-4" />, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
];

interface Permission {
  module: string;
  action: string;
  admin: boolean;
  pm: boolean;
  gerente: boolean;
}

const moduleIcons: Record<string, React.ReactNode> = {
  "Usuarios": <Users className="h-4 w-4" />,
  "Clientes": <FileText className="h-4 w-4" />,
  "Tareas": <BookOpen className="h-4 w-4" />,
  "Presentaciones": <Presentation className="h-4 w-4" />,
  "Minutas": <FileText className="h-4 w-4" />,
  "Soporte": <Headphones className="h-4 w-4" />,
  "Equipo SYSDE": <Users className="h-4 w-4" />,
  "Dashboard": <BarChart3 className="h-4 w-4" />,
};

const permissions: Permission[] = [
  { module: "Usuarios", action: "Ver todos los usuarios", admin: true, pm: false, gerente: false },
  { module: "Usuarios", action: "Crear usuarios", admin: true, pm: false, gerente: false },
  { module: "Usuarios", action: "Eliminar usuarios", admin: true, pm: false, gerente: false },
  { module: "Usuarios", action: "Cambiar roles", admin: true, pm: false, gerente: false },
  { module: "Usuarios", action: "Resetear contraseñas", admin: true, pm: false, gerente: false },
  { module: "Clientes", action: "Ver todos los clientes", admin: true, pm: true, gerente: false },
  { module: "Clientes", action: "Ver clientes asignados", admin: true, pm: true, gerente: true },
  { module: "Clientes", action: "Crear clientes", admin: true, pm: true, gerente: false },
  { module: "Clientes", action: "Editar clientes", admin: true, pm: true, gerente: false },
  { module: "Tareas", action: "Ver tareas internas", admin: true, pm: true, gerente: false },
  { module: "Tareas", action: "Ver tareas externas", admin: true, pm: true, gerente: true },
  { module: "Tareas", action: "Crear/editar tareas", admin: true, pm: true, gerente: false },
  { module: "Presentaciones", action: "Ver presentaciones", admin: true, pm: true, gerente: true },
  { module: "Presentaciones", action: "Editar presentaciones", admin: true, pm: true, gerente: false },
  { module: "Presentaciones", action: "Compartir presentaciones", admin: true, pm: true, gerente: false },
  { module: "Presentaciones", action: "Dar feedback", admin: false, pm: false, gerente: true },
  { module: "Minutas", action: "Crear minutas", admin: true, pm: true, gerente: false },
  { module: "Minutas", action: "Ver minutas visibles", admin: true, pm: true, gerente: true },
  { module: "Minutas", action: "Editar minutas", admin: true, pm: true, gerente: false },
  { module: "Soporte", action: "Ver dashboard soporte", admin: true, pm: true, gerente: false },
  { module: "Soporte", action: "Gestionar tickets", admin: true, pm: true, gerente: false },
  { module: "Soporte", action: "Clasificación IA", admin: true, pm: true, gerente: false },
  { module: "Equipo SYSDE", action: "Ver equipo", admin: true, pm: true, gerente: false },
  { module: "Equipo SYSDE", action: "Gestionar miembros", admin: true, pm: false, gerente: false },
  { module: "Dashboard", action: "Ver KPIs", admin: true, pm: true, gerente: true },
  { module: "Dashboard", action: "Generar reportes", admin: true, pm: true, gerente: false },
  { module: "Dashboard", action: "Gráficos personalizados", admin: true, pm: true, gerente: true },
];

const Check = () => (
  <div className="h-6 w-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  </div>
);

const Cross = () => (
  <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center">
    <XCircle className="h-3.5 w-3.5 text-muted-foreground/30" />
  </div>
);

export function RBACPermissionsTab() {
  const modules = [...new Set(permissions.map((p) => p.module))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Matriz de Permisos RBAC</h2>
          <p className="text-sm text-muted-foreground">Vista completa de los permisos por rol en el sistema</p>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex items-center gap-3">
        {roles.map((r) => (
          <div key={r.key} className={`flex items-center gap-2 px-4 py-2 rounded-xl ${r.bg} border ${r.border}`}>
            <span className={r.color}>{r.icon}</span>
            <span className={`text-sm font-semibold ${r.color}`}>{r.label}</span>
          </div>
        ))}
      </div>

      {/* Permission modules */}
      <div className="space-y-4">
        {modules.map((mod, modIdx) => {
          const modPerms = permissions.filter((p) => p.module === mod);
          const icon = moduleIcons[mod] || <FileText className="h-4 w-4" />;

          return (
            <motion.div
              key={mod}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: modIdx * 0.05 }}
            >
              <Card className="overflow-hidden border-border/40">
                {/* Module header */}
                <div className="px-5 py-3 bg-muted/30 border-b border-border/30 flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-background flex items-center justify-center border border-border/50 text-muted-foreground">
                    {icon}
                  </div>
                  <span className="text-sm font-bold text-foreground">{mod}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">
                    {modPerms.length} permisos
                  </Badge>
                </div>

                <CardContent className="p-0">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_80px_80px_80px] px-5 py-2 border-b border-border/20">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Permiso</span>
                    {roles.map((r) => (
                      <span key={r.key} className={`text-[10px] uppercase tracking-wider font-semibold text-center ${r.color}`}>
                        {r.label}
                      </span>
                    ))}
                  </div>

                  {/* Permission rows */}
                  {modPerms.map((p, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-[1fr_80px_80px_80px] px-5 py-2.5 items-center ${
                        idx < modPerms.length - 1 ? "border-b border-border/10" : ""
                      } hover:bg-muted/20 transition-colors`}
                    >
                      <span className="text-sm text-foreground/80">{p.action}</span>
                      <div className="flex justify-center">{p.admin ? <Check /> : <Cross />}</div>
                      <div className="flex justify-center">{p.pm ? <Check /> : <Cross />}</div>
                      <div className="flex justify-center">{p.gerente ? <Check /> : <Cross />}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
