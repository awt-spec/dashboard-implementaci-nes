import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Mail, ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/common/StatCard";
import { type Client } from "@/data/projectData";

type Tab = "fases" | "entregables" | "riesgos";

const TABS: { key: Tab; label: string }[] = [
  { key: "fases", label: "Fases" },
  { key: "entregables", label: "Entregables" },
  { key: "riesgos", label: "Riesgos" },
];

const DELIVERABLE_TONE: Record<string, string> = {
  entregado: "bg-success/15 text-success border-success/30",
  aprobado: "bg-success/15 text-success border-success/30",
  "en-revision": "bg-info/15 text-info border-info/30",
  pendiente: "bg-muted text-muted-foreground border-border",
};

const IMPACT_TONE: Record<string, string> = {
  alto: "bg-destructive/15 text-destructive border-destructive/30",
  medio: "bg-warning/15 text-warning border-warning/30",
  bajo: "bg-muted text-muted-foreground border-border",
};

/** Tono de la barra de una fase: verde completa, ámbar en curso, gris sin arrancar. */
function phaseTone(progress: number): string {
  if (progress >= 100) return "bg-success";
  if (progress > 0) return "bg-warning";
  return "bg-muted-foreground/30";
}

interface Props {
  client: Client | null;
  /** Navega a la ficha completa del cliente (contratos, SLAs, estado de cuenta…). */
  onOpenFull: (clientId: string) => void;
  /** Abre el expediente 360 (/clientes/:id), que cruza soporte e implementación. */
  onOpenDossier?: (clientId: string) => void;
}

/**
 * Panel lateral de vista rápida de un cliente (§11 del handoff): fases,
 * entregables y riesgos sin salir del listado.
 *
 * Es un PREVIEW, no un reemplazo de la ficha: el detalle completo vive en
 * ClientDetail y se llega con "Abrir ficha completa".
 */
export function ClientPreviewPanel({ client, onOpenFull, onOpenDossier }: Props) {
  const [tab, setTab] = useState<Tab>("fases");

  // Al cambiar de cliente el tab vuelve a Fases: mantener "Riesgos" abierto
  // de un cliente al siguiente hace leer datos de otro proyecto sin notarlo.
  useEffect(() => { setTab("fases"); }, [client?.id]);

  if (!client) {
    return (
      <aside className="hidden xl:block w-[356px] shrink-0">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Seleccioná un cliente para ver sus fases, entregables y riesgos.
          </p>
        </div>
      </aside>
    );
  }

  const openRisks = client.risks.filter(r => r.status === "abierto");

  return (
    <aside className="hidden xl:block w-[356px] shrink-0">
      <div className="sticky top-4 rounded-xl border border-border bg-card">
        {/* Cabecera */}
        <div className="p-4 pb-3">
          <div className="flex items-start gap-2.5">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold leading-tight truncate">{client.name}</h3>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {client.country}{client.industry ? ` · ${client.industry}` : ""}
              </p>
            </div>
          </div>

          {client.contactName && (
            <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 shrink-0" />
              {client.contactName}
            </p>
          )}

          {/* Avance */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <SectionLabel>Avance del proyecto</SectionLabel>
              <span className="text-xs font-bold tabular-nums">{client.progress}%</span>
            </div>
            <div className="h-[7px] bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, client.progress))}%` }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-2 border-b border-border">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`h-7 px-2.5 rounded-lg text-[11.5px] font-semibold transition-colors ${
                tab === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {t.label}
              {t.key === "riesgos" && openRisks.length > 0 && (
                <span className="ml-1 tabular-nums">({openRisks.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido — alto acotado para que el panel no crezca fuera de la ventana */}
        <div className="max-h-[46vh] overflow-y-auto p-4 pt-3 space-y-2.5">
          {tab === "fases" && (
            client.phases.length === 0
              ? <p className="text-xs text-muted-foreground">Sin fases registradas.</p>
              : client.phases.map(p => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-[11.5px] mb-1">
                    <span className="truncate pr-2">{p.name}</span>
                    <span className="font-semibold tabular-nums shrink-0">{p.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${phaseTone(p.progress)}`} style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }} />
                  </div>
                </div>
              ))
          )}

          {tab === "entregables" && (
            client.deliverables.length === 0
              ? <p className="text-xs text-muted-foreground">Sin entregables registrados.</p>
              : client.deliverables.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] truncate">{d.name}</span>
                  <Badge variant="outline" className={`text-[9.5px] shrink-0 ${DELIVERABLE_TONE[d.status] ?? ""}`}>
                    {d.status}
                  </Badge>
                </div>
              ))
          )}

          {tab === "riesgos" && (
            openRisks.length === 0
              ? <p className="text-xs text-muted-foreground">Sin riesgos abiertos.</p>
              : openRisks.map(r => (
                <div key={r.id} className="flex items-start justify-between gap-2">
                  <span className="text-[11.5px] leading-snug">{r.description}</span>
                  <Badge variant="outline" className={`text-[9.5px] shrink-0 capitalize ${IMPACT_TONE[r.impact] ?? ""}`}>
                    {r.impact}
                  </Badge>
                </div>
              ))
          )}
        </div>

        {/* Salida a la ficha completa: el panel es un vistazo, no la ficha. */}
        <div className="space-y-1.5 border-t border-border p-3">
          <Button size="sm" className="h-8 w-full gap-1.5 text-xs" onClick={() => onOpenFull(client.id)}>
            Abrir ficha completa <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          {onOpenDossier && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-full gap-1.5 text-xs"
              onClick={() => onOpenDossier(client.id)}
            >
              Expediente 360 <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
