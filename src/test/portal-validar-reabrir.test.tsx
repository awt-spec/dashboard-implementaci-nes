/**
 * Validar y Reabrir en el portal del cliente.
 *
 * Sobre support_tickets el rol cliente sólo tiene políticas de SELECT e
 * INSERT: el UPDATE que hacían estos botones no afectaba ninguna fila y
 * Postgres no da error por eso, así que el botón cantaba éxito y el caso
 * seguía igual. Ahora el cliente va por la RPC cliente_cambiar_estado_caso y
 * el staff sigue por el UPDATE, que sí tiene permitido.
 *
 * Lo que se cubre es justamente lo que se rompería en silencio: que cada rol
 * use la puerta que le corresponde, y que un error de la RPC llegue al usuario
 * en vez de perderse.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const rolActual = { valor: "cliente" };
const filas = { valor: [] as Record<string, unknown>[] };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: rolActual.valor, user: { id: "u1" }, profile: null, loading: false }),
}));

const estado = {
  rpc: [] as { nombre: string; args: unknown }[],
  updates: [] as { tabla: string; payload: unknown }[],
  errorRpc: null as { message: string } | null,
};

function cadena(tabla: string) {
  const c: Record<string, unknown> = {};
  for (const m of ["order", "range", "eq", "neq", "in", "limit", "select", "not", "is",
                   "gt", "gte", "lt", "lte", "filter", "or", "match", "ilike", "like",
                   "contains", "overlaps", "abortSignal", "throwOnError"]) c[m] = () => c;
  c.update = (payload: unknown) => { estado.updates.push({ tabla, payload }); return c; };
  c.upsert = () => Promise.resolve({ data: null, error: null });
  c.maybeSingle = () => Promise.resolve({ data: { id: "t1" }, error: null });
  const datos = tabla === "support_tickets" ? filas.valor : [];
  c.then = (ok: (r: unknown) => unknown) => ok({ data: datos, error: null, count: datos.length });
  return c;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => cadena(t),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    rpc: (nombre: string, args: unknown) => {
      estado.rpc.push({ nombre, args });
      return Promise.resolve({ data: null, error: estado.errorRpc });
    },
  },
}));

import { useClienteCambiarEstado, useUpdateSupportTicket } from "@/hooks/useSupportTickets";

const envoltura = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
};

beforeEach(() => { estado.rpc = []; estado.updates = []; estado.errorRpc = null; });

describe("el cliente valida y reabre por la RPC", () => {
  it("validar llama a la RPC con el estado CERRADA", async () => {
    const { result } = renderHook(() => useClienteCambiarEstado(), { wrapper: envoltura() });
    await result.current.mutateAsync({ ticketId: "t1", nuevoEstado: "CERRADA" });
    expect(estado.rpc).toHaveLength(1);
    expect(estado.rpc[0].nombre).toBe("cliente_cambiar_estado_caso");
    expect(estado.rpc[0].args).toMatchObject({ _ticket_id: "t1", _nuevo_estado: "CERRADA" });
  });

  it("reabrir llama a la RPC con EN ATENCIÓN", async () => {
    const { result } = renderHook(() => useClienteCambiarEstado(), { wrapper: envoltura() });
    await result.current.mutateAsync({ ticketId: "t9", nuevoEstado: "EN ATENCIÓN" });
    expect(estado.rpc[0].args).toMatchObject({ _nuevo_estado: "EN ATENCIÓN" });
  });

  it("NO toca support_tickets: ahí el cliente no tiene permiso de UPDATE", async () => {
    const { result } = renderHook(() => useClienteCambiarEstado(), { wrapper: envoltura() });
    await result.current.mutateAsync({ ticketId: "t1", nuevoEstado: "CERRADA" });
    expect(estado.updates).toHaveLength(0);
  });

  it("un error de la RPC se propaga — no puede quedar en un éxito falso", async () => {
    estado.errorRpc = { message: "Tu usuario no tiene permiso de edición sobre este caso" };
    const { result } = renderHook(() => useClienteCambiarEstado(), { wrapper: envoltura() });
    await expect(
      result.current.mutateAsync({ ticketId: "t1", nuevoEstado: "CERRADA" }),
    ).rejects.toThrow(/permiso de edición/);
  });

  it("pasa el motivo cuando se le da, y null cuando no", async () => {
    const { result } = renderHook(() => useClienteCambiarEstado(), { wrapper: envoltura() });
    await result.current.mutateAsync({ ticketId: "t1", nuevoEstado: "EN ATENCIÓN", motivo: "Sigue fallando" });
    expect(estado.rpc[0].args).toMatchObject({ _motivo: "Sigue fallando" });
    await result.current.mutateAsync({ ticketId: "t1", nuevoEstado: "CERRADA" });
    expect(estado.rpc[1].args).toMatchObject({ _motivo: null });
  });
});

describe("el staff sigue por el UPDATE, que sí tiene permitido", () => {
  it("cambiar estado como staff escribe support_tickets y no llama a la RPC", async () => {
    const { result } = renderHook(() => useUpdateSupportTicket(), { wrapper: envoltura() });
    await result.current.mutateAsync({ id: "t1", updates: { estado: "CERRADA" } });
    expect(estado.updates.map(u => u.tabla)).toEqual(["support_tickets"]);
    expect(estado.rpc).toHaveLength(0);
  });
});

/**
 * Lo de arriba prueba los hooks. Lo que sigue prueba el enrutado real dentro
 * del componente —`isStaff ? update : rpc`—, que es donde estaba el bug: los
 * dos botones llamaban al UPDATE para todo el mundo.
 */
