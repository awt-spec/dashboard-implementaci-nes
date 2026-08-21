import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * true cuando hay ancho para el panel lateral de vista rápida (breakpoint xl de
 * Tailwind). Se usa para decidir COMPORTAMIENTO, no sólo estilo: por debajo de
 * xl el panel no se renderiza, así que el clic en una tarjeta debe seguir
 * navegando a la ficha completa en vez de no hacer nada visible.
 */
const XL_BREAKPOINT = 1280;

export function useIsXlUp() {
  const [isXl, setIsXl] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth >= XL_BREAKPOINT,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${XL_BREAKPOINT}px)`);
    const onChange = () => setIsXl(window.innerWidth >= XL_BREAKPOINT);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isXl;
}

/**
 * Ancho a partir del cual el escritorio muestra el sidebar expandido (§8 del
 * handoff). Por debajo —pero encima del breakpoint de teléfono— el shell sigue
 * siendo de escritorio pero con el sidebar colapsado a 60px.
 */
export const DESK_WIDE_BREAKPOINT = 1180;

export function useIsDeskWide() {
  const [isWide, setIsWide] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESK_WIDE_BREAKPOINT}px)`);
    const onChange = () => setIsWide(mql.matches);
    mql.addEventListener("change", onChange);
    setIsWide(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isWide;
}
