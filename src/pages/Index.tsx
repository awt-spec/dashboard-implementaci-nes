import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { ExecutiveOverview } from "@/components/dashboard/ExecutiveOverview";
import { ClientDashboard } from "@/components/dashboard/ClientDashboard";
import { GerenteMobileDashboard } from "@/components/dashboard/GerenteMobileDashboard";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDetail } from "@/components/clients/ClientDetail";
import TeamScrumDashboard from "@/pages/TeamScrumDashboard";
import { SupportDashboard } from "@/components/support/SupportDashboard";
import { AIUsageDashboard } from "@/components/support/AIUsageDashboard";
import AdminUsers from "@/pages/AdminUsers";
import ColaboradorDashboard from "@/pages/ColaboradorDashboard";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { projectInfo } from "@/data/projectData";
import { Moon, Sun, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareReportDialog } from "@/components/dashboard/ShareReportDialog";
import { supabase } from "@/integrations/supabase/client";
import { useActivityTracker } from "@/hooks/useActivityTracker";

const Index = () => {
  const { role, user } = useAuth();
  useActivityTracker();
  const [activeSection, setActiveSection] = useState("overview");
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const { data: clients } = useClients();
  const [assignedClientId, setAssignedClientId] = useState<string | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Fetch gerente's assigned client
  useEffect(() => {
    if (role !== "gerente" || !user) return;
    setLoadingAssignment(true);
    supabase
      .from("gerente_client_assignments")
      .select("client_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAssignedClientId(data?.client_id ?? null);
        setLoadingAssignment(false);
      });
  }, [role, user]);

  // Gerente can only see overview
  useEffect(() => {
    if (role === "gerente" && activeSection !== "overview") {
      setActiveSection("overview");
    }
  }, [role, activeSection]);

  const handleSectionChange = (section: string) => {
    if (role === "gerente" && section !== "overview") return;
    setActiveSection(section);
  };

  // Colaborador uses its own full-screen layout (Jira/DevOps style) — no admin sidebar
  if (role === "colaborador") {
    return <ColaboradorDashboard />;
  }

  const clientData = clients || [];

  const selectedClient = activeSection.startsWith("client-")
    ? clientData.find(c => c.id === activeSection.replace("client-", ""))
    : null;

  const selectedSupportClientId = activeSection.startsWith("support-client-")
    ? activeSection.replace("support-client-", "")
    : null;

  // For gerente: find their assigned client
  const gerenteClient = role === "gerente" && assignedClientId
    ? clientData.find(c => c.id === assignedClientId)
    : null;

  const getTitle = () => {
    if (role === "gerente" && gerenteClient) return `Panel de Proyecto — ${gerenteClient.name}`;
    if (activeSection === "overview") return "Resumen Ejecutivo";
    if (activeSection === "clients") return "Implementación — Clientes";
    if (activeSection === "soporte") return "Soporte — Dashboard de Boletas";
    if (activeSection === "ai-usage") return "IA & Clasificación";
    if (activeSection === "team-scrum") return "Equipo Scrum";
    if (activeSection === "users") return "Gestión de Usuarios";
    if (selectedSupportClientId) {
      const sc = clientData.find(c => c.id === selectedSupportClientId);
      return sc ? `Soporte — ${sc.name}` : "Soporte — Cliente";
    }
    if (selectedClient) return selectedClient.name;
    return "Dashboard";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeSection={activeSection} onSectionChange={handleSectionChange} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-sm font-bold text-foreground">{getTitle()}</h1>
                <p className="text-xs text-muted-foreground">{projectInfo.name} — {projectInfo.company}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {role !== "gerente" && <ShareReportDialog />}
              <Button variant="ghost" size="icon" onClick={() => setDark(!dark)}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="w-full">
              {activeSection === "overview" && role === "gerente" && (
                loadingAssignment ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : gerenteClient ? (
                  <GerenteMobileDashboard client={gerenteClient} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No tiene un proyecto asignado. Contacte al administrador.</p>
                )
              )}
              {activeSection === "overview" && role !== "gerente" && <ExecutiveOverview />}
              {activeSection === "team-scrum" && <TeamScrumDashboard />}
              {activeSection === "soporte" && <SupportDashboard />}
              {selectedSupportClientId && <SupportDashboard initialClientId={selectedSupportClientId} onBack={() => setActiveSection("soporte")} />}
              {activeSection === "ai-usage" && <AIUsageDashboard />}
              {activeSection === "users" && <AdminUsers />}
              {activeSection === "clients" && (
                <ClientList
                  onSelectClient={(id) => setActiveSection(`client-${id}`)}
                  selectedClientId={undefined}
                />
              )}
              {selectedClient && (
                <ClientDetail
                  client={selectedClient}
                  onBack={() => setActiveSection("clients")}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
