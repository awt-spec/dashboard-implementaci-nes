import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, Loader2, Users, FileText, BookOpen, Presentation, Headphones, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useRoles } from "@/hooks/useRoles";
import { usePermissionsCatalog, useRolePermissions, useToggleRolePermission } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

export function RBACPermissionsTab() {
  const { role: myRole } = useAuth();
  const isAdmin = myRole === "admin";
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: permissions = [], isLoading: permsLoading } = usePermissionsCatalog();
  const { data: rolePerms = [], isLoading: rpLoading } = useRolePermissions();
  const toggle = useToggleRolePermission();

  // Set "role_key|permission_key" para lookup O(1).
  const granted = useMemo(
    () => new Set(rolePerms.map((rp) => `${rp.role_key}|${rp.permission_key}`)),
    [rolePerms],
  );

  const modules = useMemo(() => [...new Set(permissions.map((p) => p.module))], [permissions]);
  // Roles activos como columnas (sistema + personalizados).
  const cols = useMemo(() => roles.filter((r) => r.is_active), [roles]);

  const onToggle = (role_key: string, permission_key: string, enabled: boolean) => {
    toggle.mutate(
      { role_key, permission_key, enabled },
      { onError: (e: any) => toast.error(e.message || "No se pudo actualizar el permiso") },
    );
  };

  const loading = rolesLoading || permsLoading || rpLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Matriz de Permisos RBAC</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Definí qué puede hacer cada rol. Los cambios se guardan al instante." : "Permisos por rol (solo lectura)."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {modules.map((mod, modIdx) => {
            const modPerms = permissions.filter((p) => p.module === mod);
            const icon = moduleIcons[mod] || <FileText className="h-4 w-4" />;
            return (
              <motion.div key={mod} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: modIdx * 0.04 }}>
                <Card className="overflow-hidden border-border/40">
                  <div className="px-5 py-3 bg-muted/30 border-b border-border/30 flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-background flex items-center justify-center border border-border/50 text-muted-foreground">{icon}</div>
                    <span className="text-sm font-bold text-foreground">{mod}</span>
                    <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">{modPerms.length} permisos</Badge>
                  </div>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="border-b border-border/20">
                          <th className="text-left px-5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Permiso</th>
                          {cols.map((r) => (
                            <th key={r.key} className="px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-center text-muted-foreground whitespace-nowrap" title={r.label}>
                              {r.label}
                              {!r.is_system && <span className="block text-[8px] text-primary normal-case">personalizado</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modPerms.map((p) => (
                          <tr key={p.key} className="border-b border-border/10 last:border-0 hover:bg-muted/20">
                            <td className="px-5 py-2 text-sm">{p.action}</td>
                            {cols.map((r) => {
                              const on = granted.has(`${r.key}|${p.key}`);
                              return (
                                <td key={r.key} className="px-2 py-2 text-center">
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={on}
                                      disabled={!isAdmin || toggle.isPending}
                                      onCheckedChange={(v) => onToggle(r.key, p.key, !!v)}
                                      aria-label={`${r.label}: ${p.action}`}
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Esta matriz define los permisos consultables por <code>has_permission()</code> / <code>get_my_permissions()</code>.
        El control de acceso histórico en RLS sigue basado en el enum <code>app_role</code> para los roles de sistema;
        la migración de políticas RLS a <code>has_permission</code> se hace de forma incremental. Para roles
        <strong> personalizados</strong>, estos permisos son la fuente de verdad del gating en la aplicación.
      </p>
    </div>
  );
}
