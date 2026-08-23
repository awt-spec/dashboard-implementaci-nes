import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: "admin", profile: { full_name: "Ada Lovelace" }, user: { id: "u1" }, signOut: () => {} }),
}));

/** Mock encadenable de PostgREST: todo método devuelve el mismo objeto. */
type Chain = Record<string, (...args: unknown[]) => unknown>;

const chain = (): Chain => {
  const c: Chain = {};
  ["select","insert","update","delete","upsert","eq","neq","order","limit","not","in","is","gte","lte","filter","or","match","range"]
    .forEach(m => (c[m] = () => c));
  c.maybeSingle = () => Promise.resolve({ data: null, error: null });
  c.single = () => Promise.resolve({ data: null, error: null });
  c.then = (res) => (res as (v: unknown) => unknown)({ data: [], error: null });
  return c;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => chain(),
    rpc: () => Promise.resolve({ data: [], error: null }),
    functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

import { ScrumItemCard } from "@/components/scrum/ScrumItemCard";
import { MobileResumen } from "@/components/mobile/MobileResumen";
import { MobileClientes } from "@/components/mobile/MobileClientes";
import { MobileScrum } from "@/components/mobile/MobileScrum";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";
import { visibleNav } from "@/lib/navigation";

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const ITEM: ScrumWorkItem = {
  id: "i1", source: "ticket", client_id: "aurum", client_name: "GRUPO AURUM",
  title: "Cierre contable no genera asiento", status: "PENDIENTE", priority: "Alta",
  owner: "Fernando Pinto", due_date: "2026-03-14", sprint_id: "s1",
  story_points: 5, business_value: 8, effort: 3, backlog_rank: 1,
  scrum_status: "in_progress", wsjf: 9.4, visibility: "externa",
  raw: { ticket_id: "BOL-2041", prioridad: "Alta" },
};

/**
 * El refactor de T5 reemplazó la ItemCard del teléfono por la variante
 * `compact` de un componente compartido. Estos casos fijan lo que la tarjeta
 * del teléfono TIENE que seguir mostrando, que es más que la de escritorio.
 */
describe("móvil — la tarjeta de Scrum tras unificar el componente", () => {
  it("la variante compact conserva lo que mostraba la tarjeta del teléfono", () => {
    wrap(<ScrumItemCard item={ITEM} variant="compact" />);
    expect(screen.getByText("BOL-2041")).toBeTruthy();          // id corto
    expect(screen.getByText("Externa")).toBeTruthy();            // visibilidad ESCRITA
    expect(screen.getByText("WSJF 9.4")).toBeTruthy();           // WSJF con prefijo
    expect(screen.getByText("5 SP")).toBeTruthy();
    expect(screen.getByText("Fernando P.")).toBeTruthy();        // nombre corto
    expect(screen.getByText("Soporte")).toBeTruthy();            // origen
    expect(screen.getByText(/14 mar/)).toBeTruthy();             // fecha corta
  });

  it("en escritorio la visibilidad es un punto y el WSJF va sin prefijo", () => {
    const { container } = wrap(<ScrumItemCard item={ITEM} variant="desk" />);
    expect(screen.queryByText("Externa")).toBeNull();
    expect(screen.queryByText("WSJF 9.4")).toBeNull();
    expect(screen.getByText("9.4")).toBeTruthy();
    expect(container.querySelector('[title*="Externa"]')).toBeTruthy();
  });

  it("sin responsable ni estimación no rompe ninguna de las dos variantes", () => {
    const vacio = { ...ITEM, owner: "—", story_points: null, wsjf: 0, due_date: null };
    expect(() => wrap(<ScrumItemCard item={vacio} variant="compact" />)).not.toThrow();
    expect(() => wrap(<ScrumItemCard item={vacio} variant="desk" />)).not.toThrow();
    expect(screen.getAllByText("Sin asignar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("sin estimar").length).toBeGreaterThan(0);
  });
});

describe("móvil — las pantallas siguen montando", () => {
  it("MobileResumen", () => { expect(() => wrap(<MobileResumen />)).not.toThrow(); });
  it("MobileClientes", () => { expect(() => wrap(<MobileClientes />)).not.toThrow(); });
  it("MobileScrum", () => { expect(() => wrap(<MobileScrum />)).not.toThrow(); });
  it("MobileTabBar dibuja los 5 tabs y marca el activo", () => {
    const { container } = wrap(
      <MobileTabBar activeSection="overview" onSectionChange={() => {}} items={visibleNav("admin", new Set<string>()).map(i => ({ key: i.id, label: i.shortTitle, icon: i.icon }))} />,
    );
    // La tab bar sale de la misma fuente de navegación que el sidebar: si una
    // sección desaparece de ahí, desaparece del teléfono sin avisar.
    expect(container.querySelectorAll("button").length).toBe(5);
    expect(container.querySelector('[aria-current="page"]')).toBeTruthy();
  });
});
