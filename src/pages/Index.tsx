import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { ExecutiveOverview } from "@/components/dashboard/ExecutiveOverview";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDetail } from "@/components/clients/ClientDetail";
import TasksDashboard from "@/pages/TasksDashboard";
import { useClients } from "@/hooks/useClients";
import { clients as staticClients, projectInfo } from "@/data/projectData";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareReportDialog } from "@/components/dashboard/ShareReportDialog";

const Index = () => {
  const [activeSection, setActiveSection] = useState("overview");
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const { data: clients } = useClients();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
  };

  // Use data from Supabase or fallback to static
  const clientData = clients && clients.length > 0 ? clients : staticClients;

  const selectedClient = activeSection.startsWith("client-")
    ? clientData.find(c => c.id === activeSection.replace("client-", ""))
    : null;

  const getTitle = () => {
    if (activeSection === "overview") return "Resumen Ejecutivo";
    if (activeSection === "clients") return "Gestión de Clientes";
    if (activeSection === "tasks") return "Tareas Global";
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
              <ShareReportDialog />
              <Button variant="ghost" size="icon" onClick={() => setDark(!dark)}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="w-full">
              {activeSection === "overview" && <ExecutiveOverview />}

              {activeSection === "tasks" && <TasksDashboard />}

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
