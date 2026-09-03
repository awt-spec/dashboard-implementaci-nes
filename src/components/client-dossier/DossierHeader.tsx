import { Building2 } from "lucide-react";
import { toneStyles, type ClientDossier, type Tone } from "@/hooks/useClientDossier";
import { cn } from "@/lib/utils";

export type DossierCtx = "soporte" | "impl";

/** Color del anillo, en HSL crudo porque conic-gradient no toma clases. */
const RING: Record<Tone, string> = {
  green: "hsl(152 55% 42%)",
  amber: "hsl(38 92% 50%)",
  red: "hsl(0 84% 60%)",
  blue: "hsl(214 80% 55%)",
  grey: "hsl(220 13% 88%)",
};

function HealthRing({ score, tone }: { score: number | null; tone: Tone }) {
  // Sin señal el anillo queda vacío y muestra "—": pintar un 0 se leería como
  // "salud pésima" cuando lo que pasa es que no hay con qué medir.
  const deg = score === null ? 0 : score * 3.6;
  return (
    <div
      className="relative h-[52px] w-[52px] shrink-0 rounded-full"
      style={{ background: `conic-gradient(${RING[tone]} ${deg}deg, hsl(220 14% 92%) 0deg)` }}
      title={
        score === null
          ? "Sin señal suficiente para calcular la salud"
          : `Salud ${score}/100 — pondera cumplimiento de SLA, casos vencidos, riesgos altos y avance, sólo con las señales que tienen dato`
      }
    >
      <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-card">
        <span className="text-[13px] font-extrabold leading-none tabular-nums text-foreground">
          {score === null ? "—" : score}
        </span>
        <span className="text-[6.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">salud</span>
      </div>
    </div>
  );
}

export interface DossierHeaderProps {
  dossier: ClientDossier;
  ctx: DossierCtx;
  onCtxChange: (ctx: DossierCtx) => void;
}

/**
 * Banda de identidad + conmutador de contexto.
 *
 * El conmutador es el control principal de la pantalla: lleva el dato vivo en
 * el sublabel para que la decisión de a cuál entrar se tome sin entrar.
 */
export function DossierHeader({ dossier, ctx, onCtxChange }: DossierHeaderProps) {
  const { client, health, healthTone, badges, identityLine } = dossier;
  if (!client) return null;

  const options: { key: DossierCtx; label: string; sub: string }[] = [
    { key: "soporte", label: "Soporte", sub: dossier.supportSublabel },
    { key: "impl", label: "Implementación", sub: dossier.implSublabel },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-card px-3.5 py-3">
      <HealthRing score={health} tone={healthTone} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="min-w-0 truncate text-[16px] font-bold leading-tight text-foreground">{client.name}</h2>
          {/* Etiquetas derivadas del dato: renovación, módulo con más casos,
              incumplimientos, cobertura contractual. Ninguna es decorativa. */}
          {badges.slice(0, 4).map(b => (
            <span
              key={b.label}
              className={cn("shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold", toneStyles(b.tone).chip)}
            >
              {b.label}
            </span>
          ))}
        </div>
        {/* Sin plan comercial, ARR, usuarios ni fecha de alta en el modelo: la
            línea dice lo que se sabe en vez de rellenar con cifras inventadas. */}
        <p className="mt-1 truncate text-[11.5px] font-medium text-muted-foreground">
          {identityLine || "Sin datos de ficha"}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        {options.map(o => {
          const isActive = ctx === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onCtxChange(o.key)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "min-h-[44px] rounded-xl border px-3 py-1.5 text-left transition-colors",
                isActive
                  ? "border-primary bg-primary/[0.07] text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              <span className="block text-[12.5px] font-bold leading-tight">{o.label}</span>
              <span className="block text-[10px] font-medium tabular-nums opacity-80">{o.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
