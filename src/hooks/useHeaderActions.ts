import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * Contexto para que la vista activa ponga sus propios controles en la barra de
 * título (§8: "cada vista inyecta su propia barra de acciones en el header").
 *
 * Sin esto, cada vista dibuja su fila de chips dentro del cuerpo y quedan DOS
 * barras apiladas: la del título y la de la vista. El diseño tiene una sola.
 */
export const HeaderActionsContext = createContext<{
  actions: ReactNode;
  setActions: (node: ReactNode) => void;
}>({ actions: null, setActions: () => {} });

/** Lo consume el AppHeader. */
export function useHeaderActions(): ReactNode {
  return useContext(HeaderActionsContext).actions;
}

/**
 * Lo llama la vista. Se limpia al desmontar para que los controles de una
 * vista no queden colgados en el header de la siguiente.
 *
 * `deps` gobierna cuándo se vuelve a publicar el nodo: como es JSX nuevo en
 * cada render, sin deps el efecto correría siempre y provocaría un bucle.
 *
 * Como todo hook, va ANTES de cualquier return temprano de la vista.
 */
export function useSetHeaderActions(node: ReactNode, deps: unknown[]) {
  const { setActions } = useContext(HeaderActionsContext);
  useEffect(() => {
    setActions(node);
    return () => setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
