import { describe, it, expect } from "vitest";
import { buildStatementKpis, type SysdeAnalytics } from "@/lib/exportAccountStatementPdf";

const an = (over: Partial<SysdeAnalytics> = {}): SysdeAnalytics => ({
  byMonth: [],
  byTipo: [],
  utilizacionPct: 50,
  runRate: 10,
  agotamientoLabel: "oct 2026",
  ...over,
});

const totals = (over: Partial<Parameters<typeof buildStatementKpis>[0]> = {}) => ({
  contracted: 100,
  consumed: 50,
  balance: 50,
  saldoActivas: 50,
  invertido: 50,
  ...over,
});

describe("buildStatementKpis", () => {
  it("arma los 4 KPIs con utilización y proyección", () => {
    const kpis = buildStatementKpis(totals(), an());
    expect(kpis.map((k) => k.label)).toEqual([
      "Horas contratadas",
      "Horas consumidas",
      "Saldo horas activas",
      "Ritmo de consumo",
    ]);
    expect(kpis[1].sub).toBe("50% de utilización");
    expect(kpis[3].value).toContain("h/mes");
    expect(kpis[3].sub).toBe("cubre hasta ~oct 2026 (estimado)");
  });

  it("sin pólizas: consumidas cae al total invertido y no muestra % de utilización", () => {
    const kpis = buildStatementKpis(totals({ contracted: 0, consumed: 0, invertido: 12 }), an({ utilizacionPct: 0 }));
    expect(kpis[1].value).toBe("12,00");
    expect(kpis[1].sub).toBeUndefined();
  });

  it("sin ritmo de consumo muestra guion y omite la proyección", () => {
    const kpis = buildStatementKpis(totals(), an({ runRate: 0, agotamientoLabel: null }));
    expect(kpis[3].value).toBe("—");
    expect(kpis[3].sub).toBeUndefined();
  });
});
