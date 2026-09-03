import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SupportTicket } from "@/hooks/useSupportTickets";
import type { Client } from "@/data/projectData";

/**
 * QA funcional del expediente de cliente (/clientes/:id), de punta a punta
 * dentro del árbol de React: página real, hook real, componentes reales. Sólo
 * se simulan las lecturas a la base. Cada prueba está armada para que el
 * dato distinga el arreglo de su bug — si el bug volviera, la prueba cae.
 *
 * "Ahora" queda fijo en el 15 de septiembre de 2026 (mediodía UTC, 6am CR).
 */

/* ── Estado mutable que las fábricas de mocks leen en cada llamada ── */
const state = vi.hoisted(() => {
  const statusRow = (over: Record<string, unknown>) => ({
    client_id: "cmi", estado: "EN PROCESO", prioridad: "Alta", limit_hours: 24, elapsed_hours: 6,
    sla_source: "contrato", sla_status: "ok", in_scope: true, registered_late: false,
    coverage: "cubierto", contract_id: "k1", first_response_at: "2026-09-02T15:00:00Z",
    response_limit_hours: 4, response_hours: 1, response_status: "ok",
    ...over,
  });
  return {
    role: "admin" as string | null,
    contractsLoading: false,
    csv: [] as string[],
    // Lo que devuelve get_tickets_sla_status(). Primera respuesta: 1 ok, 1
    // tarde, 1 en curso -> 50% sobre los 2 con veredicto. Cobertura: T-2 fuera
    // de vigencia, T-3 sin contrato -> 2 sin cobertura. T-2 además vencido.
    statusRows: [
      statusRow({ ticket_id: "t1", response_status: "ok" }),
      statusRow({ ticket_id: "t2", response_status: "late", response_hours: 7, coverage: "fuera_de_vigencia", sla_status: "overdue", elapsed_hours: 30 }),
      statusRow({ ticket_id: "t3", response_status: "pending", first_response_at: null, response_hours: 2, coverage: "sin_contrato", contract_id: null, sla_status: "warning", elapsed_hours: 20 }),
    ],
    cutoff: "2026-09-01T06:00:00Z",
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    role: state.role, user: { id: "u-admin" }, loading: false,
    profile: { full_name: "Tester", email: "t@sysde.com", avatar_url: null },
    clienteAssignment: null, signOut: async () => {},
  }),
}));

