import { useEffect, useState } from "react";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, LogOut, Shield, ShieldCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GerenteSupportDashboard } from "./GerenteSupportDashboard";
import { ClientHoursPanel } from "./ClientHoursPanel";
import { NotificationBell } from "./NotificationBell";
import { projectInfo } from "@/data/projectData";

const PERMISSION_LABEL: Record<string, { label: string; Icon: typeof Shield; tone: string }> = {
  viewer: { label: "Solo lectura", Icon: Eye, tone: "bg-muted text-muted-foreground" },
  editor: { label: "Editor", Icon: Shield, tone: "bg-info/15 text-info" },
  admin:  { label: "Admin cliente", Icon: ShieldCheck, tone: "bg-primary/15 text-primary" },
};

/**
 * Dashboard que se muestra a usuarios con rol "cliente" — externos del cliente
 * (ej: staff de Coopecar) logueados en el ERP.
 *
 * Reusa la vista del gerente (misma UX que pidió el usuario) pero:
 *   • Gatea "Nueva solicitud" por permission_level ≥ editor
 *   • Agrega un panel de horas con agregados por caso / miembro SYSDE
 *   • Muestra header branded con botón de logout
 */
export function ClientPortalDashboard() {
  const { clienteAssignment, profile, signOut, loading } = useAuth();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const [dark, _setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (loading || clientsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clienteAssignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <Shield className="h-10 w-10 text-warning mx-auto" />
            <h1 className="text-lg font-bold">Tu cuenta no está vinculada a un cliente</h1>
            <p className="text-sm text-muted-foreground">
              Contactá a tu administrador de SYSDE para que asigne tu usuario a la empresa correspondiente.
            </p>
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const client = clients?.find(c => c.id === clienteAssignment.client_id);

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <Shield className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="text-lg font-bold">Empresa no encontrada</h1>
            <p className="text-sm text-muted-foreground">
              Tu asignación apunta a un cliente que no pudimos cargar. Contactá a tu administrador SYSDE.
            </p>
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canCreateTickets =
    clienteAssignment.permission_level === "editor" ||
    clienteAssignment.permission_level === "admin";

  const permMeta = PERMISSION_LABEL[clienteAssignment.permission_level] ?? PERMISSION_LABEL.viewer;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">Portal Cliente — {client.name}</h1>
            <p className="text-[10px] text-muted-foreground">{projectInfo.name} — {projectInfo.company}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`gap-1 text-[10px] ${permMeta.tone} border-transparent`}>
            <permMeta.Icon className="h-3 w-3" />
            {permMeta.label}
          </Badge>
          <NotificationBell />
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-[11px] font-semibold leading-tight truncate max-w-[180px]">
              {profile?.full_name ?? profile?.email ?? "Usuario"}
            </p>
            <p className="text-[9px] text-muted-foreground truncate max-w-[180px]">{profile?.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <GerenteSupportDashboard
          client={client}
          canCreateTickets={canCreateTickets}
          sidebarExtras={
            <div className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Horas trabajadas
              </p>
              <ClientHoursPanel clientId={client.id} />
            </div>
          }
        />
      </main>
    </div>
  );
}
