import { createContext, useContext, type ReactNode } from "react";

/**
 * Modo solo-lectura para árboles de UI embebidos. Se usa para el rol CEO, que
 * es observador de todo el sistema: RLS solo le concede SELECT, así que los
 * botones de escritura de los componentes de admin reutilizados (ClientDetail,
 * SupportDashboard, …) fallarían server-side con un error RLS críptico. En vez
 * de eso, el CEODashboard envuelve esas vistas con <ReadOnlyProvider value>
 * y los controles destructivos consultan useReadOnly() para ocultarse.
 *
 * Por defecto es false, así que cualquier componente montado fuera de un
 * provider (uso normal admin/pm) conserva su comportamiento de escritura.
 */
const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
