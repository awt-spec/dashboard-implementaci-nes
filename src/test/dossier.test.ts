import { describe, it, expect } from "vitest";
import { healthScore, toneAbove, toneBelow, toneStyles } from "@/hooks/useClientDossier";

/**
 * El spec del expediente exige que el color SIEMPRE salga del umbral del dato,
 * nunca fijo. Eso se prueba, no se mira.
 */
describe("umbrales de tono", () => {
  it("toneAbove: más alto es mejor", () => {
    expect(toneAbove(96, 90, 75)).toBe("green");
    expect(toneAbove(90, 90, 75)).toBe("green");
    expect(toneAbove(89, 90, 75)).toBe("amber");
    expect(toneAbove(74, 90, 75)).toBe("red");
  });

  it("toneBelow: más alto es peor", () => {
    expect(toneBelow(0, 0, 2)).toBe("green");
    expect(toneBelow(2, 0, 2)).toBe("amber");
    expect(toneBelow(3, 0, 2)).toBe("red");
  });

  it("cada tono mantiene chip, texto y barra coherentes", () => {
    for (const t of ["red", "amber", "green", "blue", "grey"] as const) {
      const s = toneStyles(t);
      expect(s.chip).toBeTruthy();
      expect(s.text).toBeTruthy();
      expect(s.bar).toBeTruthy();
      expect(s.dot).toBeTruthy();
    }
  });
});

describe("score de salud", () => {
  const perfecto = { compliancePct: 100, breached: 0, openCases: 10, highRisks: 0, progress: 100 };

  it("todo en verde da 100", () => {
    expect(healthScore(perfecto)).toBe(100);
  });

  it("se mantiene dentro de 0-100 en el peor caso", () => {
    const s = healthScore({ compliancePct: 0, breached: 40, openCases: 40, highRisks: 9, progress: 0 });
    expect(s).not.toBeNull();
    expect(s!).toBeGreaterThanOrEqual(0);
    expect(s!).toBeLessThanOrEqual(100);
  });

  it("cada señal empeora el score de forma independiente", () => {
    const base = healthScore(perfecto)!;
    expect(healthScore({ ...perfecto, compliancePct: 50 })!).toBeLessThan(base);
    expect(healthScore({ ...perfecto, breached: 5 })!).toBeLessThan(base);
    expect(healthScore({ ...perfecto, highRisks: 2 })!).toBeLessThan(base);
    expect(healthScore({ ...perfecto, progress: 20 })!).toBeLessThan(base);
  });

  /* Los tres casos que motivaron rehacer la fórmula. Sobre los 29 clientes
     reales, la primera versión daba 24 rojos, 0 ámbar y 5 verdes — y los 5
     verdes lo eran por NO tener un solo caso de soporte. */

  it("no tener casos con SLA no puntúa como cumplir el SLA", () => {
    const sinCasos = healthScore({ compliancePct: null, breached: 0, openCases: 0, highRisks: null, progress: 35 })!;
    const cumpliendo = healthScore({ compliancePct: 100, breached: 0, openCases: 10, highRisks: null, progress: 35 })!;
    expect(sinCasos).toBeLessThan(cumpliendo);
    // Sin señales de soporte queda el avance solo, no un 90 inventado.
    expect(sinCasos).toBe(35);
  });

  it("una señal sin dato se excluye en vez de sumar puntos gratis", () => {
    // La tabla de riesgos está vacía: si contara como 0 riesgos, regalaría sus
    // 20 puntos a todos por igual y un quinto del score sería constante.
    const conRiesgos = healthScore({ compliancePct: 60, breached: 2, openCases: 10, highRisks: 0, progress: 50 })!;
    const sinDatoDeRiesgos = healthScore({ compliancePct: 60, breached: 2, openCases: 10, highRisks: null, progress: 50 })!;
    expect(conRiesgos).not.toBe(sinDatoDeRiesgos);
  });

  it("sin ninguna señal devuelve null, no cero", () => {
    expect(healthScore({ compliancePct: null, breached: 0, openCases: 0, highRisks: null, progress: null })).toBeNull();
  });

  it("sin casos abiertos no divide por cero", () => {
    expect(() => healthScore({ ...perfecto, openCases: 0, breached: 0 })).not.toThrow();
  });
});
