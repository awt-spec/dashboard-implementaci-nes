import { describe, it, expect } from "vitest";
import {
  isTicketClosed, isTicketOpen, isTaskClosed, isTaskOpen,
  normalizeTipo, normalizePrioridad,
} from "./ticketStatus";

// ─────────────────────────────────────────────────────────────────────
// Valores REALES presentes en la BD (verificados con query a producción)
// Ticket.estado: CERRADA(409), EN ATENCIÓN(54), ENTREGADA(39), ANULADA(17),
//                POR CERRAR(15), PENDIENTE(12), COTIZADA(8), APROBADA(2),
//                ON HOLD(1), VALORACIÓN(1)
// Ticket.tipo:   Requerimiento, Correccion, Consulta, Incidente, Pregunta,
//                Problema, "Critica, Impacto Negocio"
// Ticket.prioridad: Alta, Baja, Media, "Critica, Impacto Negocio"
// Task.status:   completada, en-progreso, bloqueada, pendiente
// ─────────────────────────────────────────────────────────────────────

describe("isTicketClosed", () => {
  it("reconoce los valores reales de CERRADO en la BD", () => {
    expect(isTicketClosed("CERRADA")).toBe(true);
    expect(isTicketClosed("ANULADA")).toBe(true);
  });

  it("cubre valores legacy / variantes internacionales", () => {
    expect(isTicketClosed("FINALIZADO")).toBe(true);
    expect(isTicketClosed("Cerrado")).toBe(true);
    expect(isTicketClosed("Closed")).toBe(true);
    expect(isTicketClosed("cerrada")).toBe(true);
  });

  it("retorna false para estados abiertos reales", () => {
    expect(isTicketClosed("EN ATENCIÓN")).toBe(false);
    expect(isTicketClosed("ENTREGADA")).toBe(false);
    expect(isTicketClosed("POR CERRAR")).toBe(false);
    expect(isTicketClosed("PENDIENTE")).toBe(false);
    expect(isTicketClosed("COTIZADA")).toBe(false);
    expect(isTicketClosed("APROBADA")).toBe(false);
    expect(isTicketClosed("ON HOLD")).toBe(false);
    expect(isTicketClosed("VALORACIÓN")).toBe(false);
  });

  it("maneja null/undefined/empty como abierto", () => {
    expect(isTicketClosed(null)).toBe(false);
    expect(isTicketClosed(undefined)).toBe(false);
    expect(isTicketClosed("")).toBe(false);
  });

  it("isTicketOpen es la negación", () => {
    expect(isTicketOpen("CERRADA")).toBe(false);
    expect(isTicketOpen("EN ATENCIÓN")).toBe(true);
  });
});

describe("isTaskClosed", () => {
  it("reconoce el valor canónico 'completada'", () => {
    expect(isTaskClosed("completada")).toBe(true);
  });

  it("cubre variantes", () => {
    expect(isTaskClosed("Completado")).toBe(true);
    expect(isTaskClosed("completed")).toBe(true);
    expect(isTaskClosed("Closed")).toBe(true);
  });

  it("retorna false para tareas abiertas", () => {
    expect(isTaskClosed("en-progreso")).toBe(false);
    expect(isTaskClosed("bloqueada")).toBe(false);
    expect(isTaskClosed("pendiente")).toBe(false);
  });

  it("isTaskOpen es la negación", () => {
    expect(isTaskOpen("completada")).toBe(false);
    expect(isTaskOpen("en-progreso")).toBe(true);
  });
});

describe("normalizeTipo", () => {
  it("normaliza los 7 valores reales de la BD", () => {
    expect(normalizeTipo("Requerimiento")).toBe("requerimiento");
    expect(normalizeTipo("Correccion")).toBe("correccion");
    expect(normalizeTipo("Consulta")).toBe("consulta");
    expect(normalizeTipo("Incidente")).toBe("incidente");
    expect(normalizeTipo("Pregunta")).toBe("pregunta");
    expect(normalizeTipo("Problema")).toBe("problema");
  });

  it('"Critica, Impacto Negocio" se mapea a "critico"', () => {
    expect(normalizeTipo("Critica, Impacto Negocio")).toBe("critico");
    expect(normalizeTipo("CRITICA, IMPACTO NEGOCIO")).toBe("critico");
    expect(normalizeTipo("Crítica, Impacto Negocio")).toBe("critico"); // con tilde
  });

  it("elimina acentos (NFD)", () => {
    expect(normalizeTipo("Corrección")).toBe("correccion");
  });

  it("retorna 'consulta' para null/empty (default razonable)", () => {
    expect(normalizeTipo(null)).toBe("consulta");
    expect(normalizeTipo(undefined)).toBe("consulta");
    expect(normalizeTipo("")).toBe("consulta");
  });

  it("maneja whitespace", () => {
    expect(normalizeTipo("  Incidente  ")).toBe("incidente");
  });
});

