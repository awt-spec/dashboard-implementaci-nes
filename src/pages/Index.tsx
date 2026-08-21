import { useState, useEffect, lazy, Suspense, type CSSProperties } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { HeaderActionsProvider } from "@/components/dashboard/HeaderActions";
import { useIsDeskWide } from "@/hooks/use-mobile";
import { applyTheme, readStoredTheme, storeTheme } from "@/lib/theme";
import { ExecutiveOverview } from "@/components/dashboard/ExecutiveOverview";

// Lazy: dashboards específicos por rol o sección. Solo se descargan cuando
// el usuario realmente entra a su rol/sección. Bajan el initial bundle.
//   • ColaboradorDashboard → solo rol colaborador (full-screen Jira-style)
//   • CEODashboard         → solo rol ceo (cockpit ejecutivo)
//   • ClientPortalDashboard → solo rol cliente (portal externo)
//   • GerenteMobile/Support → solo rol gerente
//   • TeamScrumDashboard   → sección scrum (admin/pm)
//   • SupportDashboard     → sección soporte (admin/pm/gerente_soporte)
//   • ConfigurationHub     → sección config (admin)
//   • ClientList, ClientDetail → sección Implementación
const ColaboradorDashboard    = lazy(() => import("@/pages/ColaboradorDashboard"));
const CSRDashboard            = lazy(() => import("@/components/dashboard/CSRDashboard").then(m => ({ default: m.CSRDashboard })));
const CEODashboard            = lazy(() => import("@/components/dashboard/CEODashboard").then(m => ({ default: m.CEODashboard })));
const ClientPortalDashboard   = lazy(() => import("@/components/dashboard/ClientPortalDashboard").then(m => ({ default: m.ClientPortalDashboard })));
const GerenteMobileDashboard  = lazy(() => import("@/components/dashboard/GerenteMobileDashboard").then(m => ({ default: m.GerenteMobileDashboard })));
const GerenteSupportDashboard = lazy(() => import("@/components/dashboard/GerenteSupportDashboard").then(m => ({ default: m.GerenteSupportDashboard })));
const TeamScrumDashboard      = lazy(() => import("@/pages/TeamScrumDashboard"));
const SupportDashboard        = lazy(() => import("@/components/support/SupportDashboard").then(m => ({ default: m.SupportDashboard })));
const ConfigurationHub        = lazy(() => import("@/components/settings/ConfigurationHub").then(m => ({ default: m.ConfigurationHub })));
const ClientList              = lazy(() => import("@/components/clients/ClientList").then(m => ({ default: m.ClientList })));
const ClientDetail            = lazy(() => import("@/components/clients/ClientDetail").then(m => ({ default: m.ClientDetail })));

// Variantes MÓVILES (nuevas, viven en src/components/mobile/). Se renderizan
// como hermanas del componente de escritorio: el móvil va en un contenedor
// md:hidden y el de escritorio en hidden md:block, así el escritorio queda
// exactamente igual que antes. También lazy: aunque React sí las monta en
// escritorio (CSS oculta, no desmonta), el chunk se baja con la sección y no
// engorda el bundle inicial.
const MobileResumen           = lazy(() => import("@/components/mobile/MobileResumen").then(m => ({ default: m.MobileResumen })));
const MobileClientes          = lazy(() => import("@/components/mobile/MobileClientes").then(m => ({ default: m.MobileClientes })));
const MobileScrum             = lazy(() => import("@/components/mobile/MobileScrum").then(m => ({ default: m.MobileScrum })));
const MobileConfig            = lazy(() => import("@/components/mobile/MobileConfig").then(m => ({ default: m.MobileConfig })));

