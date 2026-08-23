import { toneStyles, type Tone } from "@/hooks/useClientDossier";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  /** Serie corta; vacía o de un solo punto no se dibuja. */
  values: number[];
  tone: Tone;
  className?: string;
}

/**
 * Sparkline de barras con `div`s puros: sin SVG y sin librería. A 56×22 un
 * gráfico de verdad no aporta nada que estas barras no digan, y evita sumar
 * una dependencia de charting al bundle.
 *
 * Las barras se escalan contra el máximo de la serie, no contra un tope fijo:
 * con valores chicos un tope fijo las dejaría todas planas.
 */
export function Sparkline({ values, tone, className }: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const t = toneStyles(tone);
  return (
    <div
      className={cn("flex h-[22px] w-14 shrink-0 items-end gap-px", className)}
      aria-hidden
      title={values.join(" · ")}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-t-[2px] opacity-75", t.bar)}
          // Mínimo de 2px: una barra de 0 desaparece y se lee como un hueco.
          style={{ height: `${Math.max(2, Math.round((v / max) * 22))}px` }}
        />
      ))}
    </div>
  );
}
