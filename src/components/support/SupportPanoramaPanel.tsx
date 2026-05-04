import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ShieldAlert, ShieldX, Clock, Flame, AlertTriangle,
  UserPlus, PackageCheck, RotateCcw, Eye, ArrowRight, CheckCircle2, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isTicketClosed } from "@/lib/ticketStatus";
import type { SupportTicket } from "@/hooks/useSupportTickets";

// ─── Tipos ───────────────────────────────────────────────────────────────

interface ClientSla {
  client_id: string;
  priority_level: string;
  response_time_hours: number;
  resolution_time_hours: number;
}

type SlaStatus = "ok" | "riesgo" | "vencido" | "sin_sla";

interface TicketWithSla extends SupportTicket {
  _slaStatus: SlaStatus;
  _slaUsedPct: number;
  _hoursAge: number;
  _slaResolutionHours: number | null;
}

interface RecommendedAction {
  ticket: TicketWithSla;
  action: string;
  urgency: "alta" | "media" | "baja";
  Icon: typeof AlertTriangle;
  reason: string;
}

interface Props {
  tickets: SupportTicket[];
  clientName?: string;
  onOpenTicket?: (ticket: SupportTicket) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function normalizePriority(prio?: string | null): string {
  if (!prio) return "Media";
  if (/critica/i.test(prio)) return "Critica, Impacto Negocio";
  return prio;
}

function hoursSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

// ─── Componente ──────────────────────────────────────────────────────────

export function SupportPanoramaPanel({ tickets, clientName, onOpenTicket }: Props) {
  // Fetch SLAs de todos los clientes (la lista no suele ser grande)
  const { data: slas = [] } = useQuery({
    queryKey: ["client-slas-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_slas")
        .select("client_id, priority_level, response_time_hours, resolution_time_hours")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as ClientSla[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Indexa SLAs por client+priority para lookup O(1)
  const slaIndex = useMemo(() => {
    const map = new Map<string, ClientSla>();
    slas.forEach(s => map.set(`${s.client_id}|${normalizePriority(s.priority_level)}`, s));
    return map;
  }, [slas]);

  // Enriquece tickets con estado SLA
  const enriched: TicketWithSla[] = useMemo(() => {
    return tickets.map(t => {
      const isOpen = !isTicketClosed(t.estado);
      const key = `${t.client_id}|${normalizePriority(t.prioridad)}`;
      const sla = slaIndex.get(key);
      const age = hoursSince(t.fecha_registro || t.created_at);

      let status: SlaStatus = "sin_sla";
      let usedPct = 0;
      if (sla && isOpen) {
        usedPct = (age / sla.resolution_time_hours) * 100;
        if (usedPct >= 100) status = "vencido";
        else if (usedPct >= 70) status = "riesgo";
        else status = "ok";
      } else if (isOpen) {
        // Sin SLA pero abierto: clasificamos por edad raw (> 30d = riesgo, > 90d = vencido)
        const days = age / 24;
        if (days > 90) status = "vencido";
        else if (days > 30) status = "riesgo";
        else status = "ok";
      }

      return {
        ...t,
        _slaStatus: status,
        _slaUsedPct: usedPct,
        _hoursAge: age,
        _slaResolutionHours: sla?.resolution_time_hours ?? null,
      };
    });
  }, [tickets, slaIndex]);

  // KPIs
  const openTickets = enriched.filter(t => !isTicketClosed(t.estado));
  const kpi = useMemo(() => {
    const counts = { ok: 0, riesgo: 0, vencido: 0, sin_sla: 0 };
    let totalUsed = 0;
    let withSla = 0;
    openTickets.forEach(t => {
      counts[t._slaStatus]++;
      if (t._slaResolutionHours) { totalUsed += t._slaUsedPct; withSla++; }
    });
    const avgUsed = withSla > 0 ? Math.round(totalUsed / withSla) : 0;
    const compliance = openTickets.length > 0
      ? Math.round((counts.ok / openTickets.length) * 100)
      : 100;
    return { ...counts, avgUsed, compliance, totalOpen: openTickets.length };
  }, [openTickets]);

  // ─── Reglas de acciones recomendadas ───────────────────────────────
  const recommendedActions = useMemo((): RecommendedAction[] => {
    const actions: RecommendedAction[] = [];

    openTickets.forEach(t => {
      // 1. SLA vencido → compliance breach
      if (t._slaStatus === "vencido") {
        actions.push({
          ticket: t,
          action: "Escalar — SLA vencido",
          urgency: "alta",
          Icon: ShieldX,
          reason: t._slaResolutionHours
            ? `${Math.round(t._hoursAge)}h de ${t._slaResolutionHours}h permitidas (${Math.round(t._slaUsedPct)}%)`
            : `${Math.round(t._hoursAge / 24)}d sin resolver`,
        });
        return;
      }

      // 2. Crítico PENDIENTE > 4h → atender urgente
      if (/critica/i.test(t.prioridad || "") && t.estado === "PENDIENTE" && t._hoursAge > 4) {
        actions.push({
          ticket: t,
          action: "Atender urgente — crítico sin tomar",
          urgency: "alta",
          Icon: Flame,
          reason: `Crítico pendiente hace ${Math.round(t._hoursAge)}h`,
        });
        return;
      }

      // 3. Sin responsable
      if (!t.responsable || t.responsable.trim() === "") {
        actions.push({
          ticket: t,
          action: "Asignar responsable",
          urgency: t._slaStatus === "riesgo" ? "alta" : "media",
          Icon: UserPlus,
          reason: t._slaStatus === "riesgo" ? "SLA en riesgo y sin dueño" : "Caso sin responsable asignado",
        });
        return;
      }

      // 4. SLA en riesgo
      if (t._slaStatus === "riesgo") {
        actions.push({
          ticket: t,
          action: "Priorizar — SLA en riesgo",
          urgency: "media",
          Icon: ShieldAlert,
          reason: t._slaResolutionHours
            ? `${Math.round(t._slaUsedPct)}% del SLA consumido`
            : `${Math.round(t._hoursAge / 24)}d de antigüedad`,
        });
        return;
      }

      // 5. ENTREGADA > 5 días → confirmar cierre
      if (t.estado === "ENTREGADA" && t._hoursAge > 5 * 24) {
        actions.push({
          ticket: t,
          action: "Confirmar cierre con cliente",
          urgency: "media",
          Icon: PackageCheck,
          reason: `Entregada hace ${Math.round(t._hoursAge / 24)}d sin validación`,
        });
        return;
      }

      // 6. EN ATENCIÓN > 14 días sin update
      if (t.estado === "EN ATENCIÓN" && t._hoursAge > 14 * 24) {
        actions.push({
          ticket: t,
          action: "Contactar cliente — sin actividad",
          urgency: "media",
          Icon: RotateCcw,
          reason: `En atención hace ${Math.round(t._hoursAge / 24)}d`,
        });
        return;
      }
    });

    // Ordenar por urgencia + prioridad del ticket + edad desc
    const urgencyRank = { alta: 0, media: 1, baja: 2 } as const;
    return actions
      .sort((a, b) => {
        const u = urgencyRank[a.urgency] - urgencyRank[b.urgency];
        if (u !== 0) return u;
        return b.ticket._hoursAge - a.ticket._hoursAge;
      })
      .slice(0, 10);
  }, [openTickets]);

  // ─── Render ─────────────────────────────────────────────────────────

  const kpiCards = [
    { label: "Cumple SLA", value: kpi.ok, hint: `${kpi.compliance}% del total abiertos`, Icon: ShieldCheck, color: "text-success", bg: "bg-success/10" },
    { label: "En riesgo", value: kpi.riesgo, hint: "≥ 70% de SLA consumido", Icon: ShieldAlert, color: "text-warning", bg: "bg-warning/10" },
    { label: "Vencidos", value: kpi.vencido, hint: "Compliance breach", Icon: ShieldX, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Sin SLA definido", value: kpi.sin_sla, hint: "Revisar config del cliente", Icon: Clock, color: "text-muted-foreground", bg: "bg-muted/40" },
  ];

  const urgencyTone = {
    alta: "bg-destructive/10 text-destructive border-destructive/30",
    media: "bg-warning/10 text-warning border-warning/30",
    baja: "bg-muted/40 text-muted-foreground border-border",
  };

  return (
    <div className="space-y-4">
      {/* Header compacto */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Panorama operativo</h3>
          <p className="text-[11px] text-muted-foreground">
            SLA en vivo {clientName ? `· ${clientName}` : ""} · {kpi.totalOpen} casos abiertos
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className={cn(
            "text-[11px] gap-1",
            kpi.compliance >= 80 ? "text-success border-success/30" :
            kpi.compliance >= 60 ? "text-warning border-warning/30" :
            "text-destructive border-destructive/30"
          )}>
            {kpi.compliance}% compliance
          </Badge>
        </div>
      </div>

      {/* KPIs SLA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {kpiCards.map(k => (
          <Card key={k.label} className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", k.bg)}>
                  <k.Icon className={cn("h-3.5 w-3.5", k.color)} />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{k.label}</p>
              </div>
              <p className="text-2xl font-black tabular-nums leading-none">{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Acciones recomendadas */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold">Próximas acciones recomendadas</h4>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {recommendedActions.length} {recommendedActions.length === 1 ? "acción" : "acciones"}
            </Badge>
          </div>

          {recommendedActions.length === 0 ? (
            <div className="py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm font-semibold">Todo bajo control</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                No hay casos que requieran acción inmediata. Buen trabajo 👌
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recommendedActions.map(a => (
                <div
                  key={a.ticket.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors group"
                >
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border", urgencyTone[a.urgency])}>
                    <a.Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[11px] font-mono font-bold text-muted-foreground">{a.ticket.ticket_id}</code>
                      <Badge variant="outline" className={cn("text-[9px] h-4 uppercase", urgencyTone[a.urgency])}>
                        {a.urgency}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] h-4">
                        {a.ticket.estado}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold leading-snug mt-0.5 line-clamp-1">
                      {a.action}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      <span className="font-medium text-foreground">{a.ticket.asunto}</span> · {a.reason}
                    </p>
                  </div>
                  {onOpenTicket && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenTicket(a.ticket)}
                      className="h-7 text-[11px] gap-1 shrink-0 opacity-70 group-hover:opacity-100"
                    >
                      <Eye className="h-3 w-3" /> Ver
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mini leyenda explicativa */}
      <Card className="border-dashed border-border/40 bg-muted/10">
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Cómo se calcula:</span> cada caso abierto se evalúa contra el SLA del cliente (tabla
            {" "}<code className="text-[10px] bg-muted/60 px-1 rounded">client_slas</code> por prioridad). «Dentro» = &lt;70% del tiempo consumido; «En riesgo» = 70-99%; «Vencido» = &gt;100%.
            Las acciones se generan por reglas (sin IA) sobre SLA, responsable, estado y antigüedad.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
