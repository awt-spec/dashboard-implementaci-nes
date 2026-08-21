/**
 * Tema claro/oscuro (§12). Los tokens de ambos ya viven en index.css; lo que
 * faltaba era recordar la elección.
 *
 * `applyStoredTheme()` corre ANTES del primer render (desde main.tsx). Si se
 * aplicara dentro de un efecto de React, el usuario en oscuro vería un
 * destello claro en cada recarga.
 */
const KEY = "sva-theme";

export type Theme = "light" | "dark";

export function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "dark" || v === "light") return v;
    // Sin elección guardada, se respeta la del sistema operativo.
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    // Modo privado o storage bloqueado: el tema deja de persistir, no de andar.
    return "light";
  }
}

export function storeTheme(theme: Theme): void {
  try { localStorage.setItem(KEY, theme); } catch { /* sin persistencia */ }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Se llama una vez, antes de montar React. */
export function applyStoredTheme(): void {
  applyTheme(readStoredTheme());
}
