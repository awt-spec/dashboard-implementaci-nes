import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Lock, ShieldAlert, Briefcase, Eye, Users2, Building2, Crown, Headset, Loader2 } from "lucide-react";

type Scope = "interno" | "externo";

interface RoleDef {
  key: string;
  label: string;
  scope: Scope;
  description: string;
  Icon: typeof ShieldAlert;
  tone: string;
}

// Catálogo de roles de acceso del sistema. Los roles son valores del enum
// app_role (no una tabla editable): este panel los lista, los describe y
// muestra cuántos usuarios tiene cada uno (ERP-012). Incluye el rol externo
// `cliente`, cuyo nivel de acceso fino se define por permission_level en la
// asignación del cliente (viewer / editor / admin) — ERP-014.
const ROLES: RoleDef[] = [
  { key: "admin", label: "Administrador", scope: "interno", description: "Acceso total: usuarios, RBAC, configuración del sistema e IA.", Icon: ShieldAlert, tone: "bg-destructive/15 text-destructive border-destructive/30" },
  { key: "ceo", label: "CEO / Ejecutivo", scope: "interno", description: "Vista ejecutiva integral y dashboards. Sin administración de sistema.", Icon: Crown, tone: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  { key: "pm", label: "Project Manager", scope: "interno", description: "Gestiona clientes, sprints, equipo y backlog.", Icon: Briefcase, tone: "bg-primary/15 text-primary border-primary/30" },
  { key: "gerente_soporte", label: "Gerente de Soporte", scope: "interno", description: "Gestiona la operación de soporte: bandeja, asignaciones y SLA.", Icon: Headset, tone: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30" },
  { key: "colaborador", label: "Colaborador SYSDE", scope: "interno", description: "Consultor/desarrollador: tareas, tiempos y casos asignados.", Icon: Users2, tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { key: "gerente", label: "Gerente (lado cliente)", scope: "externo", description: "Gerente del cliente: ve sus clientes asignados en modo lectura.", Icon: Eye, tone: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { key: "cliente", label: "Cliente (Portal)", scope: "externo", description: "Usuario externo del Portal. El nivel fino (viewer/editor/admin) se define por permission_level en la asignación al cliente.", Icon: Building2, tone: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
];

function useRoleCounts() {
  return useQuery({
    queryKey: ["role-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { if (r.role) counts[r.role] = (counts[r.role] || 0) + 1; });
      return counts;
    },
  });
}

export function RolesCatalogPanel() {
  const { data: counts = {}, isLoading } = useRoleCounts();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | Scope>("all");

  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () => ROLES.filter(r => {
      if (scope !== "all" && r.scope !== scope) return false;
      if (!term) return true;
      return [r.label, r.key, r.description].some(f => f.toLowerCase().includes(term));
    }),
    [term, scope],
  );

  const scopeBtn = (val: "all" | Scope, label: string) => (
    <button
      onClick={() => setScope(val)}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        scope === val ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">Roles de acceso</h2>
        <Badge variant="outline" className="ml-1">{ROLES.length} roles</Badge>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar rol por nombre o descripción..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="h-8 w-[280px] pl-8 text-xs"
          />
        </div>
        {scopeBtn("all", "Todos")}
        {scopeBtn("interno", "Internos")}
        {scopeBtn("externo", "Externos")}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                <TableHead>Ámbito</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Sin roles que coincidan</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.key}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`gap-1 text-[11px] ${r.tone}`}>
                        <r.Icon className="h-3 w-3" /> {r.label}
                      </Badge>
                      <code className="text-[10px] text-muted-foreground">{r.key}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{r.scope === "interno" ? "Interno (SYSDE)" : "Externo (cliente)"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md">{r.description}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : (counts[r.key] || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Los roles son valores del enum <code>app_role</code> con políticas RLS asociadas. La asignación de roles a
        usuarios se hace desde la pestaña <strong>Usuarios</strong>. Crear tipos de rol completamente nuevos requiere
        una migración de base de datos.
      </p>
    </div>
  );
}
