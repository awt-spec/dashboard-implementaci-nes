import {
  LayoutDashboard, Building2, LogOut, Headset, Trophy, ChevronDown, Settings
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { projectInfo } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/useClients";
import { useSLASummary } from "@/hooks/useSLASummary";
import { useState, useMemo } from "react";
// DB is the single source of truth
import { useAuth } from "@/hooks/useAuth";

const statusLabel: Record<string, string> = {
  activo: "Activos",
  "en-riesgo": "En Riesgo",
  completado: "Completados",
  pausado: "Pausados",
};

// Etiquetas alternas para clientes de Soporte (no aplica "completado" como fin de proyecto)
const supportStatusLabel: Record<string, string> = {
  activo: "Activos",
  "en-riesgo": "En Riesgo",
  completado: "Al día (sin tickets)",
  pausado: "Pausados",
};

const statusOrder = ["activo", "en-riesgo", "completado", "pausado"];

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
  const { data: slaSummary } = useSLASummary();
  const { role, profile, signOut } = useAuth();
  const allClients = clientsData || [];
  const implClients = allClients.filter((c: any) => c.client_type === "implementacion");
  const supportClients = allClients.filter((c: any) => c.client_type === "soporte");

  const [implOpen, setImplOpen] = useState(true);
  const [supportOpen, setSupportOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [openStatusGroups, setOpenStatusGroups] = useState<Record<string, boolean>>({
    "impl-activo": true,
    "support-activo": true,
  });

  const toggleStatusGroup = (key: string) =>
    setOpenStatusGroups(p => ({ ...p, [key]: !p[key] }));

  const filterByName = (list: any[]) =>
    search.trim()
      ? list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      : list;

  const groupByStatus = (list: any[]) => {
    const filtered = filterByName(list);
    const groups: Record<string, any[]> = {};
    statusOrder.forEach(s => { groups[s] = []; });
    filtered.forEach(c => {
      if (!groups[c.status]) groups[c.status] = [];
      groups[c.status].push(c);
    });
    return groups;
  };

  const implGroups = useMemo(() => groupByStatus(implClients), [implClients, search]);
  const supportGroups = useMemo(() => groupByStatus(supportClients), [supportClients, search]);

  // Build nav items based on role
  const mainNav = [
    { id: "overview", title: "Resumen Ejecutivo", icon: LayoutDashboard, roles: ["admin", "pm", "gerente", "gerente_soporte"] },
    { id: "clients", title: "Implementación", icon: Building2, roles: ["admin", "pm"] },
    { id: "soporte", title: "Soporte", icon: Headset, roles: ["admin", "pm", "gerente_soporte"] },
    { id: "team-scrum", title: "Equipo Scrum", icon: Trophy, roles: ["admin", "pm"] },
    { id: "config", title: "Configuración", icon: Settings, roles: ["admin", "pm", "gerente_soporte"] },
  ].filter(item => role && item.roles.includes(role));

  const renderClientGroup = (
    type: "impl" | "support",
    groups: Record<string, any[]>,
  ) => {
    const prefix = type === "impl" ? "client-" : "support-client-";
    return statusOrder.map(status => {
      const items = groups[status] || [];
      if (items.length === 0) return null;
      const key = `${type}-${status}`;
      const isOpen = openStatusGroups[key] ?? false;
      return (
        <Collapsible key={key} open={isOpen} onOpenChange={() => toggleStatusGroup(key)}>
          <CollapsibleTrigger className="w-full group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  status === "activo" ? "bg-success" :
                  status === "en-riesgo" ? "bg-destructive" :
                  status === "completado" ? "bg-info" : "bg-muted-foreground"
                }`} />
                {(type === "support" ? supportStatusLabel : statusLabel)[status]}
                <span className="text-sidebar-foreground/40">({items.length})</span>
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
            <SidebarMenu>
              {items.map(client => {
                const sectionId = `${prefix}${client.id}`;
                return (
                  <SidebarMenuItem key={client.id}>
                    <SidebarMenuButton
                      onClick={() => onSectionChange(sectionId)}
                      isActive={activeSection === sectionId}
                      tooltip={client.name}
                      size="sm"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        client.status === "activo" ? "bg-success" :
                        client.status === "en-riesgo" ? "bg-destructive" :
                        client.status === "completado" ? "bg-info" : "bg-muted-foreground"
                      }`} />
                      <span className="truncate text-xs">{client.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
      );
    });
  };

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
              {mainNav.map(item => {
                // Badge rojo en "Soporte" cuando hay casos fuera de SLA
                // Visible aunque el usuario esté en otra sección — entry point global.
                const overdueCount = item.id === "soporte" ? (slaSummary?.overdue ?? 0) : 0;
                const tooltipText = overdueCount > 0
                  ? `${item.title} · ${overdueCount} fuera de SLA`
                  : item.title;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton onClick={() => onSectionChange(item.id)} isActive={activeSection === item.id} tooltip={tooltipText}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {overdueCount > 0 && (
                        <span
                          className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums shadow-sm group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:right-0.5 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:text-[9px]"
                          title={`${overdueCount} casos vencidos según política v4.5`}
                        >
                          <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-30 animate-ping" />
                          <span className="relative">{overdueCount}</span>
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role !== "gerente" && (
          <>
            <Separator className="bg-sidebar-border mx-2" />

            {/* Search box */}
            <div className="px-3 py-2 group-data-[collapsible=icon]:hidden">
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-7 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40"
              />
            </div>

            {/* Implementación stack — solo admin y pm (gerente_soporte solo ve soporte) */}
            {implClients.length > 0 && role !== "gerente_soporte" && (
              <Collapsible open={implOpen} onOpenChange={setImplOpen}>
                <SidebarGroup>
                  <CollapsibleTrigger className="w-full group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel className="text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        Implementación
                        <span className="text-sidebar-foreground/40 text-[10px]">({filterByName(implClients).length})</span>
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${implOpen ? "" : "-rotate-90"}`} />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                    <SidebarGroupContent className="space-y-1">
                      {renderClientGroup("impl", implGroups)}
                      {filterByName(implClients).length === 0 && (
                        <p className="px-3 py-2 text-[10px] text-sidebar-foreground/40 italic group-data-[collapsible=icon]:hidden">
                          Sin resultados
                        </p>
                      )}
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            )}

            {/* Soporte stack */}
            {supportClients.length > 0 && (
              <Collapsible open={supportOpen} onOpenChange={setSupportOpen}>
                <SidebarGroup>
                  <CollapsibleTrigger className="w-full group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel className="text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <Headset className="h-3.5 w-3.5" />
                        Soporte
                        <span className="text-sidebar-foreground/40 text-[10px]">({filterByName(supportClients).length})</span>
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${supportOpen ? "" : "-rotate-90"}`} />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                    <SidebarGroupContent className="space-y-1">
                      {renderClientGroup("support", supportGroups)}
                      {filterByName(supportClients).length === 0 && (
                        <p className="px-3 py-2 text-[10px] text-sidebar-foreground/40 italic group-data-[collapsible=icon]:hidden">
                          Sin resultados
                        </p>
                      )}
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            )}
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
