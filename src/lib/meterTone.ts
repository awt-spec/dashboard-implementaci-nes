/**
 * Tono de un medidor según el umbral. El color NO es fijo: un 96% de
 * cumplimiento y un 40% no pueden pintarse igual, que es justo lo que pide
 * el §9 del handoff ("el color sale del umbral, no fijo").
 *
 * `higherIsBetter` invierte la escala para los medidores donde subir es malo
 * — consumir el 95% de las horas del contrato no es una buena noticia.
 */
export function meterTone(pct: number | null, higherIsBetter: boolean): { bar: string; text: string } {
  // Sin dato NO es un resultado. Antes, "sin casos con SLA" caía en pct=0 y se
  // pintaba ROJO (alarma falsa) y "sin horas de contrato" caía en la escala
  // invertida y se pintaba VERDE (falso visto bueno). Las dos mentían.
  if (pct === null) return { bar: "bg-muted-foreground/30", text: "text-muted-foreground" };
  const score = higherIsBetter ? pct : 100 - pct;
  if (score >= 90) return { bar: "bg-success", text: "text-success" };
  if (score >= 70) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-destructive", text: "text-destructive" };
}
