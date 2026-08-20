import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mocks de dependencias de datos para poder montar los componentes en aislamiento.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: "admin", profile: { full_name: "Tester" }, user: { id: "u1" }, signOut: () => {} }),
}));
vi.mock("@/lib/extractPdfText", () => ({ extractTextFromFile: async () => "" }));

const chain = (): any => {
  const c: any = {};
  ["select", "insert", "update", "delete", "upsert", "eq", "neq", "order", "limit",
   "not", "in", "is", "gte", "lte", "filter", "or", "match", "range"].forEach((m) => (c[m] = () => c));
  c.maybeSingle = () => Promise.resolve({ data: null, error: null });
  c.single = () => Promise.resolve({ data: null, error: null });
  c.then = (res: any) => res({ data: [], error: null });
  return c;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => chain(),
    rpc: () => Promise.resolve({ data: [], error: null }),
    functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

import { ContractKbPanel } from "@/components/clients/ContractKbPanel";
import { ContractTermsEditor } from "@/components/clients/ContractTermsEditor";
import { SlaCompliancePanel } from "@/components/clients/SlaCompliancePanel";
import { SlaHistoryPanel } from "@/components/clients/SlaHistoryPanel";
import { AccountStatement360 } from "@/components/clients/AccountStatement360";
import { ContractDetailSheet } from "@/components/clients/ContractDetailSheet";
import { MobileConfig } from "@/components/mobile/MobileConfig";
import { DEFAULT_PREFERENCES } from "@/hooks/useUserPreferences";
import type { ClientContract } from "@/hooks/useClientContracts";
import type { ExtractedTerms } from "@/hooks/useContractKb";

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const TERMS: ExtractedTerms = {
  resumen: "Contrato de prueba",
  contrato: { tipo: "fee_mensual", valor_mensual: 749, moneda: "USD", es_suscripcion: true, ciclo_facturacion: "mensual" },
  servicio_contratado: "Soporte",
  version_core: "4.5",
  modulos: ["Factoraje"],
  slas: [{ prioridad: "Alta", tipo_caso: "all", tiempo_respuesta_horas: 4, tiempo_resolucion_horas: 24 }],
  paquetes_horas: [{ descripcion: "Bolsa", horas_incluidas: 40 }],
  hitos_facturacion: [{ numero: 1, descripcion: "Kickoff", condicion: "firma" }],
  disparadores_alerta: [{ titulo: "Horas", condicion: "80%" }],
  confianza: 90,
};

const CONTRATO: ClientContract = {
  id: "c1", client_id: "aurum", contract_type: "fee_mensual",
  monthly_value: 749, hourly_rate: 65, included_hours: 40, currency: "USD",
  start_date: "2026-01-01", end_date: "2026-12-31", auto_renewal: false,
  penalty_clause: null, payment_terms: "30 días", notes: null, is_active: true,
  status: "vigente", deleted_at: null,
};

describe("componentes de la sesión — render sin crash", () => {
  it("ContractKbPanel (el bug del Sparkles) renderiza", () => {
    const { container } = wrap(<ContractKbPanel clientId="aurum" />);
    expect(container.textContent).toContain("Base de conocimiento");
  });
  it("ContractTermsEditor renderiza con términos completos", () => {
    const { container } = wrap(<ContractTermsEditor terms={TERMS} onChange={() => {}} />);
    expect(container.textContent).toContain("Términos extraídos");
  });
  it("SlaCompliancePanel renderiza", () => {
    const { container } = wrap(<SlaCompliancePanel clientId="aurum" />);
    expect(container.textContent).toContain("Cumplimiento SLA");
  });
  it("SlaHistoryPanel renderiza", () => {
    const { container } = wrap(<SlaHistoryPanel clientId="aurum" />);
    expect(container.textContent).toContain("Histórico");
  });
  it("AccountStatement360 renderiza", () => {
    const { container } = wrap(<AccountStatement360 clientId="aurum" />);
    expect(container).toBeTruthy();
  });

  it("ContractDetailSheet (expediente 360) renderiza con un contrato", () => {
    const { baseElement } = wrap(
      <ContractDetailSheet contract={CONTRATO} clientId="aurum" open onOpenChange={() => {}} />,
    );
    // El contenido del Sheet se porta fuera del container, por eso baseElement.
    expect(baseElement.textContent).toContain("Fee mensual fijo");
    expect(baseElement.textContent).toContain("Vigencia");
    expect(baseElement.textContent).toContain("Pólizas vinculadas");
  });

  it("ContractDetailSheet sin contrato no renderiza nada", () => {
    const { baseElement } = wrap(
      <ContractDetailSheet contract={null} clientId="aurum" open onOpenChange={() => {}} />,
    );
    expect(baseElement.textContent).not.toContain("Vigencia");
  });

  it("MobileConfig cae en los valores por defecto cuando el usuario no tiene fila", async () => {
    const { findAllByRole } = wrap(<MobileConfig />);
    const switches = await findAllByRole("switch");
    // Los cinco toggles de preferencias, en el orden de la pantalla.
    expect(switches).toHaveLength(5);
    expect(switches.map((s) => s.getAttribute("data-state") === "checked")).toEqual([
      DEFAULT_PREFERENCES.sla_alerts,
      DEFAULT_PREFERENCES.reassigned_cases,
      DEFAULT_PREFERENCES.daily_summary,
      DEFAULT_PREFERENCES.ai_case_summary,
      DEFAULT_PREFERENCES.offline_mode,
    ]);
  });
});