// OverdueTicketsSheet se importa eager — está en el header global como pill
// y es la primera interacción común. Si fuera lazy, el primer click sería lento.
import { OverdueTicketsSheet } from "@/components/support/OverdueTicketsSheet";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { useMyPermissions } from "@/hooks/usePermissions";
import { projectInfo } from "@/data/projectData";
import { Loader2 } from "lucide-react";
import { ShareReportDialog } from "@/components/dashboard/ShareReportDialog";
import { CommandPalette, useCommandPalette } from "@/components/common/CommandPalette";
import { MobileNavDrawer } from "@/components/common/MobileNavDrawer";
import { MobileOverdueStrip } from "@/components/common/MobileOverdueStrip";
import { MobileTabBar, type MobileTabItem } from "@/components/common/MobileTabBar";
import { visibleNav } from "@/lib/navigation";
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
  const { data: myPerms } = useMyPermissions();
  // ⌘K global (el hook registra el listener); el trigger del header sólo abre.
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [activeSection, setActiveSectionState] = useState<string>(readPersistedSection);
  const [didLandRedirect, setDidLandRedirect] = useState(false);

  // Wrapper que persiste cada cambio. Reemplaza el setState directo en todo el componente.
  const setActiveSection = (section: string) => {
    setActiveSectionState(section);
    try { localStorage.setItem(ACTIVE_SECTION_KEY, section); } catch { /* quota / private mode */ }
  };

  // gerente_soporte y csr aterrizan directo en "soporte" (su área principal).
  // Se ejecuta cuando role llega del backend.
  useEffect(() => {
    if ((role === "gerente_soporte" || role === "csr") && !didLandRedirect && activeSection === "overview") {
      setActiveSection("soporte");
      setDidLandRedirect(true);
    }
  }, [role, didLandRedirect, activeSection]);
  // El tema ya se aplicó en main.tsx; acá sólo se lee para el botón.
  const [dark, setDark] = useState(() => readStoredTheme() === "dark");

  // §8: expandido a partir de 1180px, colapsado a 60px por debajo. El provider
  // queda controlado para que el ancho siga al breakpoint, pero SidebarTrigger
  // sigue mandando: si el usuario lo toca, su elección vale hasta que vuelva a
  // cruzar el breakpoint.
  const isDeskWide = useIsDeskWide();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    if (isDeskWide === undefined) return;
    setSidebarOpen(isDeskWide);
  }, [isDeskWide]);
  const { data: clients } = useClients();
  // Un gerente puede tener 1..N clientes asignados (el diálogo de admin usa
  // checkboxes multi-selección). Guardamos la lista completa + cuál está activo.
  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);
  const [selectedGerenteClientId, setSelectedGerenteClientId] = useState<string | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);

  useEffect(() => {
    const theme = dark ? "dark" : "light";
    applyTheme(theme);
    storeTheme(theme);
  }, [dark]);

  // Fetch gerente's assigned client(s). Antes usaba .maybeSingle(), que ante
  // 2+ asignaciones devolvía error (PGRST116) y dejaba al gerente sin cliente
  // ("No tiene proyecto asignado") pese a tener asignaciones. Ahora trae todas.
  useEffect(() => {
    if (role !== "gerente" || !user) return;
    setLoadingAssignment(true);
    supabase
      .from("gerente_client_assignments")
      .select("client_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const ids = (data || []).map(a => a.client_id);
        setAssignedClientIds(ids);
        setSelectedGerenteClientId(prev =>
          prev && ids.includes(prev) ? prev : (ids[0] ?? null)
        );
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

  // Spinner consistente para los Suspense fallbacks de dashboards lazy.
  const LazyFallback = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  // Colaborador uses its own full-screen layout (Jira/DevOps style) — no admin sidebar
  if (role === "colaborador") {
    return <Suspense fallback={LazyFallback}><ColaboradorDashboard /></Suspense>;
  }

  // CSR: cockpit de agente de atención (cola, escalación, sesiones) — vista propia
  if (role === "csr") {
    return <Suspense fallback={LazyFallback}><CSRDashboard /></Suspense>;
  }

  // Cliente externo: portal dedicado con su empresa scopeada
  if (role === "cliente") {
    return <Suspense fallback={LazyFallback}><ClientPortalDashboard /></Suspense>;
  }

  // CEO: dashboard ejecutivo super-administrativo (read-only de todo el sistema)
  if (role === "ceo") {
    return <Suspense fallback={LazyFallback}><CEODashboard /></Suspense>;
  }

  const clientData = clients || [];

  const selectedClient = activeSection.startsWith("client-")
    ? clientData.find(c => c.id === activeSection.replace("client-", ""))
    : null;

  const selectedSupportClientId = activeSection.startsWith("support-client-")
    ? activeSection.replace("support-client-", "")
    : null;

  const overdueCount = slaSummary?.overdue ?? 0;
  // El gerente no gestiona boletas globales: mismo gating que el pill del header.
  const showOverdueEntry = overdueCount > 0 && role !== "gerente";

  // Abre la sheet global de vencidos. Si el usuario está parado en un cliente,
  // pasa su id para que la sheet arranque filtrada a ese cliente.
  const openOverdue = () => {
    const cid = selectedSupportClientId || selectedClient?.id;
    window.dispatchEvent(new CustomEvent("overdue:open", cid ? { detail: { clientId: cid } } : undefined));
  };

  // Misma nav que sidebar/drawer/palette (src/lib/navigation.ts); la tab bar usa
  // el rótulo corto porque el completo no entra en 5 columnas de 390px.
  const tabItems: MobileTabItem[] = visibleNav(role, myPerms).map(item => ({
    key: item.id,
    label: item.shortTitle,
    icon: item.icon,
    badge: item.id === "soporte" ? overdueCount : undefined,
  }));

  // For gerente: find their currently-selected assigned client
  const gerenteClient = role === "gerente" && selectedGerenteClientId
    ? clientData.find(c => c.id === selectedGerenteClientId)
    : null;
  // Clientes asignados resueltos (para el selector cuando hay más de uno).
  const gerenteAssignedClients = role === "gerente"
    ? assignedClientIds
        .map(id => clientData.find(c => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
    : [];

  // ¿Esta sección tiene variante móvil de pantalla completa?
  // "soporte" y los detalles (client-*/support-client-*) quedan como estaban.
  // El gerente no entra: su "overview" sigue siendo GerenteMobileDashboard.
  const showsMobileScreen =
    role !== "gerente" &&
    (activeSection === "overview" ||
      activeSection === "clients" ||
      activeSection === "team-scrum" ||
      activeSection === "config");

  // DOBLE SCROLL: las pantallas móviles ya traen su propio área scrolleable
  // (flex-1 min-h-0 overflow-y-auto). Si el <main> también scrollea, el móvil
  // crece a su altura natural, el scroll interno nunca se activa y termina
  // scrolleando el contenedor de afuera (header de la pantalla incluido).
  // Solución: cuando hay pantalla móvil, en <md el <main> deja de scrollear
  // (overflow-hidden) y pasa a ser columna flex de altura fija, para que el
  // hijo pueda reclamar el alto disponible con flex-1 + min-h-0. Se conserva
  // pb-24 (reserva de la tab bar fija) y se quita el padding lateral/superior
  // para que la pantalla vaya de borde a borde. Todas las variantes md:*
  // restauran los valores actuales, así que el escritorio no cambia.
  const mainClass = showsMobileScreen
    ? "flex-1 min-h-0 flex flex-col overflow-hidden px-0 pt-0 pb-24 md:block md:overflow-auto md:p-6 md:pb-6"
    : "flex-1 min-h-0 overflow-auto p-4 md:p-6 pb-24 md:pb-6";
  const sectionWrapClass = showsMobileScreen
    ? "w-full animate-fadein flex flex-col flex-1 min-h-0 md:block"
    : "w-full animate-fadein";
  // Contenedor de cada pantalla móvil: cadena flex-1/min-h-0 sin cortes hasta
  // el overflow-y-auto interno de MobileScreen.
  const mobileWrap = "flex flex-col flex-1 min-h-0 md:hidden";
  const onMobileMenu = () => setNavDrawerOpen(true);

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

  // El subtítulo describe la VISTA, no la app: repetir "SYSDE — …" en las cinco
  // secciones gasta la segunda línea del header sin informar nada.
  const getSubtitle = () => {
    if (role === "gerente" && gerenteClient) return `${projectInfo.name} — ${projectInfo.company}`;
    if (activeSection === "overview") return "Estado de la operación · clientes, equipo y riesgos";
    if (activeSection === "clients") return "Cartera de proyectos · fases, entregables y riesgos";
    if (activeSection === "soporte") return "Cola de casos · SLA, prioridad y responsables";
    if (activeSection === "team-scrum") return "Sprints activos · tablero, bloqueos y carga";
    if (activeSection === "config") return "Catálogos, permisos y parámetros del sistema";
    return `${projectInfo.name} — ${projectInfo.company}`;
  };

  return (
    // Anchos del handoff (§8): 216px expandido / 60px colapsado. shadcn trae
    // 16rem/3rem por defecto; se sobreescriben por variable CSS en el provider.
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{ "--sidebar-width": "216px", "--sidebar-width-icon": "60px" } as CSSProperties}
    >
      <HeaderActionsProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeSection={activeSection} onSectionChange={handleSectionChange} />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <AppHeader
            title={getTitle()}
            subtitle={getSubtitle()}
            onMobileMenu={() => setNavDrawerOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
            overdue={showOverdueEntry ? { count: overdueCount, scoped: !!selectedSupportClientId, onClick: openOverdue } : null}
            dark={dark}
            onToggleDark={() => setDark(!dark)}
            trailing={role !== "gerente" ? <ShareReportDialog /> : undefined}
          />

          {/* Franja móvil de vencidos: mismo evento que el pill del header. */}
          {showOverdueEntry && <MobileOverdueStrip count={overdueCount} onClick={openOverdue} />}

          {/* min-h-0: sin esto el main no puede encogerse por debajo de su
              contenido y el scroll se desborda fuera del área visible.
              pb-24 (96px) libera la tab bar fija (~62px + safe-area). */}
          <main className={mainClass}>
            {/* Suspense envuelve TODO el contenido lazy del main: cualquier sección
                que el user abra (scrum/soporte/config/clientes/detalle) se carga
                on-demand. El fallback es el spinner inline (no fullscreen) para
                que el sidebar permanezca visible durante el chunk download. */}
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              {/* key=activeSection: todo el contenido de este div ya está
                  condicionado por activeSection, así que remontarlo no cambia
                  el comportamiento y permite el fade-in por sección. */}
              <div key={activeSection} className={sectionWrapClass}>
                {activeSection === "overview" && role === "gerente" && (
                  loadingAssignment ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : gerenteClient ? (
                    <div className="space-y-4">
                      {/* Selector de cliente cuando el gerente tiene más de uno asignado */}
                      {gerenteAssignedClients.length > 1 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {gerenteAssignedClients.map(c => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedGerenteClientId(c.id)}
                              className={`h-8 px-3 rounded-full border text-xs font-semibold transition-colors ${
                                c.id === selectedGerenteClientId
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border/60 text-muted-foreground hover:bg-accent/50"
                              }`}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {(gerenteClient as any).client_type === "soporte"
                        ? <GerenteSupportDashboard client={gerenteClient} />
                        : <GerenteMobileDashboard client={gerenteClient} />}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">No tiene un proyecto asignado. Contacte al administrador.</p>
                  )
                )}
                {activeSection === "overview" && role !== "gerente" && (
                  <>
                    <div className={mobileWrap}>
                      <MobileResumen onMenu={onMobileMenu} onNavigate={handleSectionChange} />
                    </div>
                    <div className="hidden md:block">
                      <ExecutiveOverview onNavigate={setActiveSection} />
                    </div>
                  </>
                )}
                {activeSection === "team-scrum" && (
                  <>
                    <div className={mobileWrap}>
                      <MobileScrum onMenu={onMobileMenu} />
                    </div>
                    <div className="hidden md:block">
                      <TeamScrumDashboard />
                    </div>
                  </>
                )}
                {activeSection === "soporte" && <SupportDashboard />}
                {selectedSupportClientId && <SupportDashboard initialClientId={selectedSupportClientId} onBack={() => setActiveSection("soporte")} />}
                {activeSection === "config" && (
                  <>
                    <div className={mobileWrap}>
                      <MobileConfig onMenu={onMobileMenu} />
                    </div>
                    <div className="hidden md:block">
                      <ConfigurationHub />
                    </div>
                  </>
                )}
                {activeSection === "clients" && (
                  <>
                    <div className={mobileWrap}>
                      <MobileClientes onMenu={onMobileMenu} />
                    </div>
                    <div className="hidden md:block">
                      <ClientList
                        onSelectClient={(id) => setActiveSection(`client-${id}`)}
                        selectedClientId={undefined}
                      />
                    </div>
                  </>
                )}
                {selectedClient && (
                  <ClientDetail
                    client={selectedClient}
                    onBack={() => setActiveSection("clients")}
                  />
                )}
              </div>
            </Suspense>
          </main>
        </div>
      </div>

      {/* Navegación móvil: drawer (reemplaza al sidebar) + tab bar fija.
          La tab bar sólo aparece si hay al menos 2 destinos (el gerente
          únicamente puede ver "overview", ahí no aporta nada). */}
      <MobileNavDrawer
        open={navDrawerOpen}
        onOpenChange={setNavDrawerOpen}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />
      {tabItems.length > 1 && (
        <MobileTabBar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          items={tabItems}
        />
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={handleSectionChange} />

      {/* Sheet global de boletas vencidas — disparable desde cualquier sección
          via window.dispatchEvent(new CustomEvent("overdue:open")) */}
      <OverdueTicketsSheet />
      </HeaderActionsProvider>
    </SidebarProvider>
  );
};

export default Index;
