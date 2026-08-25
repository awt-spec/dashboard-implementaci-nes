import { describe, it, expect } from "vitest";
import { summarizeSla, formatCutoff, type SlaCaseRow, type SlaLevel } from "@/hooks/useSlaCompliance";

/**
 * La regla del corte (migración 20260825140000): el inventario cuenta todo lo
 * abierto, el porcentaje sólo lo registrado desde el 1 de septiembre.
 *
 * Se prueba porque el modo de falla es silencioso: si los 293 casos viejos
 * vuelven a colarse al denominador, la pantalla no se rompe — simplemente
 * muestra 0% para siempre y nadie sabe por qué.
 */
function row(level: SlaLevel, inScope: boolean, i = 0, registeredLate = false): SlaCaseRow {
  return {
    ticket: { id: `t${i}` } as SlaCaseRow["ticket"],
    priorityLevel: "Alta",
    slaSource: "contrato",
    elapsedHours: 10,
    limitHours: 24,
    pct: 42,
    level,
    inScope,
    registeredLate,
  };
}

describe("resumen de SLA con fecha de corte", () => {
  it("el inventario cuenta todo; el porcentaje sólo lo posterior al corte", () => {
    const rows = [
      row("breached", false, 1),
      row("breached", false, 2),
      row("breached", true, 3),
      row("on_track", true, 4),
      row("on_track", true, 5),
    ];
    const s = summarizeSla(rows, 0);

    expect(s.withSla).toBe(5);
    expect(s.breached).toBe(3);
    expect(s.measured).toBe(3);
    expect(s.measuredBreached).toBe(1);
    // 2 de 3 medidos dentro del SLA, no 2 de 5.
    expect(s.compliancePct).toBe(67);
  });

  it("sin casos posteriores al corte devuelve null, nunca 0", () => {
    const s = summarizeSla([row("breached", false, 1), row("breached", false, 2)], 0);
    expect(s.breached).toBe(2);
    expect(s.measured).toBe(0);
    // Éste es el punto de todo el cambio: 0% acusa, null explica.
    expect(s.compliancePct).toBeNull();
  });

  it("el escenario real de agosto 2026: 293 vencidos viejos, nada medido", () => {
    const rows = Array.from({ length: 293 }, (_, i) => row("breached", false, i));
    const s = summarizeSla(rows, 2);
    expect(s.breached).toBe(293);
    expect(s.compliancePct).toBeNull();
    expect(s.sinSla).toBe(2);
  });

  it("un solo caso nuevo cumplido da 100%, aunque haya 293 viejos rotos", () => {
    const rows = [
      ...Array.from({ length: 293 }, (_, i) => row("breached", false, i)),
      row("on_track", true, 999),
    ];
    const s = summarizeSla(rows, 0);
    expect(s.measured).toBe(1);
    expect(s.compliancePct).toBe(100);
    // Y el inventario sigue diciendo la verdad incómoda.
    expect(s.breached).toBe(293);
  });

  it("los casos en riesgo medidos no descuentan: sólo cuenta el incumplido", () => {
    const s = summarizeSla([row("at_risk", true, 1), row("on_track", true, 2)], 0);
    expect(s.atRisk).toBe(1);
    expect(s.compliancePct).toBe(100);
  });

  it("sin filas devuelve null y ceros", () => {
    const s = summarizeSla([], 0);
    expect(s).toEqual({
      withSla: 0, breached: 0, atRisk: 0, onTrack: 0, sinSla: 0,
      measured: 0, measuredBreached: 0, compliancePct: null, registeredLate: 0,
    });
  });

  it("cuenta los cargados tarde sin meterlos en la medición", () => {
    const rows = [
      row("breached", false, 1, true),   // retrodatado: fuera del cociente
      row("breached", false, 2, true),
      row("breached", false, 3),        // viejo de verdad, cargado antes del corte
      row("on_track", true, 4),
    ];
    const s = summarizeSla(rows, 0);
    expect(s.registeredLate).toBe(2);
    expect(s.measured).toBe(1);
    // Los retrodatados no tocan el porcentaje: siguen contando como vencidos
    // en el inventario, que es donde deben verse.
    expect(s.compliancePct).toBe(100);
    expect(s.breached).toBe(3);
  });
});

describe("formato de la fecha de corte", () => {
  it("rinde la fecha que devuelve la base", () => {
    // 06:00Z = 00:00 en Costa Rica, que es como la define sla_measurement_start().
    expect(formatCutoff("2026-09-01T06:00:00+00:00")).toMatch(/2026/);
  });

  it("aguanta null y basura sin reventar la pantalla", () => {
    expect(formatCutoff(null)).toBeNull();
    expect(formatCutoff("no soy una fecha")).toBeNull();
  });
});
