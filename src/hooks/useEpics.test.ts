import { describe, it, expect } from "vitest";
import { summarizeEpicsFromTasks, EPICS } from "./useEpics";

const t = (over: Partial<{ epic: string; storyPoints: number; status: string; scrumStatus: string }>) => ({
  epic: "parametrizacion",
  storyPoints: 1,
  status: "pendiente",
  scrumStatus: null as any,
  ...over,
});

describe("summarizeEpicsFromTasks", () => {
  it("sin tareas → todas las épicas en 0 y overall 0", () => {
    const { summaries, overall } = summarizeEpicsFromTasks([]);
    expect(summaries).toHaveLength(EPICS.length);
    expect(summaries.every((s) => s.total === 0 && s.progress === 0)).toBe(true);
    expect(overall).toBe(0);
  });

  it("agrupa por épica y cuenta total/done", () => {
    const { summaries } = summarizeEpicsFromTasks([
      t({ epic: "infraestructura", status: "completada" }),
      t({ epic: "infraestructura", status: "pendiente" }),
      t({ epic: "capacitaciones", scrumStatus: "done" }),
    ]);
    const infra = summaries.find((s) => s.key === "infraestructura")!;
    const capa = summaries.find((s) => s.key === "capacitaciones")!;
    expect(infra.total).toBe(2);
    expect(infra.doneCount).toBe(1);
    expect(capa.doneCount).toBe(1);
  });

  it("detecta 'done' por status=completada o scrum_status=done", () => {
    const { summaries } = summarizeEpicsFromTasks([
      t({ epic: "desarrollos", status: "completada" }),
      t({ epic: "desarrollos", scrumStatus: "done" }),
    ]);
    const dev = summaries.find((s) => s.key === "desarrollos")!;
    expect(dev.doneCount).toBe(2);
    expect(dev.progress).toBe(100);
  });

  it("progreso ponderado por story points", () => {
    // 3 pts done + 1 pt pendiente → 75%
    const { summaries } = summarizeEpicsFromTasks([
      t({ epic: "parametrizacion", storyPoints: 3, status: "completada" }),
      t({ epic: "parametrizacion", storyPoints: 1, status: "pendiente" }),
    ]);
    const p = summaries.find((s) => s.key === "parametrizacion")!;
    expect(p.progress).toBe(75);
  });

  it("epic nulo cae en parametrización (no se pierde)", () => {
    const { summaries } = summarizeEpicsFromTasks([
      t({ epic: undefined as any, status: "completada" }),
    ]);
    const p = summaries.find((s) => s.key === "parametrizacion")!;
    expect(p.total).toBe(1);
    expect(p.progress).toBe(100);
  });

  it("overall global ponderado por puntos entre todas las tareas", () => {
    const { overall } = summarizeEpicsFromTasks([
      t({ epic: "infraestructura", storyPoints: 2, status: "completada" }),
      t({ epic: "desarrollos", storyPoints: 2, status: "pendiente" }),
    ]);
    expect(overall).toBe(50);
  });

  it("story points ausentes cuentan como 1", () => {
    const { summaries } = summarizeEpicsFromTasks([
      t({ epic: "administracion", storyPoints: 0, status: "completada" }),
      t({ epic: "administracion", storyPoints: 0, status: "pendiente" }),
    ]);
    const a = summaries.find((s) => s.key === "administracion")!;
    expect(a.progress).toBe(50);
  });
});
