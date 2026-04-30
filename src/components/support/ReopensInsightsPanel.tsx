/**
 * ReopensInsightsPanel — el "panel de QA gaps" que pidió María.
 *
 * KPI superior: tasa de reapertura últimos 90d.
 * Sub-tabs: por cliente (oculto si scoped) · por técnico · por producto.
 *
 * Excluye reopen_type='historico' del cálculo de tasa real (esos son
 * pre-instalación del sistema, no son patrón actual).
 *
 * Cuando recibe `clientId`, todo el panel se scope a ese cliente:
 *   • KPI = tasa de ese cliente
 *   • TopList = filtra por client_id
 *   • Sub-tab "Por cliente" se oculta (no aporta — solo hay 1)
 *   • Default scope = "tecnico" (lo más útil cuando estás en un cliente)
 */
import { useState, useEffect } from "react";
import { RotateCcw, TrendingDown, TrendingUp, AlertTriangle, Loader2, Building2, User as UserIcon, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useReopenRate90d, useTopReincidentes, type ReopenScope } from "@/hooks/useTicketReopens";
import { cn } from "@/lib/utils";

interface Props {
  clientId?: string;
  /** Nombre del cliente para mostrar en el header cuando hay scope. */
  clientName?: string;
}

// Helpers para persistir UI state — sobrevive focus changes / TOKEN_REFRESHED.
const STORAGE = {
  expanded: "sva-erp:reopens-panel-expanded",
  scope:    "sva-erp:reopens-panel-scope",
};
function readBool(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v === "1"; } catch { return fallback; }
}
function writeBool(key: string, value: boolean) {
  try { localStorage.setItem(key, value ? "1" : "0"); } catch {}
}
function readScope(fallback: ReopenScope): ReopenScope {
  try {
    const v = localStorage.getItem(STORAGE.scope);
    return v === "cliente" || v === "tecnico" || v === "producto" ? v : fallback;
  } catch { return fallback; }
}
function writeScope(value: ReopenScope) {
  try { localStorage.setItem(STORAGE.scope, value); } catch {}
}