// Cliente de Supabase inerte: lo que no está simulado a nivel de hook cae
// acá y devuelve vacío en vez de reventar.
type Resultado = { data: unknown; error: null };
type Cadena = Record<string, (...args: unknown[]) => Cadena> & {
  maybeSingle: () => Promise<Resultado>;
  single: () => Promise<Resultado>;
  then: (res: (r: Resultado) => unknown) => unknown;
};
const chain = (): Cadena => {
  const c = {} as Cadena;
  ["select", "insert", "update", "delete", "upsert", "eq", "neq", "order", "limit",
   "not", "in", "is", "gte", "lte", "lt", "gt", "filter", "or", "match", "range", "ilike"].forEach(m => (c[m] = () => c));
  c.maybeSingle = () => Promise.resolve({ data: null, error: null });
  c.single = () => Promise.resolve({ data: null, error: null });
  c.then = res => res({ data: [], error: null });
  return c;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => chain(),
    rpc: (name: string) => Promise.resolve({
      data: name === "get_tickets_sla_status" ? state.statusRows
          : name === "sla_measurement_start" ? state.cutoff
          : [],
      error: null,
    }),
    functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
    auth: { getUser: () => Promise.resolve({ data: { user: null } }), getSession: () => Promise.resolve({ data: { session: null } }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

/* ── Fixtures ── */

const NOW = new Date("2026-09-15T12:00:00Z");

const CLIENT: Client = {
  id: "cmi", name: "CMI", country: "Guatemala", industry: "Factoraje",
  contactName: "Ana Contacto", contactEmail: "ana@cmi.com",
  contractStart: "2026-01-01", contractEnd: "2026-12-31",
  status: "activo", progress: 62,
  phases: [
    { name: "Análisis", status: "completado", progress: 100, startDate: "2026-01-01", endDate: "2026-03-01" },
    { name: "Construcción", status: "en-progreso", progress: 40, startDate: "2026-03-01", endDate: "2026-10-01" },
  ],
  deliverables: [
    { id: "D-1", name: "Documento de alcance", type: "documento", status: "aprobado", dueDate: "2026-02-01", deliveredDate: "2026-01-28", version: "1.0" },
    { id: "D-2", name: "Módulo de cobros", type: "modulo", status: "pendiente", dueDate: "2026-11-01", version: "0.1" },
  ],
  tasks: [],
  comments: [], actionItems: [], meetingMinutes: [], emailNotifications: [],
  risks: [{ id: "R-1", description: "Integración bancaria inestable", impact: "alto", status: "abierto", mitigation: "Ambiente de pruebas" }],
  teamAssigned: ["Luis Alfaro"],
  coreVersion: "4.5",
};

function ticket(over: Partial<SupportTicket> & { id: string; ticket_id: string }): SupportTicket {
  return {
    client_id: "cmi", producto: "Factoraje", asunto: `Asunto ${over.ticket_id}`, tipo: "Incidente",
    prioridad: "Alta", estado: "EN PROCESO", fecha_registro: "2026-09-02T14:00:00Z", fecha_entrega: null,
    dias_antiguedad: 3, ai_classification: null, ai_risk_level: null, ai_summary: null,
    responsable: "Hellen Calvo", notas: null, case_agreements: [], case_actions: [],
    created_at: "2026-09-02T14:00:00Z", updated_at: "2026-09-02T14:00:00Z",
    tiempo_cobrado_minutos: 0,
    ...over,
  } as SupportTicket;
}

// Cuatro abiertos. Los tres primeros son de septiembre en Costa Rica; el
// cuarto está fechado 2026-09-01T04:00Z, que en CR es el 31 de agosto a las
// 10pm: con el bug viejo (prefijo crudo del ISO) contaba en septiembre.
const OPEN: SupportTicket[] = [
  ticket({ id: "t1", ticket_id: "T-1", tiempo_cobrado_minutos: 60, responsable: "Hellen Calvo" }),
  ticket({ id: "t2", ticket_id: "T-2", tiempo_cobrado_minutos: 90, responsable: "Orlando Castro" }),
  ticket({ id: "t3", ticket_id: "T-3", tiempo_cobrado_minutos: 30, responsable: "Hellen Calvo" }),
  ticket({ id: "t4", ticket_id: "T-4", tiempo_cobrado_minutos: 120, created_at: "2026-09-01T04:00:00Z", fecha_registro: "2026-09-01T04:00:00Z" }),
];

// 130 cerrados: más que el recorte de 100 que tenía la pestaña Histórico.
const CLOSED: SupportTicket[] = Array.from({ length: 130 }, (_, i) =>
  ticket({
    id: `c${i}`, ticket_id: `C-${i}`, estado: "CERRADA",
    created_at: "2026-07-01T10:00:00Z", fecha_registro: "2026-07-01T10:00:00Z",
    fecha_entrega: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
  }),
);

const TICKETS = [...OPEN, ...CLOSED];

vi.mock("@/hooks/useClients", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useClients")>()),
  useClients: () => ({ data: [CLIENT], isLoading: false }),
}));
vi.mock("@/hooks/useSupportTickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useSupportTickets")>()),
  useSupportTickets: (clientId?: string) => ({
    data: clientId === "cmi" ? TICKETS : [], isLoading: false,
  }),
}));
vi.mock("@/hooks/useClientContracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useClientContracts")>()),
  useClientContracts: () => ({
    isLoading: state.contractsLoading,
    data: state.contractsLoading ? [] : [{
      id: "k1", client_id: "cmi", contract_type: "fee_mensual", monthly_value: 749, hourly_rate: 65,
      included_hours: 40, currency: "USD", start_date: "2026-01-01", end_date: "2026-12-31",
      auto_renewal: false, is_active: true, status: "vigente", deleted_at: null,
    }],
  }),
}));
vi.mock("@/hooks/useSlaHistory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useSlaHistory")>()),
  useSlaHistory: () => ({
    isLoading: false,
    data: {
      closed_total: 130,
      overall: { measured: 130, met: 110, avg_resolution_hours: 40 },
      response: { measured: 100, met: 90 },
      by_month: [
        { month: "2026-05", total: 30, met: 24 }, { month: "2026-06", total: 40, met: 36 }, { month: "2026-07", total: 60, met: 50 },
      ],
      by_priority: [],
    },
  }),
}));
vi.mock("@/hooks/useTicketReopens", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useTicketReopens")>()),
  useReopenRate90d: () => ({ isLoading: false, data: { reopens_90d: 3, entregados_90d: 60, rate_pct: 5 } }),
}));
vi.mock("@/lib/exportCsv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/exportCsv")>()),
  downloadCsv: (_name: string, content: string) => { state.csv.push(content); },
}));

