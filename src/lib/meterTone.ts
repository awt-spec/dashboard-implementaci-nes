/**
 * Tono de un medidor según el umbral. El color NO es fijo: un 96% de
 * cumplimiento y un 40% no pueden pintarse igual, que es justo lo que pide
 * el §9 del handoff ("el color sale del umbral, no fijo").
 *
 * `higherIsBetter` invierte la escala para los medidores donde subir es malo
 * — consumir el 95% de las horas del contrato no es una buena noticia.
 */
export function meterTone(pct: number, higherIsBetter: boolean): { bar: string; text: string } {
  const score = higherIsBetter ? pct : 100 - pct;
  if (score >= 90) return { bar: "bg-success", text: "text-success" };
  if (score >= 70) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-destructive", text: "text-destructive" };
}
