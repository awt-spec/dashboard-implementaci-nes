import {
  LayoutDashboard, Users, Building2, ListTodo, Calendar, GanttChart
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { projectInfo } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useClients } from "@/hooks/useClients";
import { clients as staticClients } from "@/data/projectData";

const mainNav = [
  { id: "overview", title: "Resumen Ejecutivo", icon: LayoutDashboard },
  { id: "clients", title: "Clientes", icon: Building2 },
  { id: "tasks", title: "Tareas Global", icon: ListTodo },
];

const statusDot: Record<string, string> = {
  activo: "bg-success",
  "en-riesgo": "bg-destructive",
  completado: "bg-info",
  pausado: "bg-muted-foreground",
};

interface AppSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  const { data: clientsData } = useClients();
  const clients = clientsData ?? staticClients;

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
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="group-data-[collapsible=icon]:hidden space-y-2">
          <Badge className="bg-success text-success-foreground text-[10px]">🟢 {projectInfo.status}</Badge>
          <p className="text-[10px] text-sidebar-foreground/60">Actualizado: {projectInfo.lastUpdate}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
