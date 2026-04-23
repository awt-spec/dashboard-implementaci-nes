import { describe, it, expect } from "vitest";
import { toCsv, csvDate, safeFilename, type CsvColumn } from "./exportCsv";

interface Ticket {
  id: string;
  asunto: string;
  prioridad: string;
  created_at: string | null;
}

const cols: CsvColumn<Ticket>[] = [
  { key: "id",       header: "ID",       get: t => t.id },
  { key: "asunto",   header: "Asunto",   get: t => t.asunto },
  { key: "prio",     header: "Prioridad", get: t => t.prioridad },
  { key: "created",  header: "Creado",   get: t => csvDate(t.created_at) },
];

describe("toCsv", () => {
  it("genera header y una fila simple", () => {
    const csv = toCsv([{ id: "1", asunto: "Test", prioridad: "Alta", created_at: null }], cols);
    expect(csv.split("\n")[0]).toBe("ID,Asunto,Prioridad,Creado");
    expect(csv.split("\n")[1]).toBe("1,Test,Alta,");
  });

  it("escapa valores con coma", () => {
    const csv = toCsv(
      [{ id: "1", asunto: "Hola, mundo", prioridad: "Alta", created_at: null }],
      cols
    );
    expect(csv).toContain('"Hola, mundo"');
  });

  it("escapa valores con comillas dobles", () => {
    const csv = toCsv(
      [{ id: "1", asunto: 'Dijo "hola"', prioridad: "Alta", created_at: null }],
      cols
    );
    expect(csv).toContain('"Dijo ""hola"""');
  });

  it("escapa saltos de línea", () => {
    const csv = toCsv(
      [{ id: "1", asunto: "línea 1\nlínea 2", prioridad: "Alta", created_at: null }],
      cols
    );
    expect(csv).toContain('"línea 1\nlínea 2"');
  });

  it("maneja null/undefined como string vacío", () => {
    const csv = toCsv(
      [{ id: "1", asunto: null as any, prioridad: undefined as any, created_at: null }],
      cols
    );
    expect(csv.split("\n")[1]).toBe("1,,,");
  });

  it("mantiene el orden de columnas", () => {
    const csv = toCsv(
      [{ id: "a", asunto: "b", prioridad: "c", created_at: null }],
      cols
    );
    expect(csv.split("\n")[1]).toBe("a,b,c,");
  });
});

describe("csvDate", () => {
  it("formatea ISO a YYYY-MM-DD HH:mm", () => {
    expect(csvDate("2026-04-22T14:30:00Z")).toMatch(/^2026-04-22 \d{2}:\d{2}$/);
  });

  it("retorna vacío para null/undefined/inválido", () => {
    expect(csvDate(null)).toBe("");
    expect(csvDate(undefined)).toBe("");
    expect(csvDate("no-es-fecha")).toBe("");
  });
});

describe("safeFilename", () => {
  it("remueve acentos y espacios", () => {
    expect(safeFilename("Banco de Bogotá")).toBe("banco_de_bogota");
  });

  it("colapsa múltiples guiones bajos", () => {
    expect(safeFilename("AFP    Atlántico!!!")).toBe("afp_atlantico");
  });

  it("preserva guiones y lowercase", () => {
    expect(safeFilename("Sprint-2026-W16")).toBe("sprint-2026-w16");
  });
});
