import { describe, it, expect } from "vitest";
import { prioridadRank, compararCasosPorUrgencia } from "@/lib/ticketStatus";

// Los dos formularios guardan formas distintas del mismo valor: el del cliente
// escribe "Critica, Impacto Negocio" y el interno "critica". Si el orden se
// hiciera sobre el texto crudo, un crítico del cliente y uno interno caerían
// en posiciones distintas.
describe("prioridadRank", () => {
  it("ordena critica < alta < media < baja", () => {
    expect(prioridadRank("critica")).toBeLessThan(prioridadRank("alta"));
    expect(prioridadRank("alta")).toBeLessThan(prioridadRank("media"));
    expect(prioridadRank("media")).toBeLessThan(prioridadRank("baja"));
  });

  it("empareja las dos formas de crítica que guardan los formularios", () => {
    const canonico = prioridadRank("Critica, Impacto Negocio");
    expect(prioridadRank("critica")).toBe(canonico);
    expect(prioridadRank("Crítica")).toBe(canonico);
    expect(canonico).toBe(0);
  });

  it("es insensible a mayúsculas y acentos", () => {
    expect(prioridadRank("ALTA")).toBe(prioridadRank("alta"));
    expect(prioridadRank("Media")).toBe(prioridadRank("media"));
  });

  it("una prioridad vacía cuenta como media, no como crítica", () => {
    expect(prioridadRank(null)).toBe(prioridadRank("media"));
    expect(prioridadRank(undefined)).toBe(prioridadRank("media"));
    expect(prioridadRank("")).toBe(prioridadRank("media"));
  });

  it("lo sin clasificar y lo desconocido van al final", () => {
    expect(prioridadRank("pendiente")).toBeGreaterThan(prioridadRank("baja"));
    expect(prioridadRank("cualquier cosa")).toBeGreaterThan(prioridadRank("baja"));
  });
});

// El orden real de la tabla: prioridad y, dentro de la misma, lo más viejo
// arriba. El caso que motivó el cambio es la primera fila.
describe("orden de la tabla del portal", () => {
  type Caso = { ticket_id: string; prioridad: string | null; dias_antiguedad: number };
  // El mismo comparador que usa la tabla, no una copia.
  const ordenar = (casos: Caso[]) =>
    [...casos].sort(compararCasosPorUrgencia).map(c => c.ticket_id);

  const casos: Caso[] = [
    { ticket_id: "VIEJO-BAJA",   prioridad: "Baja",  dias_antiguedad: 300 },
    { ticket_id: "VIEJO-MEDIA",  prioridad: "Media", dias_antiguedad: 200 },
    { ticket_id: "NUEVO-CRIT",   prioridad: "Critica, Impacto Negocio", dias_antiguedad: 0 },
    { ticket_id: "VIEJO-ALTA",   prioridad: "Alta",  dias_antiguedad: 120 },
    { ticket_id: "MENOS-VIEJO-MEDIA", prioridad: "media", dias_antiguedad: 20 },
  ];

  it("el crítico recién abierto encabeza aunque sea el más nuevo", () => {
    expect(ordenar(casos)[0]).toBe("NUEVO-CRIT");
  });

  it("dentro de la misma prioridad manda la antigüedad", () => {
    const orden = ordenar(casos);
    expect(orden.indexOf("VIEJO-MEDIA")).toBeLessThan(orden.indexOf("MENOS-VIEJO-MEDIA"));
  });

  it("el orden completo es el esperado", () => {
    expect(ordenar(casos)).toEqual([
      "NUEVO-CRIT", "VIEJO-ALTA", "VIEJO-MEDIA", "MENOS-VIEJO-MEDIA", "VIEJO-BAJA",
    ]);
  });

  // Control negativo: con el orden anterior (solo antigüedad) estas mismas
  // aserciones tienen que fallar. Si pasaran, la prueba no probaría nada.
  it("el orden anterior, solo por antigüedad, hundía el crítico", () => {
    const soloAntiguedad = [...casos]
      .sort((a, b) => (b.dias_antiguedad ?? 0) - (a.dias_antiguedad ?? 0))
      .map(c => c.ticket_id);
    expect(soloAntiguedad[0]).toBe("VIEJO-BAJA");
    expect(soloAntiguedad[soloAntiguedad.length - 1]).toBe("NUEVO-CRIT");
  });
});