import { render, screen, fireEvent, waitFor as waitFor2 } from "@testing-library/react";
import { GerenteSupportDashboard } from "@/components/dashboard/GerenteSupportDashboard";

const CASO_ENTREGADO = {
  id: "t-entregado", client_id: "cmi", ticket_id: "SVA-77", asunto: "Entregado, esperando validación",
  producto: "Arrendamiento", tipo: "Incidente", prioridad: "Alta", estado: "ENTREGADA",
  fecha_registro: "2026-09-01T00:00:00Z", fecha_entrega: "2026-09-03T00:00:00Z",
  dias_antiguedad: 4, responsable: "Hellen Calvo", ai_summary: null, notas: null,
  case_agreements: [], case_actions: [], created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-03T00:00:00Z",
};

/**
 * La tarjeta de Validar/Reabrir vive en la pestaña "Abiertos", no en "Resumen".
 * Radix activa la pestaña en mousedown: con fireEvent.click sola no cambia y la
 * prueba fallaba por no encontrar los botones, no por el enrutado.
 */
const abrirPestanaAbiertos = async () => {
  const pestana = await screen.findByRole("tab", { name: /Abiertos/i });
  fireEvent.mouseDown(pestana);
  fireEvent.click(pestana);
  await screen.findByRole("button", { name: /Validar/i });
};

/**
 * El componente dispara otras RPC al montar (contract_coverage_for, SLA…), así
 * que no sirve mirar rpc[0]: hay que buscar la llamada por nombre.
 */
const llamadasAlCambioDeEstado = () =>
  estado.rpc.filter(r => r.nombre === "cliente_cambiar_estado_caso");

const pintar = (rol: string) => {
  rolActual.valor = rol;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GerenteSupportDashboard client={{ id: "cmi", name: "CMI Arrendamiento" } as never} />
    </QueryClientProvider>,
  );
};

describe("los botones del portal usan la puerta que corresponde a cada rol", () => {
  beforeEach(() => { filas.valor = [CASO_ENTREGADO]; });

  it("como CLIENTE, Validar llama a la RPC y no toca la tabla", async () => {
    pintar("cliente");
    await abrirPestanaAbiertos();
    const boton = await screen.findByRole("button", { name: /Validar/i });
    fireEvent.click(boton);
    await waitFor2(() => expect(llamadasAlCambioDeEstado()).toHaveLength(1));
    expect(llamadasAlCambioDeEstado()[0].args).toMatchObject({ _nuevo_estado: "CERRADA" });
    expect(estado.updates).toHaveLength(0);
  });

  it("como CLIENTE, Reabrir llama a la RPC con EN ATENCIÓN", async () => {
    pintar("cliente");
    await abrirPestanaAbiertos();
    const boton = await screen.findByRole("button", { name: /Reabrir/i });
    fireEvent.click(boton);
    await waitFor2(() => expect(llamadasAlCambioDeEstado()).toHaveLength(1));
    expect(llamadasAlCambioDeEstado()[0].args).toMatchObject({ _nuevo_estado: "EN ATENCIÓN" });
  });

  it("como STAFF, Validar escribe la tabla y no llama a la RPC", async () => {
    pintar("gerente_soporte");
    await abrirPestanaAbiertos();
    const boton = await screen.findByRole("button", { name: /Validar/i });
    fireEvent.click(boton);
    await waitFor2(() => expect(estado.updates).toHaveLength(1));
    expect(estado.updates[0].tabla).toBe("support_tickets");
    expect(llamadasAlCambioDeEstado()).toHaveLength(0);
  });
});
