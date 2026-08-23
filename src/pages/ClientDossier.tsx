import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { HeaderActionsProvider } from "@/components/dashboard/HeaderActions";
import { CommandPalette, useCommandPalette } from "@/components/common/CommandPalette";
import { useClientDossier } from "@/hooks/useClientDossier";
import { DossierHeader, type DossierCtx } from "@/components/client-dossier/DossierHeader";
import { DossierKpiRow } from "@/components/client-dossier/DossierKpiRow";
import { SupportContext } from "@/components/client-dossier/SupportContext";
import { ImplContext } from "@/components/client-dossier/ImplContext";
import { applyTheme, readStoredTheme, storeTheme } from "@/lib/theme";
import type { CSSProperties } from "react";

/**
 * Expediente del cliente: la misma cabecera y los mismos KPIs para dos
 * contextos conmutables. La reincidencia de soporte y el riesgo del proyecto
 * suelen ser el mismo problema, y hasta ahora vivían en pantallas distintas.
 *
 * El contexto va en la URL (?ctx=) para que el enlace sea compartible y
 * sobreviva a un refresh.
 */
export default function ClientDossier() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const dossier = useClientDossier(id);

  const ctx: DossierCtx = params.get("ctx") === "impl" ? "impl" : "soporte";
  const setCtx = (next: DossierCtx) => {
    const p = new URLSearchParams(params);
    p.set("ctx", next);
    // replace: conmutar contexto no debería llenar el historial de pasos.
    setParams(p, { replace: true });
  };

  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => { setHighlightId(null); }, [ctx]);

  const [dark, setDark] = useState(() => readStoredTheme() === "dark");
  useEffect(() => {
    const theme = dark ? "dark" : "light";
    applyTheme(theme);
    storeTheme(theme);
  }, [dark]);

  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();

  const name = dossier.client?.name ?? "Cliente";

  return (
    <SidebarProvider
      open={false}
      onOpenChange={() => {}}
      style={{ "--sidebar-width": "216px", "--sidebar-width-icon": "60px" } as CSSProperties}
    >
      <HeaderActionsProvider>
        <div className="flex min-h-screen w-full">
          {/* Colapsado: en el expediente el contenido manda, la navegación
              queda como glifos. */}
          <AppSidebar activeSection="clients" onSectionChange={() => navigate("/")} />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AppHeader
              title={`${name} — expediente del cliente`}
              subtitle="Vista unificada de soporte e implementación"
              onMobileMenu={() => navigate("/")}
              onOpenPalette={() => setPaletteOpen(true)}
              overdue={null}
              dark={dark}
              onToggleDark={() => setDark(!dark)}
              trailing={
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/")}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Volver
                </Button>
              }
            />

            <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 md:p-5">
              {dossier.isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : !dossier.client ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                  <p className="text-sm text-muted-foreground">No se encontró el cliente <code>{id}</code>.</p>
                  <Button size="sm" onClick={() => navigate("/")}>Volver a clientes</Button>
                </div>
              ) : (
                <>
                  <DossierHeader dossier={dossier} ctx={ctx} onCtxChange={setCtx} />
                  <DossierKpiRow kpis={ctx === "soporte" ? dossier.supportKpis : dossier.implKpis} />
                  {ctx === "soporte" ? (
                    <SupportContext
                      dossier={dossier}
                      onGoToRisk={riskId => { setCtx("impl"); setHighlightId(riskId); }}
                      highlightId={highlightId}
                    />
                  ) : (
                    <ImplContext
                      dossier={dossier}
                      onGoToSupport={() => { setCtx("soporte"); setHighlightId(null); }}
                      highlightId={highlightId}
                    />
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </HeaderActionsProvider>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={() => navigate("/")} />
    </SidebarProvider>
  );
}
