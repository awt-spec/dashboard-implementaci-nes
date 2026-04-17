import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Lock, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SystemUsersTab } from "@/components/admin/SystemUsersTab";
import { TeamHub } from "@/components/team/TeamHub";
import { RBACPermissionsTab } from "@/components/admin/RBACPermissionsTab";
import { TeamActivityPanel } from "@/components/admin/TeamActivityPanel";

export default function AdminUsers() {
  const { role: myRole } = useAuth();

  if (myRole !== "admin") {
    return <p className="text-muted-foreground p-8">No tienes permisos para ver esta sección.</p>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="users">
        <TabsList className="bg-muted/50 p-1 h-auto">
          <TabsTrigger value="users" className="gap-2 data-[state=active]:shadow-sm py-2.5 px-4">
            <Shield className="h-4 w-4" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2 data-[state=active]:shadow-sm py-2.5 px-4">
            <Users className="h-4 w-4" /> Equipo SYSDE
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 data-[state=active]:shadow-sm py-2.5 px-4">
            <Activity className="h-4 w-4" /> Actividad
          </TabsTrigger>
          <TabsTrigger value="rbac" className="gap-2 data-[state=active]:shadow-sm py-2.5 px-4">
            <Lock className="h-4 w-4" /> Permisos RBAC
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <SystemUsersTab />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <TeamHub />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <TeamActivityPanel />
        </TabsContent>

        <TabsContent value="rbac" className="mt-6">
          <RBACPermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