import ClientDossier from "@/pages/ClientDossier";

function mount(path = "/clientes/cmi") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/clientes/:id" element={<ClientDossier />} />
          <Route path="/" element={<div>inicio</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * La tarjeta KPI con ese rótulo. Espera a que la RPC de SLA resuelva (el hook
 * real pasa por react-query) y descarta coincidencias que no son tarjeta —
 * "Entregables" también es una pestaña, por ejemplo.
 */
async function kpi(label: string): Promise<HTMLElement> {
  const candidatos = await screen.findAllByText(label);
  const card = candidatos.map(c => c.closest("[title]") as HTMLElement | null).find(Boolean);
  if (!card) throw new Error(`KPI "${label}" no encontrado`);
  return card;
}

/** Espera a que la pantalla haya salido del spinner y pintado los KPIs. */
async function listo() {
  await screen.findByText("Cumplimiento SLA", {}, { timeout: 4000 });
}

/**
 * El botón de contexto de la banda, no el de la barra lateral. La barra
 * también tiene un "Implementación" (con aria-current="page", que navega al
 * inicio); el de la banda es el que lleva el dato vivo en el sublabel.
 */
function ctxButton(name: RegExp): HTMLElement {
  const b = screen.getAllByRole("button", { name }).find(x => /fase|caso/.test(x.textContent ?? ""));
  if (!b) throw new Error(`Botón de contexto ${name} no encontrado`);
  return b;
}

let consoleErrors: string[] = [];

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => {
  state.role = "admin"; state.contractsLoading = false; state.csv = [];
  consoleErrors = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { consoleErrors.push(a.map(String).join(" ")); });
});
afterEach(() => { vi.restoreAllMocks(); });

describe("expediente — cabecera y KPIs de soporte", () => {
  it("monta la banda del cliente con el nombre y sin errores de consola", async () => {
    mount();
    await listo();
    expect(screen.getByRole("heading", { level: 2, name: "CMI" })).toBeInTheDocument();
    // Radix avisa por descripciones faltantes en diálogos; eso no es un error nuestro.
    const propios = consoleErrors.filter(e => !/aria-describedby|Description/.test(e));
    expect(propios).toEqual([]);
  });

  it("muestra el KPI de primera respuesta calculado desde las filas de SLA", async () => {
    mount();
    const k = await kpi("Primera respuesta");
    // 1 ok + 1 tarde con veredicto; el que sigue en plazo no cuenta -> 50%.
    expect(k.textContent).toContain("50%");
    expect(k.textContent).toContain("1 en curso");
    expect(k.getAttribute("title")).toBe("1 a tiempo de 2 con veredicto · 1 esperando");
  });

  it("agrega el badge de casos sin cobertura contractual", async () => {
    mount();
    // T-2 fuera de vigencia + T-3 sin contrato.
    expect(await screen.findByText("2 sin cobertura")).toBeInTheDocument();
  });

  it("sigue mostrando los badges de siempre junto al nuevo", async () => {
    mount();
    expect(await screen.findByText("1 fuera de SLA")).toBeInTheDocument();   // T-2 vencido
    expect(screen.getByText(/Factoraje · 134 casos/)).toBeInTheDocument();
  });
});

describe("expediente — horas del mes en hora de Costa Rica", () => {
  it("no cuenta el ticket que en CR todavía es de agosto", async () => {
    mount();
    // 60 + 90 + 30 = 180 min = 3 h. T-4 (120 min) queda fuera: en CR es 31/8.
    // Con el bug viejo el prefijo crudo '2026-09' lo colaba y daba 5 / 40.
    expect((await kpi("Horas del mes")).textContent).toContain("3 / 40");
  });

  it("el panel de horas por especialista aplica el mismo criterio", async () => {
    mount();
    const panel = (await screen.findByText("Horas por especialista")).closest("div")!.parentElement!;
    // Hellen 1.5 h (60+30), Orlando 1.5 h. T-4 sin responsable y de agosto: fuera.
    expect(panel.textContent).toContain("3 h");
    expect(within(panel).getByText("Hellen Calvo")).toBeInTheDocument();
    expect(within(panel).getByText("Orlando Castro")).toBeInTheDocument();
  });
});

