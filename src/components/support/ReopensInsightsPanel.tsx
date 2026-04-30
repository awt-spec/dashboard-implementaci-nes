/**
 * ReopensInsightsPanel — el "panel de QA gaps" que pidió María.
 *
 * KPI superior: tasa de reapertura últimos 90d.
 * 3 sub-tabs: por cliente · por técnico · por producto.
 *
 * Excluye reopen_type='historico' del cálculo de tasa real (esos son
 * pre-instalación del sistema, no son patrón actual).
 */
import { useState } from "react";
import { RotateCcw, TrendingDown, TrendingUp, AlertTriangle, Loader2, Building2, User as UserIcon, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useReopenRate90d, useTopReincidentes, type ReopenScope } from "@/hooks/useTicketReopens";
import { cn } from "@/lib/utils";

interface Props {
  clientId?: string;
}

export function ReopensInsightsPanel({ clientId }: Props) {
  const { data: rate, isLoading: loadingRate } = useReopenRate90d();
  const [scope, setScope] = useState<ReopenScope>("cliente");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-warning" />
          Reincidencias / Inconformidades
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-auto">
            Excluye histórico pre-instalación
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI: tasa global 90d */}
        <RateKPI loading={loadingRate} rate={rate} />

        {/* 3 sub-tabs */}
        <Tabs value={scope} onValueChange={(v) => setScope(v as ReopenScope)}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="cliente" className="text-xs gap-1">
              <Building2 className="h-3 w-3" /> Por cliente
            </TabsTrigger>
            <TabsTrigger value="tecnico" className="text-xs gap-1">
              <UserIcon className="h-3 w-3" /> Por técnico
            </TabsTrigger>
            <TabsTrigger value="producto" className="text-xs gap-1">
              <Package className="h-3 w-3" /> Por producto
            </TabsTrigger>
          </TabsList>

          <TabsContent value={scope} className="mt-3">
            <TopList scope={scope} />
          </TabsContent>
        </Tabs>
      </CardContent>
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

function TopList({ scope }: { scope: ReopenScope }) {
  const { data: items, isLoading } = useTopReincidentes(scope, 8);

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
