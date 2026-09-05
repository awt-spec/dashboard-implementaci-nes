/**
 * El tiempo facturable se mudó de support_tickets a support_ticket_time
 * (migraciones 20260905120000 / 20260905130000), porque RLS es por fila y la
 * política del cliente le entregaba la fila completa.
 *
 * Estas pruebas cubren las tres cosas que podrían romperse en silencio:
 *   • que el staff pida el tiempo (si el select pierde el embed, todo el lado
 *     interno muestra 0 y nadie ve un error)
 *   • que el embed se aplane a la forma de siempre, venga como objeto o arreglo
 *   • que al escribir, los minutos vayan a la tabla nueva y NO a support_tickets,
 *     que ya no tiene esas columnas y devolvería 400
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

type Sel = { tabla: string; select?: string };
const estado = {
  selects: [] as Sel[],
  escrituras: [] as { tabla: string; op: string; payload: unknown }[],
  filas: [] as Record<string, unknown>[],
  rol: "admin" as string,
};

function cadena(tabla: string) {
  const c: Record<string, unknown> = {};
  const res = { data: estado.filas, error: null, count: estado.filas.length };
  for (const m of ["order", "range", "eq", "in", "limit", "neq"]) c[m] = () => c;
  c.select = (cols?: string) => { estado.selects.push({ tabla, select: cols }); return c; };
  c.update = (payload: unknown) => { estado.escrituras.push({ tabla, op: "update", payload }); return c; };
  c.upsert = (payload: unknown) => { estado.escrituras.push({ tabla, op: "upsert", payload }); return Promise.resolve({ data: null, error: null }); };
  c.insert = (payload: unknown) => { estado.escrituras.push({ tabla, op: "insert", payload }); return Promise.resolve({ data: null, error: null }); };
  c.maybeSingle = () => Promise.resolve({ data: estado.filas[0] ?? null, error: null });
  c.then = (ok: (r: typeof res) => unknown) => ok(res);
  return c;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => cadena(t) },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: estado.rol }) }));

import { useSupportTickets, useUpdateSupportTicket } from "@/hooks/useSupportTickets";

const envoltura = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
};

const caso = (extra: Record<string, unknown> = {}) => ({
  id: "t1", client_id: "cmi", ticket_id: "SVA-1", asunto: "Caso",
  estado: "EN ATENCIÓN", case_agreements: [], case_actions: [], ...extra,
});

beforeEach(() => {
  estado.selects = []; estado.escrituras = []; estado.filas = []; estado.rol = "admin";
});

describe("el staff sigue viendo el tiempo tras la mudanza", () => {
  it("pide support_ticket_time embebido, no las columnas viejas", async () => {
    estado.filas = [caso({ support_ticket_time: { tiempo_consumido_minutos: 120, tiempo_cobrado_minutos: 90 } })];
    const { result } = renderHook(() => useSupportTickets("cmi"), { wrapper: envoltura() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const sel = estado.selects.find(s => s.tabla === "support_tickets")?.select ?? "";
    expect(sel).toContain("support_ticket_time(");
    // Las columnas viejas ya no existen en support_tickets; pedirlas daría 400.
    // Se mira sólo el nivel de arriba: dentro del paréntesis del embebido esos
    // mismos nombres sí van, y son los correctos.
    const nivelDeArriba = sel.replace(/\([^)]*\)/g, "");
    expect(nivelDeArriba).not.toContain("tiempo_cobrado_minutos");
    expect(nivelDeArriba).not.toContain("tiempo_consumido_minutos");
  });

  it("aplana el embebido a la forma de siempre", async () => {
    estado.filas = [caso({ support_ticket_time: { tiempo_consumido_minutos: 120, tiempo_cobrado_minutos: 90 } })];
    const { result } = renderHook(() => useSupportTickets("cmi"), { wrapper: envoltura() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const t = result.current.data![0];
    expect(t.tiempo_consumido_minutos).toBe(120);
    expect(t.tiempo_cobrado_minutos).toBe(90);
    // el anidado no debe sobrevivir: los consumidores leen ticket.tiempo_*
    expect((t as unknown as Record<string, unknown>).support_ticket_time).toBeUndefined();
  });

  it("acepta el embebido como arreglo (PostgREST no siempre prueba que es 1:1)", async () => {
    estado.filas = [caso({ support_ticket_time: [{ tiempo_consumido_minutos: 30, tiempo_cobrado_minutos: 15 }] })];
    const { result } = renderHook(() => useSupportTickets("cmi"), { wrapper: envoltura() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].tiempo_cobrado_minutos).toBe(15);
  });

  it("sin embebido queda en 0, no en undefined", async () => {
    estado.filas = [caso()];
    const { result } = renderHook(() => useSupportTickets("cmi"), { wrapper: envoltura() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].tiempo_cobrado_minutos).toBe(0);
  });
});

describe("el cliente no pide el tiempo", () => {
  it("su select no lleva el embebido", async () => {
    estado.rol = "cliente";
    estado.filas = [caso()];
    const { result } = renderHook(() => useSupportTickets("cmi"), { wrapper: envoltura() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const sel = estado.selects.find(s => s.tabla === "support_tickets")?.select ?? "";
    expect(sel).not.toContain("support_ticket_time");
    expect(sel).not.toContain("tiempo_");
  });
});

describe("al escribir, los minutos van a la tabla nueva", () => {
  it("el cronómetro escribe support_ticket_time y NO support_tickets", async () => {
    const { result } = renderHook(() => useUpdateSupportTicket(), { wrapper: envoltura() });
    await result.current.mutateAsync({ id: "t1", updates: { tiempo_consumido_minutos: 135 } });
    const tablas = estado.escrituras.map(e => e.tabla);
    expect(tablas).toContain("support_ticket_time");
    expect(tablas).not.toContain("support_tickets");
    expect(estado.escrituras[0].payload).toMatchObject({ ticket_id: "t1", tiempo_consumido_minutos: 135 });
  });

  it("un cambio mixto se reparte: cada campo a su tabla", async () => {
    const { result } = renderHook(() => useUpdateSupportTicket(), { wrapper: envoltura() });
    await result.current.mutateAsync({
      id: "t1",
      updates: { estado: "CERRADA", tiempo_cobrado_minutos: 60 },
    });
    const aTiempo = estado.escrituras.find(e => e.tabla === "support_ticket_time");
    const aCaso = estado.escrituras.find(e => e.tabla === "support_tickets");
    expect(aTiempo?.payload).toMatchObject({ tiempo_cobrado_minutos: 60 });
    expect(aCaso?.payload).toEqual({ estado: "CERRADA" });
    // el caso no debe recibir los minutos: esa columna ya no existe
    expect(aCaso?.payload).not.toHaveProperty("tiempo_cobrado_minutos");
  });

  it("un cambio sin minutos no toca la tabla de tiempo", async () => {
    const { result } = renderHook(() => useUpdateSupportTicket(), { wrapper: envoltura() });
    await result.current.mutateAsync({ id: "t1", updates: { estado: "CERRADA" } });
    expect(estado.escrituras.map(e => e.tabla)).toEqual(["support_tickets"]);
  });
});
