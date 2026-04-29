/**
 * SLAByClientPanel — breakdown de boletas vencidas POR CLIENTE.
 *
 * Reusable: se inserta tanto en OverdueTicketsSheet como en Explorar.
 *
 * Diseño: lista compacta con barra de severidad, top N clientes con
 * más vencidos, click → abre OverdueTicketsSheet (con filtro o no).
 *
 * Cada fila muestra:
 *  • Posición (01, 02, …)
 *  • Nombre del cliente
 *  • Cantidad de vencidos · breakdown por categoría (cierre / bandeja / espera)
 *  • Severidad promedio (días excedidos)
 *  • Mix de fuente: cuántos por Política, cuántos por SLA cliente
 */
import { useMemo } from "react";
import { useAllSupportTickets, useSupportClients } from "@/hooks/useSupportTickets";
import { useTicketsSLAStatus } from "@/hooks/useTicketsSLAStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Lock, AlertTriangle, Clock, ListMinus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Cantidad máxima de clientes a mostrar (default 8) */
  limit?: number;
  /** Si true, esconde el header de la card (para usar inline en otros containers) */
  embedded?: boolean;
  /** Callback al click en un cliente específico (para filtrar OverdueSheet, etc.) */
  onClientClick?: (clientId: string, clientName: string) => void;
  /** Click en CTA "Ver todos" — default: abre OverdueSheet sin filtro */
  onViewAll?: () => void;
}

export function SLAByClientPanel({ limit = 8, embedded = false, onClientClick, onViewAll }: Props) {
  const { data: tickets = [] } = useAllSupportTickets();
  const { data: clients = [] } = useSupportClients();
  const { byId: slaByTicketId } = useTicketsSLAStatus();

  const breakdown = useMemo(() => {
    interface ClientRow {
      clientId: string;
      clientName: string;
      total: number;
      easyClose: number;     // POR CERRAR
      activeInbox: number;   // PENDIENTE + EN ATENCIÓN
      waitingExternal: number; // COTIZADA + ON HOLD + VALORACIÓN
      policy: number;        // source = policy_v4.5
      clientOverride: number; // source = client_override
      maxExceeded: number;   // máx días excedidos en sus tickets
      avgExceeded: number;   // promedio días excedidos
    }

    const map = new Map<string, ClientRow>();

    tickets.forEach(t => {
      const sla = slaByTicketId.get(t.id);
      if (!sla || sla.status !== "overdue") return;

      let row = map.get(t.client_id);
      if (!row) {
        const cli = clients.find(c => c.id === t.client_id);
        row = {
          clientId: t.client_id,
          clientName: cli?.name || t.client_id,
          total: 0, easyClose: 0, activeInbox: 0, waitingExternal: 0,
          policy: 0, clientOverride: 0,
          maxExceeded: 0, avgExceeded: 0,
        };
        map.set(t.client_id, row);
      }
      row.total++;

      // Categoría de acción
      if (t.estado === "POR CERRAR") row.easyClose++;
      else if (t.estado === "PENDIENTE" || t.estado === "EN ATENCIÓN") row.activeInbox++;
      else row.waitingExternal++;

      // Fuente del SLA
      if (sla.source === "client_override") row.clientOverride++;
      else row.policy++;

      // Severidad
      const exceeded = sla.daysElapsed - sla.deadlineDays;
      if (exceeded > row.maxExceeded) row.maxExceeded = exceeded;
      row.avgExceeded += exceeded;
    });

    // Calcular promedio
    const list = Array.from(map.values()).map(r => ({
      ...r,
      avgExceeded: r.total > 0 ? Math.round(r.avgExceeded / r.total) : 0,
    }));

    list.sort((a, b) => b.total - a.total);
    return list;
  }, [tickets, clients, slaByTicketId]);

  const top = breakdown.slice(0, limit);
  const remaining = breakdown.length - top.length;
  const totalOverdue = breakdown.reduce((s, r) => s + r.total, 0);

  if (totalOverdue === 0) {
    return embedded ? null : (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          Sin boletas vencidas — todas dentro de plazo 🎉
        </CardContent>
      </Card>
    );
  }

  const Wrapper = embedded ? "div" : Card;
  const InnerWrapper = embedded ? "div" : CardContent;

  return (
    <Wrapper className={embedded ? "" : "border-destructive/20"}>
      <InnerWrapper className={embedded ? "space-y-2" : "p-4 space-y-3"}>
        {/* Header del panel — opcional */}
        {!embedded && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-destructive/15 flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-bold">Vencidas por cliente</p>
                <p className="text-[10px] text-muted-foreground">
                  {breakdown.length} cliente{breakdown.length === 1 ? "" : "s"} con boletas fuera de plazo
                </p>
              </div>
            </div>
            {onViewAll && (
              <button
                onClick={onViewAll}
                className="text-[10px] uppercase tracking-wider font-bold text-destructive hover:underline"
              >
                Ver todas →
              </button>
            )}
          </div>
        )}

        {/* Lista de clientes */}
        <div className="space-y-1">
          {top.map((r, i) => {
            const maxTotal = top[0].total;
            const pct = maxTotal > 0 ? Math.round((r.total / maxTotal) * 100) : 0;
            const hasOverride = r.clientOverride > 0;

            return (
              <button
                key={r.clientId}
                type="button"
                onClick={() => onClientClick?.(r.clientId, r.clientName)}
                disabled={!onClientClick}
                className={cn(
                  "w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors",
                  onClientClick ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"
                )}
              >
                {/* Posición */}
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Nombre + total */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold truncate">{r.clientName}</span>
                    <span className="text-[11px] tabular-nums font-bold text-destructive shrink-0">
                      {r.total} vencidas
                    </span>
                  </div>

                  {/* Barra severidad relativa */}
                  <div className="h-1 rounded-full bg-muted/40 overflow-hidden mb-1.5">
                    <div className="h-full bg-destructive" style={{ width: `${pct}%` }} />
                  </div>

                  {/* Breakdown chips compactos */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[9px]">
                    {r.easyClose > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                        <Lock className="h-2 w-2" />
                        <strong>{r.easyClose}</strong> cierre
                      </span>
                    )}
                    {r.activeInbox > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-destructive">
                        <AlertTriangle className="h-2 w-2" />
                        <strong>{r.activeInbox}</strong> bandeja
                      </span>
                    )}
                    {r.waitingExternal > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-500">
                        <Clock className="h-2 w-2" />
                        <strong>{r.waitingExternal}</strong> espera
                      </span>
                    )}
                    {/* Mix fuente */}
                    {hasOverride && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="inline-flex items-center gap-0.5 text-primary">
                          <Building2 className="h-2 w-2" />
                          {r.clientOverride} SLA cli
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground tabular-nums">
                      máx <strong className="text-foreground">+{r.maxExceeded}d</strong>
                    </span>
                  </div>
                </div>

                {onClientClick && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Footer: si hay más clientes */}
        {remaining > 0 && (
          <p className="text-[10px] text-center text-muted-foreground italic pt-1 border-t border-border/40">
            +{remaining} cliente{remaining === 1 ? "" : "s"} más con vencidas
            {onViewAll && <button onClick={onViewAll} className="ml-1 text-primary hover:underline">ver todos</button>}
          </p>
        )}
      </InnerWrapper>
    </Wrapper>
  );
}
