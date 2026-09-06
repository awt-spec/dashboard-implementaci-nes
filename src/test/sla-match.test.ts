/**
 * El plazo de SLA lo calcula el SQL (get_tickets_sla_status) y la pantalla lo
 * explica. Si las dos no cruzan igual, la base marca "vencido" con un plazo y
 * la explicación muestra otro.
 *
 * La tabla de paridad de abajo no se escribió a mano: cada fila se corrió
 * contra la función sla_norm() real, extraída de su migración, en un Postgres
 * 16. Las dos filas marcadas `soloSQL` son la única divergencia conocida —el
 * SQL compara con LIKE, donde % y _ son comodines— y están acá justamente
 * para que quede escrita y no se descubra de nuevo dentro de un año.
 */
import { describe, it, expect } from "vitest";
import { slaNorm } from "@/lib/ticketStatus";
import { matchDeadline, type Deadline } from "@/lib/slaMatch";

const PARIDAD: Array<[caso: string, regla: string, sql: boolean, soloSQL?: true]> = [
  ["Critica, Impacto Negocio", "Crítica", true],
  ["Critica, Impacto Negocio", "Critica", true],
  ["Critica, Impacto Negocio", "critica", true],
  ["Critica, Impacto Negocio", "CRÍTICA", true],
  ["Alta", "Alta", true],
  ["Alta", "alta", true],
  ["Alta", "Álta", true],
  ["Media", "media", true],
  ["Baja", "baja", true],
  ["Alta", "Media", false],
  ["", "alta", false],
  ["Alta", "", true],
  ["Niño", "nino", true],
  ["Señal", "senal", true],
  ["Corrección", "correccion", true],
  ["Alta", "alta ", false],
  ["  Alta  ", "alta", true],
  ["Requerimiento", "requerimiento", true],
  ["Alta", "al_a", true, true],
  ["Alta", "a%a", true, true],
];

describe("slaNorm espeja a sla_norm() de la base", () => {
  it.each(PARIDAD.filter(f => !f[3]))(
    'caso "%s" contra regla "%s" → %s, igual que el SQL',
    (caso, regla, esperado) => {
      expect(slaNorm(caso).includes(slaNorm(regla))).toBe(esperado);
    },
  );

  it("no hace trim: una regla con espacio final no cruza, igual que el SQL", () => {
    // norm() de ticketStatus sí recorta, y usarla acá desalineaba el frontend
    // de la base. Se comprobó contra Postgres.
    expect(slaNorm("alta ")).toBe("alta ");
    expect(slaNorm("Alta").includes(slaNorm("alta "))).toBe(false);
  });

  it.each(PARIDAD.filter(f => f[3]))(
    'DIVERGENCIA CONOCIDA: "%s" contra "%s" cruza en SQL (comodín de LIKE) y no acá',
    (caso, regla) => {
      expect(slaNorm(caso).includes(slaNorm(regla))).toBe(false);
    },
  );
});

// Réplica de la política v4.5 sembrada por 20260428160000.
const POLITICA: Deadline[] = [
  { case_type: "correccion",    priority: "critica", deadline_days: 1 },
  { case_type: "correccion",    priority: "alta",    deadline_days: 3 },
  { case_type: "correccion",    priority: "media",   deadline_days: 5 },
  { case_type: "correccion",    priority: "baja",    deadline_days: 10 },
  { case_type: "requerimiento", priority: "critica", deadline_days: 2 },
  { case_type: "requerimiento", priority: "alta",    deadline_days: 5 },
];

describe("matchDeadline sigue el mismo orden que el SQL", () => {
  it("prioridad y tipo juntos ganan", () => {
    const m = matchDeadline(POLITICA, { prioridad: "Critica, Impacto Negocio", tipo: "Correccion" });
    expect(m).toMatchObject({ deadline_days: 1, matchType: "priority+type" });
  });

  it("un caso crítico NO cae al plazo de media — que era el bug", () => {
    const m = matchDeadline(POLITICA, { prioridad: "Critica, Impacto Negocio", tipo: "Otro" });
    expect(m?.matchType).toBe("priority-only");
    expect(m?.deadline_days).toBe(1);
  });

  it("con una regla acentuada, que antes no cruzaba en pantalla", () => {
    const conTilde: Deadline[] = [{ priority: "Crítica", deadline_days: 1 }, { priority: "media", deadline_days: 5 }];
    const m = matchDeadline(conTilde, { prioridad: "Critica, Impacto Negocio", tipo: "correccion" });
    expect(m?.deadline_days).toBe(1);      // antes daba 5, el respaldo de "media"
    expect(m?.matchType).toBe("priority-only");
  });

  it("con prioridad sola gana el plazo más corto", () => {
    const m = matchDeadline(POLITICA, { prioridad: "Alta", tipo: "inexistente" });
    expect(m?.deadline_days).toBe(3);
  });

  it("si sólo cruza el tipo, usa esa regla", () => {
    const m = matchDeadline(POLITICA, { prioridad: "inventada", tipo: "requerimiento" });
    expect(m?.matchType).toBe("type-only");
  });

  it("sin nada que cruce, cae al respaldo de media", () => {
    const m = matchDeadline(POLITICA, { prioridad: "inventada", tipo: "inventado" });
    expect(m).toMatchObject({ deadline_days: 5, matchType: "fallback" });
  });

  it("sin reglas, no inventa un plazo", () => {
    expect(matchDeadline([], { prioridad: "Alta", tipo: "correccion" })).toBeNull();
    expect(matchDeadline(null, { prioridad: "Alta", tipo: "correccion" })).toBeNull();
  });
});
