import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { ExecutiveOverview } from "@/components/dashboard/ExecutiveOverview";
import { ClientDashboard } from "@/components/dashboard/ClientDashboard";
import { GerenteMobileDashboard } from "@/components/dashboard/GerenteMobileDashboard";
import { GerenteSupportDashboard } from "@/components/dashboard/GerenteSupportDashboard";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDetail } from "@/components/clients/ClientDetail";
import TeamScrumDashboard from "@/pages/TeamScrumDashboard";
import { SupportDashboard } from "@/components/support/SupportDashboard";
import ColaboradorDashboard from "@/pages/ColaboradorDashboard";
import { CEODashboard } from "@/components/dashboard/CEODashboard";
import { ClientPortalDashboard } from "@/components/dashboard/ClientPortalDashboard";
import { ConfigurationHub } from "@/components/settings/ConfigurationHub";
import { OverdueTicketsSheet } from "@/components/support/OverdueTicketsSheet";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { projectInfo } from "@/data/projectData";
import { Moon, Sun, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareReportDialog } from "@/components/dashboard/ShareReportDialog";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useSLASummary } from "@/hooks/useSLASummary";

// Key para persistir la sección activa entre tabs/refreshes (feedback COO 30/04:
// "cuando cambio a otra ventana se me devuelve al resumen ejecutivo").
// El re-render disparado por Supabase Auth.onAuthStateChange (TOKEN_REFRESHED al
// volver a la pestaña) reseteaba el useState. Persistimos en localStorage para
// recuperar la posición al recargar/cambiar focus.
const ACTIVE_SECTION_KEY = "sva-erp:active-section";

function readPersistedSection(): string {
  try {
    const v = localStorage.getItem(ACTIVE_SECTION_KEY);
    return v && v.length > 0 && v.length < 200 ? v : "overview";
  } catch { return "overview"; }
}

const Index = () => {
  const { role, user } = useAuth();
  useActivityTracker();
  const { data: slaSummary } = useSLASummary();
  const [activeSection, setActiveSectionState] = useState<string>(readPersistedSection);
  const [didLandRedirect, setDidLandRedirect] = useState(false);

  // Wrapper que persiste cada cambio. Reemplaza el setState directo en todo el componente.
  const setActiveSection = (section: string) => {
    setActiveSectionState(section);
    try { localStorage.setItem(ACTIVE_SECTION_KEY, section); } catch { /* quota / private mode */ }
  };

  // gerente_soporte aterriza directo en "soporte" (su área principal).
  // Se ejecuta cuando role llega del backend.
  useEffect(() => {
    if (role === "gerente_soporte" && !didLandRedirect && activeSection === "overview") {
      setActiveSection("soporte");
      setDidLandRedirect(true);
    }
  }, [role, didLandRedirect, activeSection]);
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

  // Cliente externo: portal dedicado con su empresa scopeada
  if (role === "cliente") {
    return <ClientPortalDashboard />;
  }

  // CEO: dashboard ejecutivo super-administrativo (read-only de todo el sistema)
  if (role === "ceo") {
    return <CEODashboard />;
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
    if (role === "gerente" && gerenteClient) {
      const isSupport = (gerenteClient as any).client_type === "soporte";
      return `${isSupport ? "Portal Soporte" : "Panel de Proyecto"} — ${gerenteClient.name}`;
    }
    if (activeSection === "overview") return "Resumen Ejecutivo";
    if (activeSection === "clients") return "Implementación — Clientes";
    if (activeSection === "soporte") return "Soporte — Dashboard de Boletas";
    if (activeSection === "team-scrum") return "Equipo Scrum";
    if (activeSection === "config") return "Configuración del sistema";
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
              {/* Pill global de "casos vencidos" — abre OverdueTicketsSheet
                  con la lista COMPLETA (no solo bandeja).
                  Si el user está en una vista de cliente específica, pasa el
                  clientId al evento → la sheet se scope automáticamente. */}
              {(slaSummary?.overdue ?? 0) > 0 && role !== "gerente" && (
                <button
                  onClick={() => {
                    const cid = selectedSupportClientId || (selectedClient?.id);
                    window.dispatchEvent(new CustomEvent("overdue:open", cid ? { detail: { clientId: cid } } : undefined));
                  }}
                  className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-destructive/40 bg-destructive/[0.06] hover:bg-destructive/[0.12] text-destructive text-xs font-bold transition-colors group"
                  title={`${slaSummary!.overdue} casos vencidos · click para gestionar${selectedSupportClientId ? " (filtrado a este cliente)" : ""}`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{slaSummary!.overdue}</span>
                  <span>vencido{slaSummary!.overdue === 1 ? "" : "s"}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity hidden lg:inline">→ ver</span>
                </button>
              )}
              <NotificationBell />
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
                  (gerenteClient as any).client_type === "soporte"
                    ? <GerenteSupportDashboard client={gerenteClient} />
                    : <GerenteMobileDashboard client={gerenteClient} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No tiene un proyecto asignado. Contacte al administrador.</p>
                )
              )}
              {activeSection === "overview" && role !== "gerente" && <ExecutiveOverview onNavigate={setActiveSection} />}
              {activeSection === "team-scrum" && <TeamScrumDashboard />}
              {activeSection === "soporte" && <SupportDashboard />}
              {selectedSupportClientId && <SupportDashboard initialClientId={selectedSupportClientId} onBack={() => setActiveSection("soporte")} />}
              {activeSection === "config" && <ConfigurationHub />}
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

      {/* Sheet global de boletas vencidas — disparable desde cualquier sección
          via window.dispatchEvent(new CustomEvent("overdue:open")) */}
      <OverdueTicketsSheet />
    </SidebarProvider>
  );
};

export default Index;