export function ReopensInsightsPanel({ clientId, clientName }: Props) {
  const isScoped = !!clientId;
  // Cuando estamos scoped a un cliente, "Por cliente" no aporta — default a "Por técnico"
  const defaultScope: ReopenScope = isScoped ? "tecnico" : "cliente";
  const [scope, setScopeState] = useState<ReopenScope>(() => {
    const persisted = readScope(defaultScope);
    // Si estamos scoped y el persisted era "cliente", forzar "tecnico"
    return isScoped && persisted === "cliente" ? "tecnico" : persisted;
  });
  const setScope = (s: ReopenScope) => { setScopeState(s); writeScope(s); };

  // Toggle expandido/colapsado, persistente
  const [expanded, setExpandedState] = useState<boolean>(() => readBool(STORAGE.expanded, true));
  const toggleExpanded = () => setExpandedState((v) => { writeBool(STORAGE.expanded, !v); return !v; });

  const { data: rate, isLoading: loadingRate } = useReopenRate90d(clientId);

  // Sync scope si cambia el contexto (de global a scoped) — evita "Por cliente" inválido
  useEffect(() => {
    if (isScoped && scope === "cliente") setScope("tecnico");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScoped]);

  return (
    <Card>
      <CardHeader className={cn("pb-3", !expanded && "pb-3")}>
        <button
          type="button"
          onClick={toggleExpanded}
          className="w-full flex items-center gap-2 text-left group"
          aria-expanded={expanded}
          aria-controls="reopens-panel-body"
        >
          <RotateCcw className="h-4 w-4 text-warning shrink-0" />
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap min-w-0 flex-1">
            Reincidencias / Inconformidades
            {isScoped && clientName && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 text-primary border-primary/30">
                <Building2 className="h-2.5 w-2.5" /> {clientName}
              </Badge>
            )}
            {/* Mini-resumen cuando está colapsado — para no perder señal */}
            {!expanded && rate && (
              <span className="text-[11px] font-normal text-muted-foreground ml-1">
                · {rate.rate_pct.toFixed(1)}% · {rate.reopens_90d} reincidencias / {rate.entregados_90d} entregados (90d)
              </span>
            )}
          </CardTitle>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal hidden md:inline">
            Excluye histórico pre-instalación
          </span>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent id="reopens-panel-body" className="space-y-4">
          {/* KPI: tasa 90d (global o scoped al cliente) */}
          <RateKPI loading={loadingRate} rate={rate} />

          {/* Sub-tabs — "Por cliente" se oculta cuando ya estamos scoped a un cliente */}
          <Tabs value={scope} onValueChange={(v) => setScope(v as ReopenScope)}>
            <TabsList className={cn("grid w-full h-8", isScoped ? "grid-cols-2" : "grid-cols-3")}>
              {!isScoped && (
                <TabsTrigger value="cliente" className="text-xs gap-1">
                  <Building2 className="h-3 w-3" /> Por cliente
                </TabsTrigger>
              )}
              <TabsTrigger value="tecnico" className="text-xs gap-1">
                <UserIcon className="h-3 w-3" /> Por técnico
              </TabsTrigger>
              <TabsTrigger value="producto" className="text-xs gap-1">
                <Package className="h-3 w-3" /> Por producto
              </TabsTrigger>
            </TabsList>

            <TabsContent value={scope} className="mt-3">
              <TopList scope={scope} clientId={clientId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

function RateKPI({
  loading,
  rate,
}: {
  loading: boolean;
  rate?: { reopens_90d: number; entregados_90d: number; rate_pct: number };
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!rate) return null;

  const pct = rate.rate_pct;
  // Heurística: <5% sano, 5-15% atención, >15% crítico
  const tone = pct < 5
    ? { label: "Saludable", color: "text-success", bg: "bg-success/10", Icon: TrendingDown }
    : pct < 15
    ? { label: "Atención", color: "text-warning", bg: "bg-warning/10", Icon: AlertTriangle }
    : { label: "Crítico", color: "text-destructive", bg: "bg-destructive/10", Icon: TrendingUp };

  return (
    <div className={cn("rounded-lg p-3 flex items-center gap-3", tone.bg)}>
      <div className={cn("h-12 w-12 rounded-full flex items-center justify-center bg-background border-2", tone.color, "border-current")}>
        <tone.Icon className={cn("h-6 w-6", tone.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-2xl font-bold tabular-nums", tone.color)}>
            {pct.toFixed(1)}%
          </span>
          <Badge variant="outline" className={cn("text-[10px]", tone.color, "border-current")}>
            {tone.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tasa de reapertura últimos 90 días ·{" "}
          <span className="font-semibold">{rate.reopens_90d}</span> reincidencias /{" "}
          <span className="font-semibold">{rate.entregados_90d}</span> entregados
        </p>
      </div>
    </div>
  );
}

function TopList({ scope, clientId }: { scope: ReopenScope; clientId?: string }) {
  const { data: items, isLoading } = useTopReincidentes(scope, 8, clientId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">Sin reincidencias en este corte.</p>
        <p className="text-[10px] opacity-60 mt-1">
          {scope === "tecnico" ? "Ningún técnico tiene casos que regresaron." :
           scope === "producto" ? "Ningún producto presentó reincidencias." :
                                  "Ningún cliente devolvió casos."}
        </p>
      </div>
    );
  }

  // Para barra: usar el max de total_reopens del top 1 como referencia
  const maxTotal = Math.max(1, ...items.map(i => i.total_reopens));

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div
          key={it.key}
          className={cn(
            "border rounded-lg p-2.5 transition-colors hover:bg-muted/30",
            idx === 0 && it.tickets_reincidentes >= 2 && "border-warning/40 bg-warning/[0.04]",
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-muted-foreground tabular-nums w-6">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold truncate">{it.label}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {it.tickets_reincidentes >= 2 && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 bg-warning/10 text-warning border-warning/40">
                  {it.tickets_reincidentes} reincidentes
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] h-5 tabular-nums">
                {it.total_reopens} reopens
              </Badge>
            </div>
          </div>
          <Progress
            value={(it.total_reopens / maxTotal) * 100}
            className="h-1.5"
          />
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
            <span>
              {it.reopens_real_90d > 0 ? (
                <>
                  <span className="font-semibold text-foreground">{it.reopens_real_90d}</span> en últimos 90d
                </>
              ) : (
                <span className="opacity-50">Sin actividad reciente</span>
              )}
            </span>
            {it.reopen_rate_90d_pct > 0 && (
              <span className="tabular-nums">
                tasa <span className={cn(
                  "font-semibold",
                  it.reopen_rate_90d_pct >= 15 ? "text-destructive" :
                  it.reopen_rate_90d_pct >= 5 ? "text-warning" : "text-success",
                )}>
                  {it.reopen_rate_90d_pct.toFixed(1)}%
                </span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