describe("expediente — histórico completo y exportación", () => {
  it("la pestaña Histórico renderiza tantas filas como dice su contador", async () => {
    const { container } = mount();
    await listo();
    fireEvent.click(screen.getByRole("button", { name: /Histórico/ }));
    const chip = screen.getByRole("button", { name: /Histórico/ });
    expect(chip.textContent).toContain("130");
    // Cada fila: primero el riel de color, después la boleta C-n.
    const filas = container.querySelectorAll('[style*="grid-template-columns"] > span:nth-child(2)');
    const boletas = Array.from(filas).map(s => s.textContent).filter(t => /^C-\d+$/.test(t ?? ""));
    expect(boletas).toHaveLength(130);
  });

  it("el CSV exporta las 130, no 100", async () => {
    mount();
    await listo();
    fireEvent.click(screen.getByRole("button", { name: /Histórico/ }));
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(state.csv).toHaveLength(1);
    const lineas = state.csv[0].trim().split(/\r?\n/);
    expect(lineas).toHaveLength(131); // cabecera + 130
    expect(lineas[0]).toMatch(/Boleta/);
  });
});

describe("expediente — abrir un caso", () => {
  it("clic en una fila de Casos abiertos abre el detalle del ticket", async () => {
    const { baseElement } = mount();
    await listo();
    // Antes de tocar nada no hay diálogo.
    expect(baseElement.querySelector("[role=dialog]")).toBeNull();
    fireEvent.click(screen.getByText("Asunto T-1"));
    const dialog = baseElement.querySelector("[role=dialog]") as HTMLElement;
    expect(dialog).not.toBeNull();
    // El detalle repite la boleta (cabecera y ficha): basta con que esté.
    expect(within(dialog).getAllByText("T-1").length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("heading", { name: "Asunto T-1" })).toBeInTheDocument();
  });

  it("las filas son accesibles con teclado", async () => {
    const { baseElement } = mount();
    await listo();
    const fila = screen.getByText("Asunto T-2").closest('[role="button"]') as HTMLElement;
    expect(fila).not.toBeNull();
    fireEvent.keyDown(fila, { key: "Enter" });
    const dialog = baseElement.querySelector("[role=dialog]") as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(within(dialog).getAllByText("T-2").length).toBeGreaterThan(0);
  });
});

describe("expediente — contexto de implementación", () => {
  it("?ctx=impl muestra los KPIs del proyecto y no los de soporte", async () => {
    mount("/clientes/cmi?ctx=impl");
    expect((await kpi("Avance global")).textContent).toContain("62%");
    expect((await kpi("Fase actual")).textContent).toContain("2 / 2");
    expect((await kpi("Entregables")).textContent).toContain("1 / 2");
    expect((await kpi("Riesgos abiertos")).textContent).toContain("1");
    expect(screen.queryByText("Primera respuesta")).toBeNull();
  });

  it("conmutar el contexto desde la banda cambia los KPIs", async () => {
    mount();
    expect(await screen.findByText("Primera respuesta")).toBeInTheDocument();
    fireEvent.click(ctxButton(/Implementación/));
    expect(screen.queryByText("Primera respuesta")).toBeNull();
    expect(screen.getByText("Avance global")).toBeInTheDocument();
  });
});

describe("expediente — estados de carga, vacío y acceso", () => {
  it("con el contrato todavía cargando muestra el spinner, no KPIs a medias", () => {
    state.contractsLoading = true;
    const { container } = mount();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByText("Cumplimiento SLA")).toBeNull();
    expect(screen.queryByText("Horas del mes")).toBeNull();
  });

  it("un id que no existe muestra el estado vacío con salida", async () => {
    mount("/clientes/no-existe");
    expect(await screen.findByText(/No se encontró el cliente/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a clientes" })).toBeInTheDocument();
  });

  it.each(["cliente", "colaborador"])("el rol %s queda bloqueado y no ve datos internos", (role) => {
    state.role = role;
    mount();
    expect(screen.getByText(/uso interno del equipo/)).toBeInTheDocument();
    expect(screen.queryByText("Cumplimiento SLA")).toBeNull();
    expect(screen.queryByText("Horas por especialista")).toBeNull();
    expect(screen.queryByText("Hellen Calvo")).toBeNull();
  });

  it.each(["admin", "ceo", "pm", "gerente_soporte", "csr"])("el rol %s sí entra", async (role) => {
    state.role = role;
    mount();
    expect(await screen.findByText("Cumplimiento SLA")).toBeInTheDocument();
    expect(screen.queryByText(/uso interno del equipo/)).toBeNull();
  });
});
