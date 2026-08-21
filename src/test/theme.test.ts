import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyTheme, readStoredTheme, storeTheme } from "@/lib/theme";

describe("tema persistido", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("recuerda la elección entre recargas", () => {
    storeTheme("dark");
    expect(readStoredTheme()).toBe("dark");
    storeTheme("light");
    expect(readStoredTheme()).toBe("light");
  });

  it("sin elección guardada usa la preferencia del sistema", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("dark"), media: q, addEventListener() {}, removeEventListener() {} }));
    expect(readStoredTheme()).toBe("dark");
    vi.unstubAllGlobals();
  });

  it("aplica y quita la clase dark en el html", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("no revienta si localStorage está bloqueado (modo privado)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(() => storeTheme("dark")).not.toThrow();
    spy.mockRestore();
  });
});