describe("normalizePrioridad", () => {
  it("normaliza los 4 valores reales de la BD", () => {
    expect(normalizePrioridad("Alta")).toBe("alta");
    expect(normalizePrioridad("Baja")).toBe("baja");
    expect(normalizePrioridad("Media")).toBe("media");
  });

  it("el caso especial 'Critica, Impacto Negocio' mapea a 'critica'", () => {
    expect(normalizePrioridad("Critica, Impacto Negocio")).toBe("critica");
    expect(normalizePrioridad("CRITICA, IMPACTO NEGOCIO")).toBe("critica");
    expect(normalizePrioridad("Crítica, Impacto Negocio")).toBe("critica");
  });

  it("reconoce 'crítica' / 'Crítica' / 'critica' como la misma cosa", () => {
    expect(normalizePrioridad("crítica")).toBe("critica");
    expect(normalizePrioridad("Crítica")).toBe("critica");
    expect(normalizePrioridad("CRITICA")).toBe("critica");
  });

  it("retorna 'media' para null/empty (default razonable)", () => {
    expect(normalizePrioridad(null)).toBe("media");
    expect(normalizePrioridad(undefined)).toBe("media");
    expect(normalizePrioridad("")).toBe("media");
  });
});

describe("matching SLA contra tickets reales", () => {
  // Simula el matching de evaluate-case-compliance con deadlines tipo v4.5
  const deadlines = [
    { case_type: "incidente",     priority: "critica", deadline_days: 1, notices: 3 },
    { case_type: "incidente",     priority: "alta",    deadline_days: 2, notices: 2 },
    { case_type: "correccion",    priority: "alta",    deadline_days: 3, notices: 2 },
    { case_type: "correccion",    priority: "media",   deadline_days: 5, notices: 2 },
    { case_type: "requerimiento", priority: "media",   deadline_days: 10, notices: 1 },
    { case_type: "consulta",      priority: "baja",    deadline_days: 5, notices: 1 },
  ];

  function matchSla(tipo: string | null, prioridad: string | null) {
    const caseType = normalizeTipo(tipo);
    const priority = normalizePrioridad(prioridad);
    return (
      deadlines.find(d => d.case_type === caseType && d.priority === priority) ||
      deadlines.find(d => d.priority === priority) ||
      null
    );
  }

  it("ticket Incidente × Critica, Impacto Negocio → deadline 1 día", () => {
    const m = matchSla("Incidente", "Critica, Impacto Negocio");
    expect(m).not.toBeNull();
    expect(m!.deadline_days).toBe(1);
  });

  it("ticket Correccion × Alta → deadline 3 días (match exacto)", () => {
    const m = matchSla("Correccion", "Alta");
    expect(m!.deadline_days).toBe(3);
  });

  it("ticket Requerimiento × Media → deadline 10 días", () => {
    const m = matchSla("Requerimiento", "Media");
    expect(m!.deadline_days).toBe(10);
  });

  it("ticket Problema × Alta cae al fallback por priority (no hay match exacto)", () => {
    // No hay regla para (problema, alta). Debe caer al primer deadline con priority=alta.
    const m = matchSla("Problema", "Alta");
    expect(m!.priority).toBe("alta");
  });

  it("regresión del Bug #1: un ticket con campos reales NUNCA cae al default '(consulta, media)'", () => {
    // Antes del fix: ticket.case_type undefined → siempre 'consulta', y ticket.priority undefined → siempre 'media'.
    // Ahora debe devolver un match razonable para cada combinación real.
    const realCombos: Array<[string, string, string]> = [
      ["Requerimiento", "Alta", "alta"],
      ["Correccion", "Media", "media"],
      ["Incidente", "Critica, Impacto Negocio", "critica"],
      ["Pregunta", "Baja", "baja"],
    ];
    for (const [tipo, prio, expectedPriority] of realCombos) {
      const m = matchSla(tipo, prio);
      expect(m, `tipo=${tipo} prio=${prio}`).not.toBeNull();
      expect(m!.priority).toBe(expectedPriority);
    }
  });
});
