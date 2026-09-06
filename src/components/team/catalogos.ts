/**
 * Catálogos compartidos entre componentes de equipo.
 *
 * Viven acá y no dentro de sus componentes porque las pruebas los importan
 * para comprobar que cada entrada trae un icono renderizable: exportarlos
 * desde un archivo de componente rompe el fast refresh de Vite.
 *
 * Antes el icono iba embebido en la etiqueta como emoji ("🏖️ Vacaciones") y
 * una parte del código hacía label.split(" ")[0] para quedarse con él. Ahora
 * el icono es un componente y la etiqueta es sólo texto.
 */
import { Palmtree, Thermometer, Home, GraduationCap, Handshake, Lightbulb,
         Rocket, Sparkles, type LucideIcon } from "lucide-react";

export interface EntradaConIcono {
  value: string;
  label: string;
  Icono: LucideIcon;
}

/** Tipos de ausencia del calendario del equipo. */
export const TIPOS_AUSENCIA: Array<EntradaConIcono & { color: string }> = [
  { value: "vacation", label: "Vacaciones",   Icono: Palmtree,      color: "bg-cyan-500" },
  { value: "sick",     label: "Enfermedad",   Icono: Thermometer,   color: "bg-rose-500" },
  { value: "personal", label: "Personal",     Icono: Home,          color: "bg-violet-500" },
  { value: "training", label: "Capacitación", Icono: GraduationCap, color: "bg-amber-500" },
];

/** Categorías de reconocimiento (kudos). El emoji del kudo lo elige la
 *  persona y vive aparte: eso es dato, no decoración. */
export const CATEGORIAS_KUDO: EntradaConIcono[] = [
  { value: "teamwork",   label: "Teamwork",   Icono: Handshake },
  { value: "innovation", label: "Innovación", Icono: Lightbulb },
  { value: "delivery",   label: "Entrega",    Icono: Rocket },
  { value: "mentor",     label: "Mentoría",   Icono: GraduationCap },
  { value: "quality",    label: "Calidad",    Icono: Sparkles },
];
