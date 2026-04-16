import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SystemUsersTab } from "@/components/admin/SystemUsersTab";
import { SysdeTeamManager } from "@/components/support/SysdeTeamManager";
import { RBACPermissionsTab } from "@/components/admin/RBACPermissionsTab";

export default function AdminUsers() {
  const { role: myRole } = useAuth();

  if (myRole !== "admin") {
    return <p className="text-muted-foreground p-8">No tienes permisos para ver esta sección.</p>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Usuarios del Sistema</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Equipo SYSDE</TabsTrigger>
          <TabsTrigger value="rbac" className="gap-1.5"><Lock className="h-3.5 w-3.5" /> Permisos RBAC</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <SystemUsersTab />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <SysdeTeamManager />
        </TabsContent>

        <TabsContent value="rbac" className="mt-4">
          <RBACPermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
