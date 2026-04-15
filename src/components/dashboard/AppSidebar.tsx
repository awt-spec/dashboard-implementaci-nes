import {
  LayoutDashboard, Users, Building2, ListTodo, Shield, LogOut, Headset
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { projectInfo } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useClients } from "@/hooks/useClients";
// DB is the single source of truth
import { useAuth } from "@/hooks/useAuth";

const statusDot: Record<string, string> = {
  activo: "bg-success",
  "en-riesgo": "bg-destructive",
  completado: "bg-info",
  pausado: "bg-muted-foreground",
};

const roleBadgeStyle: Record<string, string> = {
  admin: "bg-destructive text-destructive-foreground",
  pm: "bg-primary text-primary-foreground",
  gerente: "bg-info text-info-foreground",
};

interface AppSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  const { data: clientsData } = useClients();
  const { role, profile, signOut } = useAuth();
  const allClients = clientsData || [];
  const implClients = allClients.filter((c: any) => !c.client_type || c.client_type === "implementacion");
  const supportClients = allClients.filter((c: any) => c.client_type === "soporte");

  // Build nav items based on role
  const mainNav = [
    { id: "overview", title: "Resumen Ejecutivo", icon: LayoutDashboard, roles: ["admin", "pm", "gerente"] },
    { id: "clients", title: "Implementación", icon: Building2, roles: ["admin", "pm"] },
    { id: "soporte", title: "Soporte", icon: Headset, roles: ["admin", "pm"] },
    { id: "tasks", title: "Tareas Global", icon: ListTodo, roles: ["admin", "pm"] },
    { id: "users", title: "Usuarios", icon: Shield, roles: ["admin"] },
  ].filter(item => role && item.roles.includes(role));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <span className="text-sidebar-primary-foreground font-black text-sm">S</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="text-sm font-bold text-sidebar-foreground leading-tight">{projectInfo.company}</h2>
            <p className="text-xs text-sidebar-foreground/70">{projectInfo.name}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton onClick={() => onSectionChange(item.id)} isActive={activeSection === item.id} tooltip={item.title}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role !== "gerente" && (
          <>
            <Separator className="bg-sidebar-border mx-2" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/50">Clientes</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {clients.map(client => (
                    <SidebarMenuItem key={client.id}>
                      <SidebarMenuButton
                        onClick={() => onSectionChange(`client-${client.id}`)}
                        isActive={activeSection === `client-${client.id}`}
                        tooltip={client.name}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot[client.status]}`} />
                        <span className="truncate text-xs">{client.name.split(" ").slice(0, 2).join(" ")}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="group-data-[collapsible=icon]:hidden space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground text-xs font-bold">
              {(profile?.full_name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.full_name || "Usuario"}</p>
              <Badge className={`text-[9px] ${roleBadgeStyle[role || ""] || "bg-muted text-muted-foreground"}`}>
                {role === "admin" ? "Admin" : role === "pm" ? "PM" : role === "gerente" ? "Gerente" : "—"}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
