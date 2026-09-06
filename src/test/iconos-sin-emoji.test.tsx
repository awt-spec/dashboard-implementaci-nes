/**
 * Los emojis decorativos se cambiaron por iconos de lucide en 36 archivos. Dos
 * de esos cambios reestructuraron datos —TYPES en TimeOffCalendar y CATEGORIES
 * en QuickKudoButton pasaron de "🏖️ Vacaciones" a { label, Icono }— y ese
 * patrón, `<c.Icono />`, revienta en render si a alguna entrada le falta el
 * icono. tsc no siempre lo ve; esto sí.
 *
 * Se comprueba además que el emoji que ES dato siga intacto: los kudos y los
 * ánimos del daily los elige una persona y reemplazarlos rompería la función.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/hooks/useTeamMembers", () => ({
  useSysdeTeamMembers: () => ({ data: [{ id: "m1", name: "Hellen Calvo" }] }),
}));
vi.mock("@/hooks/useTeamEngagement", () => ({
  useGiveKudo: () => ({ mutate: () => {}, isPending: false }),
  useTimeOff: () => ({ data: [] }),
  useRequestTimeOff: () => ({ mutate: () => {}, isPending: false }),
  useUpdateTimeOff: () => ({ mutate: () => {}, isPending: false }),
}));

import { QuickKudoButton } from "@/components/team/QuickKudoButton";
import { CATEGORIAS_KUDO, TIPOS_AUSENCIA } from "@/components/team/catalogos";

const envolver = (nodo: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{nodo}</QueryClientProvider>);
};

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

// jsdom no trae la API de punteros y Radix la usa para abrir el Select.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

describe("categorías de kudo: icono en vez de emoji", () => {
  // El Select de Radix no se abre en jsdom, así que en vez de pelearse con él
  // se comprueba directamente lo que puede romperse: que cada entrada traiga
  // un icono que renderice, y que su etiqueta ya no lleve emoji.
  it.each([
    ["categorías de kudo", CATEGORIAS_KUDO],
    ["tipos de ausencia", TIPOS_AUSENCIA],
  ])("cada entrada de %s tiene icono renderizable y etiqueta sin emoji", (_n, entradas) => {
    expect(entradas.length).toBeGreaterThan(0);
    for (const e of entradas as Array<{ label: string; Icono: React.ComponentType<{ className?: string }> }>) {
      expect(e.label).not.toMatch(EMOJI);
      expect(e.Icono).toBeTruthy();
      const { container, unmount } = render(<e.Icono className="h-4 w-4" />);
      expect(container.querySelector("svg")).toBeTruthy();
      unmount();
    }
  });

  it("pero el emoji del kudo —que lo elige la persona— sigue estando", () => {
    envolver(<QuickKudoButton toMemberId="m1" />);
    fireEvent.click(screen.getByRole("button"));
    const botones = screen.getAllByRole("button").map(b => b.textContent ?? "");
    expect(botones.some(t => EMOJI.test(t))).toBe(true);
  });
});

describe("el barrido de emojis decorativos", () => {
  // El emoji que ES dato se reconoce por lo que la línea hace, no por su
  // número: la primera versión llevaba line numbers y se rompió en cuanto un
  // archivo creció una línea — falló por la razón equivocada.
  const ES_DATO = [
    /const (EMOJIS|MOODS|QUICK_EMOJIS) = \[/,   // paletas que elige la persona
    /useState\("\p{Emoji_Presentation}/u,       // emoji por defecto del picker
    /\[.*\]\[n - 1\]/,                        // escala de ánimos del retro
    /(\?\?|\|\|)\s*"[^"]*\p{Emoji_Presentation}/u,  // respaldo de un emoji guardado en la base
  ];
  const recorrer = (dir: string, acc: string[] = []): string[] => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p, acc);
      else if (/\.tsx?$/.test(e.name)) acc.push(p);
    }
    return acc;
  };

  it("no vuelve a entrar un emoji decorativo en la UI", () => {
    // Sin clase de caracteres: un emoji compuesto (bandera, ZWJ) dentro de []
    // hace que el linter marque no-misleading-character-class, y con razón.
    const tieneEmoji = (t: string) => [...t].some(ch => {
      const c = ch.codePointAt(0)!;
      return (c >= 0x1f000 && c <= 0x1faff) || (c >= 0x2600 && c <= 0x26ff)
          || (c >= 0x2700 && c <= 0x27bf) || c === 0xfe0f;
    });
    const culpables: string[] = [];
    for (const f of recorrer("src")) {
      fs.readFileSync(f, "utf8").split("\n").forEach((linea, i) => {
        const clave = `${f}:${i + 1}`;
        const esComentario = /^\s*(\/\/|\*|\/\*)/.test(linea);
        const esDato = ES_DATO.some(re => re.test(linea));
        if (tieneEmoji(linea) && !esDato && !esComentario) culpables.push(`${clave} ${linea.trim().slice(0, 60)}`);
      });
    }
    expect(culpables).toEqual([]);
  });
});
