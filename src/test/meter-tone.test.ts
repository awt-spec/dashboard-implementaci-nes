import { describe, it, expect } from "vitest";
import { meterTone } from "@/lib/meterTone";

/**
 * §9 pide explícitamente que "el color sale del umbral, no fijo". Un medidor
 * que se pinta siempre igual pasa desapercibido justo cuando importa, así que
 * el umbral se prueba en vez de confiar en la inspección visual.
 */
describe("meterTone", () => {
  it("sube de verde a ámbar y a rojo cuando más alto es mejor", () => {
    expect(meterTone(96, true).bar).toBe("bg-success");
    expect(meterTone(90, true).bar).toBe("bg-success");
    expect(meterTone(89, true).bar).toBe("bg-warning");
    expect(meterTone(70, true).bar).toBe("bg-warning");
    expect(meterTone(69, true).bar).toBe("bg-destructive");
    expect(meterTone(40, true).bar).toBe("bg-destructive");
  });

  it("invierte la escala cuando subir es malo (horas consumidas)", () => {
    // Consumir el 5% del contrato está bien; consumir el 95% no.
    expect(meterTone(5, false).bar).toBe("bg-success");
    expect(meterTone(30, false).bar).toBe("bg-warning");
    expect(meterTone(95, false).bar).toBe("bg-destructive");
  });

  it("sin dato no es un resultado: no pinta ni alarma ni visto bueno", () => {
    // El bug que esto cubre: "sin casos con SLA" caía en pct=0 y salía ROJO,
    // y "sin horas de contrato" salía VERDE por la escala invertida.
    for (const higherIsBetter of [true, false]) {
      const t = meterTone(null, higherIsBetter);
      expect(t.bar).not.toContain("destructive");
      expect(t.bar).not.toContain("success");
      expect(t.bar).not.toContain("warning");
      expect(t.text).toBe("text-muted-foreground");
    }
  });

  it("mantiene el texto y la barra en el mismo tono", () => {
    for (const pct of [0, 25, 50, 75, 100]) {
      const t = meterTone(pct, true);
      expect(t.text.replace("text-", "")).toBe(t.bar.replace("bg-", ""));
    }
  });
});
