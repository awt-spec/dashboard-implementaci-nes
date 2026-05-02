import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Inbox, Building2, Clock, Lock, AlertTriangle, Flame, User,
  ChevronDown, ChevronRight, CheckCheck, Eye, RefreshCw, Radio, Zap,
  Search, X, ArrowUpDown, SlidersHorizontal, Plus, Check, RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ListMinus } from "lucide-react";
import { ReopenBadge } from "./ReopenBadge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSupportClients, useUpdateSupportTicket, type SupportTicket } from "@/hooks/useSupportTickets";
import { useTicketsSLAStatus } from "@/hooks/useTicketsSLAStatus";
import { useAuth } from "@/hooks/useAuth";
import { TicketDetailSheet } from "./TicketDetailSheet";

// ─── Hook: tickets "en bandeja" ──────────────────────────────────────────
// Por default mostramos los estados activos (PENDIENTE + EN ATENCIÓN). Cuando
// el usuario activa el filtro "Cerrados" o "Histórico", el hook se reactiva
// con el set expandido. Feedback COO 30/04: "cuando cierro un caso, ¿dónde
// lo veo?". La respuesta es ahora el chip "Cerrados" en la toolbar.
const ACTIVE_STATES = ["PENDIENTE", "EN ATENCIÓN"];
const CLOSED_STATES = ["CERRADA", "ANULADA", "ENTREGADA", "APROBADA"];
const ALL_STATES = [
  ...ACTIVE_STATES, ...CLOSED_STATES,
  "VALORACIÓN", "COTIZADA", "POR CERRAR", "ON HOLD",
];

function useInboxTickets(includeHistory: boolean) {
  return useQuery({
    queryKey: ["support-inbox", includeHistory ? "all" : "active"],
    queryFn: async () => {
      const states = includeHistory ? ALL_STATES : ACTIVE_STATES;
      const { data, error } = await (supabase
        .from("support_tickets")
        .select("*") as any)
        .in("estado", states)
        .order("updated_at", { ascending: false })
        .limit(includeHistory ? 500 : 200);
      if (error) throw error;
      return (data || []) as SupportTicket[];
    },
    staleTime: 30 * 1000,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

function priorityStyle(prio?: string | null) {
  if (!prio) return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", Icon: User };
  if (/critica/i.test(prio)) return { bg: "bg-destructive/15", text: "text-destructive", border: "border-destructive/40", Icon: Flame };
  if (prio === "Alta")       return { bg: "bg-warning/15",     text: "text-warning",     border: "border-warning/40",     Icon: AlertTriangle };
  if (prio === "Media")      return { bg: "bg-info/10",        text: "text-info",        border: "border-info/30",        Icon: Clock };
  return { bg: "bg-muted/40", text: "text-muted-foreground", border: "border-border", Icon: User };
}

function sourceIcon(fuente?: string | null) {
  if (fuente === "cliente") return { Icon: Radio, label: "Portal cliente", color: "text-primary" };
  if (fuente === "email")   return { Icon: Inbox, label: "Email",          color: "text-info" };
  if (fuente === "devops")  return { Icon: Zap,   label: "DevOps",         color: "text-violet-500" };
  return { Icon: User, label: "Interno", color: "text-muted-foreground" };
}

// ─── Props ───────────────────────────────────────────────────────────────

interface Props {
  /** Si se especifica, solo muestra tickets de ese cliente. */
  clientId?: string;
  /** Nombre del cliente para mostrar en el título cuando mode='client'. */
  clientName?: string;
  /** mode='client' adapta UI para vista de un solo cliente:
   *  • Título "Casos de [Cliente]" en lugar de "Bandeja"
   *  • Default groupBy='estado' (no 'cliente' — solo hay 1)
   *  • Oculta opción "Por cliente" del groupBy select
   *  • Quita filtros que no aportan en single-client (ej. agrupado por cliente) */
  mode?: "inbox" | "client";
  onOpenTicket?: (ticket: SupportTicket) => void;
  /** Callback opcional para crear un nuevo caso (botón en header). */
  onNewTicket?: () => void;
}

// ─── Componente principal ───────────────────────────────────────────────

export function SupportInbox({ clientId, clientName, mode = "inbox", onOpenTicket, onNewTicket }: Props) {
  const isClientMode = mode === "client";

  // UX controls — declarados PRIMERO porque otros derivados (includeHistory)
  // dependen de quickFilter. Mover esto abajo causa ReferenceError (TDZ) y
  // pantalla en blanco — bug detectado 30/04 al introducir el chip "Cerrados".
  const [quickFilter, setQuickFilter] = useState<"all" | "critical" | "new24h" | "cliente" | "pendiente" | "enatencion" | "sla_overdue" | "sla_warning" | "reincidentes" | "cerrados">("all");
  const [search, setSearch] = useState("");
  // Default sort: prioridad en bandeja triage; antigüedad en vista cliente
  // (un solo cliente, no compite con otros — antigüedad es la señal natural).
  const [sortBy, setSortBy] = useState<"priority" | "age" | "client">(isClientMode ? "age" : "priority");
  // Default groupBy: por cliente en bandeja, por estado en client view (no
  // tiene sentido agrupar por cliente cuando solo hay 1).
  const [groupBy, setGroupBy] = useState<"cliente" | "prioridad" | "estado" | "antiguedad" | "sla" | "flat">(isClientMode ? "estado" : "cliente");

  // Cargamos histórico solo cuando el filtro lo pide — keeps default light.
  const includeHistory = quickFilter === "cerrados";
  const { data: tickets = [], isLoading, refetch } = useInboxTickets(includeHistory);
  const { data: clients = [] } = useSupportClients();
  // SLA con jerarquía: cliente override > política global. Sólo el server-side
  // sabe si un ticket cae bajo override del cliente o bajo política v4.5.
  const { byId: slaByTicketId } = useTicketsSLAStatus();
  const update = useUpdateSupportTicket();
  const qc = useQueryClient();
  const { user, profile } = useAuth();

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Re-lookup desde la lista para que los cambios optimistic (via useUpdateSupportTicket)
  // se reflejen sin cerrar/reabrir el sheet.
  const selectedTicket: SupportTicket | null = useMemo(
    () => selectedTicketId ? (tickets.find(t => t.id === selectedTicketId) ?? null) : null,
    [tickets, selectedTicketId],
  );

  // ── Filtro por cliente scoped ──
  const scopedTickets = useMemo(() => {
    if (!clientId) return tickets;
    return tickets.filter(t => t.client_id === clientId);
  }, [tickets, clientId]);

  // Tickets categorizados por SLA — separados por fuente para etiquetas correctas
  const slaCounts = useMemo(() => {
    let overdue = 0, warning = 0, ok = 0;
    let overdueClient = 0, overduePolicy = 0;
    scopedTickets.forEach(t => {
      const s = slaByTicketId.get(t.id);
      if (!s) return;
      if (s.status === "overdue") {
        overdue++;
        if (s.source === "client_override") overdueClient++;
        else if (s.source === "policy_v4.5") overduePolicy++;
      } else if (s.status === "warning") {
        warning++;
      } else if (s.status === "ok") {
        ok++;
      }
    });
    return { overdue, warning, ok, overdueClient, overduePolicy };
  }, [scopedTickets, slaByTicketId]);

  // ── Filtro por quickFilter + search ──
  const filteredTickets = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const q = search.trim().toLowerCase();
    return scopedTickets.filter(t => {
      if (quickFilter === "critical" && !/critica/i.test(t.prioridad || "")) return false;
      if (quickFilter === "new24h" && new Date(t.created_at).getTime() < dayAgo) return false;
      if (quickFilter === "cliente" && t.fuente !== "cliente") return false;
      if (quickFilter === "pendiente" && t.estado !== "PENDIENTE") return false;
      if (quickFilter === "enatencion" && t.estado !== "EN ATENCIÓN") return false;
      if (quickFilter === "sla_overdue" && slaByTicketId.get(t.id)?.status !== "overdue") return false;
      if (quickFilter === "sla_warning" && slaByTicketId.get(t.id)?.status !== "warning") return false;
      if (quickFilter === "reincidentes" && (t.reopen_count ?? 0) < 2) return false;
      // Filtro Cerrados — solo estados de cierre / entrega final
      if (quickFilter === "cerrados" && !["CERRADA","ANULADA","ENTREGADA","APROBADA"].includes(t.estado)) return false;
      if (q && !(t.ticket_id?.toLowerCase().includes(q) || t.asunto?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [scopedTickets, quickFilter, search, slaByTicketId]);

  // ── Grouping + sorting genérico ──
  const grouped = useMemo(() => {
    interface Group {
      key: string;
      label: string;
      sublabel?: string;
      IconTag: any;
      iconTone: string;
      items: SupportTicket[];
      critical: number;
      fromClient: number;
      pending: number;
      total: number;
      /** Peso numérico para orden relativo (menor = arriba). */
      weight: number;
    }

    // Helper: enriquece items de un grupo con contadores
    const makeGroup = (partial: Omit<Group, "critical" | "fromClient" | "pending" | "total">): Group => {
      const critical = partial.items.filter(t => /critica/i.test(t.prioridad || "")).length;
      const fromClient = partial.items.filter(t => t.fuente === "cliente").length;
      const pending = partial.items.filter(t => t.estado === "PENDIENTE").length;
      return { ...partial, critical, fromClient, pending, total: partial.items.length };
    };

    // Sort interno de items dentro de cada grupo
    // Default: PENDIENTE primero, luego por created_at desc
    const sortItems = (items: SupportTicket[]) =>
      items.sort((a, b) => {
        if (a.estado === "PENDIENTE" && b.estado !== "PENDIENTE") return -1;
        if (b.estado === "PENDIENTE" && a.estado !== "PENDIENTE") return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    // Sort por severidad SLA: más excedidos arriba (para Fuera SLA / antigüedad)
    // - Vencidos: ranking por (días_excedidos), de mayor a menor
    // - Resto: por antigüedad pura (más viejos arriba)
    const sortBySLASeverity = (items: SupportTicket[]) =>
      items.sort((a, b) => {
        const sa = slaByTicketId.get(a.id);
        const sb = slaByTicketId.get(b.id);
        const exA = sa ? sa.daysElapsed - sa.deadlineDays : -Infinity;
        const exB = sb ? sb.daysElapsed - sb.deadlineDays : -Infinity;
        if (exA !== exB) return exB - exA;
        // tie-breaker: caso más viejo primero
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    let groups: Group[] = [];

    if (groupBy === "flat") {
      // Si el filtro activo es SLA, ordenar por severidad (más excedidos arriba)
      const isSLAFilter = quickFilter === "sla_overdue" || quickFilter === "sla_warning";
      groups = [makeGroup({
        key: "all",
        label: isSLAFilter
          ? (quickFilter === "sla_overdue" ? "Casos con plazo vencido · ordenados por severidad" : "Casos en riesgo · ordenados por días restantes")
          : "Todos los casos",
        IconTag: isSLAFilter ? AlertTriangle : Inbox,
        iconTone: isSLAFilter ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10",
        items: isSLAFilter ? sortBySLASeverity([...filteredTickets]) : sortItems([...filteredTickets]),
        weight: 0,
      })];
    } else if (groupBy === "prioridad") {
      const buckets = [
        { key: "critica", label: "Crítica", match: (t: SupportTicket) => /critica/i.test(t.prioridad || ""), IconTag: Flame, iconTone: "text-destructive bg-destructive/10", weight: 0 },
        { key: "alta",    label: "Alta",    match: (t: SupportTicket) => t.prioridad === "Alta",             IconTag: AlertTriangle, iconTone: "text-warning bg-warning/10", weight: 1 },
        { key: "media",   label: "Media",   match: (t: SupportTicket) => t.prioridad === "Media",            IconTag: Clock, iconTone: "text-info bg-info/10", weight: 2 },
        { key: "baja",    label: "Baja",    match: (t: SupportTicket) => t.prioridad === "Baja",             IconTag: Clock, iconTone: "text-muted-foreground bg-muted/40", weight: 3 },
      ];
      groups = buckets
        .map(b => makeGroup({ ...b, items: sortItems(filteredTickets.filter(b.match)) }))
        .filter(g => g.total > 0);
    } else if (groupBy === "estado") {
      const buckets = [
        { key: "PENDIENTE",    label: "PENDIENTE",    IconTag: Clock,         iconTone: "text-warning bg-warning/10", weight: 0 },
        { key: "EN ATENCIÓN",  label: "EN ATENCIÓN",  IconTag: AlertTriangle, iconTone: "text-info bg-info/10",        weight: 1 },
      ];
      groups = buckets
        .map(b => makeGroup({
          key: b.key, label: b.label, IconTag: b.IconTag, iconTone: b.iconTone, weight: b.weight,
          items: sortItems(filteredTickets.filter(t => t.estado === b.key)),
        }))
        .filter(g => g.total > 0);
    } else if (groupBy === "sla") {
      const buckets = [
        { key: "overdue", label: "Plazo vencido", IconTag: AlertTriangle, iconTone: "text-destructive bg-destructive/10", weight: 0,
          match: (t: SupportTicket) => slaByTicketId.get(t.id)?.status === "overdue", useSeveritySort: true },
        { key: "warning", label: "En riesgo (≥75% del plazo)", IconTag: Clock, iconTone: "text-warning bg-warning/10", weight: 1,
          match: (t: SupportTicket) => slaByTicketId.get(t.id)?.status === "warning", useSeveritySort: true },
        { key: "ok",      label: "Dentro de plazo", IconTag: CheckCheck, iconTone: "text-success bg-success/10", weight: 2,
          match: (t: SupportTicket) => slaByTicketId.get(t.id)?.status === "ok", useSeveritySort: false },
        { key: "no-sla",  label: "Sin plazo aplicable", IconTag: User, iconTone: "text-muted-foreground bg-muted/40", weight: 3,
          match: (t: SupportTicket) => {
            const s = slaByTicketId.get(t.id);
            return !s || s.status === "no_sla";
          }, useSeveritySort: false },
      ];
      groups = buckets
        .map(b => makeGroup({
          key: b.key, label: b.label, IconTag: b.IconTag, iconTone: b.iconTone, weight: b.weight,
          // En "Fuera SLA" y "En riesgo": ordenar por severidad (más excedidos arriba)
          items: b.useSeveritySort
            ? sortBySLASeverity(filteredTickets.filter(b.match))
            : sortItems(filteredTickets.filter(b.match)),
        }))
        .filter(g => g.total > 0);
    } else if (groupBy === "antiguedad") {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const buckets = [
        { key: "hoy",     label: "Hoy",              min: 0,         max: 1,      IconTag: Zap,           iconTone: "text-primary bg-primary/10",          weight: 0 },
        { key: "semana",  label: "Esta semana",      min: 1,         max: 7,      IconTag: Clock,         iconTone: "text-info bg-info/10",                weight: 1 },
        { key: "mes",     label: "Este mes",         min: 7,         max: 30,     IconTag: Clock,         iconTone: "text-warning bg-warning/10",          weight: 2 },
        { key: "viejos",  label: "Más de un mes",    min: 30,        max: Infinity, IconTag: AlertTriangle, iconTone: "text-destructive bg-destructive/10", weight: 3 },
      ];
      groups = buckets
        .map(b => {
          const items = filteredTickets.filter(t => {
            const daysOld = (now - new Date(t.created_at).getTime()) / dayMs;
            return daysOld >= b.min && daysOld < b.max;
          });
          return makeGroup({ key: b.key, label: b.label, IconTag: b.IconTag, iconTone: b.iconTone, weight: b.weight, items: sortItems(items) });
        })
        .filter(g => g.total > 0);
    } else {
      // cliente (default)
      const byClient = new Map<string, SupportTicket[]>();
      filteredTickets.forEach(t => {
        if (!byClient.has(t.client_id)) byClient.set(t.client_id, []);
        byClient.get(t.client_id)!.push(t);
      });
      groups = Array.from(byClient.entries()).map(([id, items]) => {
        const client = clients.find(c => c.id === id);
        return makeGroup({
          key: id,
          label: client?.name || id,
          sublabel: client?.nivel_servicio || "Base",
          IconTag: Building2,
          iconTone: "text-primary bg-primary/10",
          items: sortItems(items),
          weight: 0, // se usa sortBy abajo para orden entre grupos
        });
      });
    }

    // Orden entre grupos según sortBy (aplica cuando groupBy = cliente). Para
    // otros agrupadores, respetamos el weight (orden natural: críticos primero, etc.)
    if (groupBy === "cliente") {
      groups.sort((a, b) => {
        if (sortBy === "client") return a.label.localeCompare(b.label);
        if (sortBy === "age") {
          const oldestA = Math.min(...a.items.map(t => new Date(t.created_at).getTime()));
          const oldestB = Math.min(...b.items.map(t => new Date(t.created_at).getTime()));
          return oldestA - oldestB;
        }
        // priority
        if (a.critical !== b.critical) return b.critical - a.critical;
        if (a.fromClient !== b.fromClient) return b.fromClient - a.fromClient;
        return b.pending - a.pending;
      });
    } else {
      groups.sort((a, b) => a.weight - b.weight);
    }

    return groups;
  }, [filteredTickets, clients, sortBy, groupBy, quickFilter, slaByTicketId]);

  // ── Urgent spotlight: top 3 tickets más críticos globalmente ──
  const urgentSpotlight = useMemo(() => {
    const now = Date.now();
    const score = (t: SupportTicket) => {
      const hoursOld = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
      const isCritical = /critica/i.test(t.prioridad || "") ? 100 : 0;
      const isHigh = t.prioridad === "Alta" ? 40 : 0;
      const isPending = t.estado === "PENDIENTE" ? 30 : 0;
      const fromClient = t.fuente === "cliente" ? 20 : 0;
      const ageBonus = Math.min(hoursOld / 24, 10) * 2; // +2 por día, max +20
      return isCritical + isHigh + isPending + fromClient + ageBonus;
    };
    return [...scopedTickets]
      .sort((a, b) => score(b) - score(a))
      .slice(0, 3)
      .filter(t => score(t) >= 50); // solo si realmente es urgente
  }, [scopedTickets]);

  // ── Realtime subscription: escucha INSERT + UPDATE para refrescar sin polling ──
  useEffect(() => {
    const channel = supabase
      .channel("support-inbox-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        (payload) => {
          const t = payload.new as SupportTicket;
          if (!INBOX_STATES.includes(t.estado)) return;
          if (clientId && t.client_id !== clientId) return;

          const client = clients.find(c => c.id === t.client_id);
          const isCritical = /critica/i.test(t.prioridad || "");

          toast.success(
            <div className="flex items-start gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                isCritical ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary"
              }`}>
                <Inbox className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">Nuevo caso de {client?.name || t.client_id}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{t.ticket_id} · {t.asunto}</p>
                {isCritical && <p className="text-[11px] text-destructive font-bold mt-0.5">🔥 Prioridad crítica</p>}
              </div>
            </div>,
            { duration: isCritical ? 15000 : 6000 }
          );

          setRecentlyAdded(prev => new Set(prev).add(t.id));
          setTimeout(() => {
            setRecentlyAdded(prev => {
              const n = new Set(prev); n.delete(t.id); return n;
            });
          }, 3000);

          qc.invalidateQueries({ queryKey: ["support-inbox"] });
          qc.invalidateQueries({ queryKey: ["support-tickets"] });
          qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets" },
        () => {
          // Cualquier cambio en tickets refresca la bandeja (el filter se aplica en la query)
          qc.invalidateQueries({ queryKey: ["support-inbox"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId, clients, qc]);

  const toggleGroup = (id: string) => {
    const n = new Set(collapsed);
    if (n.has(id)) n.delete(id); else n.add(id);
    setCollapsed(n);
  };

  const handleAcknowledge = async (ticket: SupportTicket) => {
    try {
      // Atender = mover a EN ATENCIÓN + auto-asignar al usuario actual
      // si el ticket no tiene responsable todavía.
      const updates: Record<string, unknown> = { estado: "EN ATENCIÓN" };
      if ((!ticket.responsable || ticket.responsable === "—") && profile?.full_name) {
        updates.responsable = profile.full_name;
      }
      if (!ticket.assigned_user_id && user?.id) {
        updates.assigned_user_id = user.id;
      }
      await update.mutateAsync({ id: ticket.id, updates });
      toast.success(`${ticket.ticket_id} → en atención`, {
        description: updates.responsable
          ? `Asignado a ${profile?.full_name}`
          : "Mantiene responsable actual",
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // KPIs sobre el scope (cliente o todos), NO sobre el filtro quick — así los
  // totales en las cards reflejan el estado global y el filtro es visual.
  const totalPending    = scopedTickets.filter(t => t.estado === "PENDIENTE").length;
  const totalEnAtencion = scopedTickets.filter(t => t.estado === "EN ATENCIÓN").length;
  const totalCritical   = scopedTickets.filter(t => /critica/i.test(t.prioridad || "")).length;
  const totalFromCliente = scopedTickets.filter(t => t.fuente === "cliente").length;
  const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
  const totalNew24h = scopedTickets.filter(t => new Date(t.created_at).getTime() >= dayAgoMs).length;
  const totalReincidentes = scopedTickets.filter(t => (t.reopen_count ?? 0) >= 2).length;

  const CHIPS: Array<{ key: typeof quickFilter; label: string; count: number; Icon: any; tone: string; emphasis?: boolean }> = [
    { key: "all",          label: "Todos",         count: scopedTickets.length, Icon: Inbox,          tone: "" },
    // Plazo vencido (incluye política + SLA cliente). El detalle por fuente
    // se muestra en el banner y en cada badge individual.
    { key: "sla_overdue",  label: "Plazo vencido", count: slaCounts.overdue,    Icon: AlertTriangle,  tone: "text-destructive", emphasis: slaCounts.overdue > 0 },
    { key: "sla_warning",  label: "En riesgo",     count: slaCounts.warning,    Icon: Clock,          tone: "text-warning", emphasis: slaCounts.warning > 0 },
    // — divider visual —
    { key: "critical",     label: "Críticos",      count: totalCritical,        Icon: Flame,          tone: "text-destructive" },
    { key: "new24h",       label: "Nuevos 24h",    count: totalNew24h,          Icon: Zap,            tone: "text-primary" },
    { key: "cliente",      label: "De cliente",    count: totalFromCliente,     Icon: Radio,          tone: "text-primary" },
    { key: "pendiente",    label: "PENDIENTE",     count: totalPending,         Icon: Clock,          tone: "text-warning" },
    { key: "enatencion",   label: "EN ATENCIÓN",   count: totalEnAtencion,      Icon: AlertTriangle,  tone: "text-info" },
    { key: "reincidentes", label: "Reincidentes (≥2)", count: totalReincidentes, Icon: RotateCcw,     tone: "text-warning", emphasis: totalReincidentes > 0 },
    // Histórico — abre la query expandida para ver CERRADA/ANULADA/ENTREGADA/APROBADA
    { key: "cerrados",     label: "Cerrados",      count: includeHistory ? scopedTickets.filter(t => ["CERRADA","ANULADA","ENTREGADA","APROBADA"].includes(t.estado)).length : 0, Icon: CheckCheck, tone: "text-muted-foreground" },
  ];

  const hasActiveFilters = quickFilter !== "all" || search.trim().length > 0;

  // ── Etiquetas legibles para el chip de "Vista" actual ──
  const GROUP_LABELS: Record<typeof groupBy, string> = {
    cliente: "Cliente",
    prioridad: "Prioridad",
    estado: "Estado",
    antiguedad: "Antigüedad",
    sla: "SLA",
    flat: "Plana",
  };
  const SORT_LABELS: Record<typeof sortBy, string> = {
    priority: "más críticos",
    age: "más viejos",
    client: "A→Z",
  };
  // Cuando groupBy != cliente, el orden es implícito (críticos arriba en prioridad,
  // PENDIENTE arriba en estado, etc.) → no mostramos sortBy en el chip.
  const viewSummary = groupBy === "cliente"
    ? `${GROUP_LABELS[groupBy]} · ${SORT_LABELS[sortBy]}`
    : GROUP_LABELS[groupBy];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Inbox className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold">
              {isClientMode && clientName
                ? `Casos de ${clientName}`
                : "Bandeja de Entrada"}
            </h2>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Radio className="h-3 w-3 text-success animate-pulse" />
              {isClientMode ? `${scopedTickets.length} casos · sincronizado en vivo` : "Escuchando en vivo"}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-8 gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refrescar
          </Button>
          {onNewTicket && (
            <Button size="sm" onClick={onNewTicket} className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Nuevo caso
            </Button>
          )}
        </div>
      </div>

      {/* ════ BANNER SLA URGENTE — separa fuente: política vs SLA cliente ════ */}
      {slaCounts.overdue > 0 && quickFilter !== "sla_overdue" && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-destructive/40 bg-gradient-to-r from-destructive/[0.06] via-destructive/[0.02] to-transparent overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-full bg-destructive/15 flex items-center justify-center shrink-0 animate-pulse">
              <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-destructive">
                {slaCounts.overdue} {slaCounts.overdue === 1 ? "boleta vencida" : "boletas vencidas"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {slaCounts.overduePolicy > 0 && (
                  <>
                    <strong>{slaCounts.overduePolicy}</strong> fuera de <strong>política</strong>
                  </>
                )}
                {slaCounts.overduePolicy > 0 && slaCounts.overdueClient > 0 && " · "}
                {slaCounts.overdueClient > 0 && (
                  <>
                    <strong>{slaCounts.overdueClient}</strong> fuera de <strong>SLA cliente</strong>
                  </>
                )}
                {slaCounts.warning > 0 && ` · ${slaCounts.warning} en riesgo (≥75%)`}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("overdue:open", clientId ? { detail: { clientId } } : undefined))}
              className="h-8 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Eye className="h-3.5 w-3.5" /> Ver vencidas
            </Button>
          </div>
        </motion.div>
      )}

      {/* Urgent spotlight — top 3 más urgentes globalmente.
          Grid adaptable: 1 col mobile, 2 col tablet (sm/md), 3 col solo en xl
          para que el ticket_id no se parta en líneas. */}
      {urgentSpotlight.length > 0 && (
        <Card className="border-destructive/40 bg-gradient-to-r from-destructive/5 to-transparent">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
                <Flame className="h-3.5 w-3.5 text-destructive" />
              </div>
              <p className="text-xs font-bold">Atención inmediata</p>
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 shrink-0">
                {urgentSpotlight.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {urgentSpotlight.map(t => {
                const s = priorityStyle(t.prioridad);
                // Estado abreviado para que quepa siempre en el badge
                const estadoShort =
                  t.estado === "EN ATENCIÓN" ? "Atención" :
                  t.estado === "PENDIENTE"   ? "Pendiente" :
                  t.estado;
                const estadoClass =
                  t.estado === "EN ATENCIÓN" ? "bg-info/15 text-info border-info/40" :
                  t.estado === "PENDIENTE"   ? "bg-warning/15 text-warning border-warning/40" :
                  "bg-muted/40 text-muted-foreground border-border";
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTicketId(t.id); setDetailOpen(true); }}
                    className={cn(
                      "text-left p-2.5 rounded-lg border transition-colors hover:bg-muted/30 min-w-0",
                      s.border, "bg-card"
                    )}
                  >
                    {/* Header del card: icono + id (truncado) + estado.
                        min-w-0 + truncate evita que el ticket_id rompa columnas */}
                    <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                      <s.Icon className={cn("h-3 w-3 shrink-0", s.text)} />
                      <code className="text-[10px] font-mono font-bold text-muted-foreground truncate flex-1 min-w-0" title={t.ticket_id}>
                        {t.ticket_id}
                      </code>
                      {(t.reopen_count ?? 0) > 0 && (
                        <ReopenBadge count={t.reopen_count} lastReason={t.last_reopen_reason} lastReopenAt={t.last_reopen_at} size="sm" />
                      )}
                      <span
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1 h-4 px-1.5 rounded text-[9px] font-bold border whitespace-nowrap",
                          estadoClass
                        )}
                      >
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {estadoShort}
                      </span>
                    </div>
                    <p className="text-xs font-semibold line-clamp-2 leading-snug break-words">{t.asunto}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ════ TOOLBAR UNIFICADO ════
          Una sola línea (con wrap) que reemplaza:
            • KPI cards (sus métricas viven dentro de los chips)
            • Fila separada de Vista/Orden (ahora en popover único)
          Lectura izquierda → derecha:
            [chips de filtro] · [vista popover] · [search]
      */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filtros rápidos como chips compactos con count */}
        <div className="flex items-center gap-1 flex-wrap">
          {CHIPS.map(chip => {
            const active = quickFilter === chip.key;
            const isSLA = chip.key === "sla_overdue" || chip.key === "sla_warning";
            const isOverdueChip = chip.key === "sla_overdue";
            return (
              <button
                key={chip.key}
                onClick={() => setQuickFilter(chip.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-all",
                  active
                    ? isOverdueChip
                      ? "bg-destructive text-destructive-foreground border-destructive shadow-sm"
                      : chip.key === "sla_warning"
                      ? "bg-warning text-warning-foreground border-warning shadow-sm"
                      : "bg-primary text-primary-foreground border-primary shadow-sm"
                    : chip.emphasis && isOverdueChip
                    ? "bg-destructive/[0.06] hover:bg-destructive/[0.12] border-destructive/40 text-destructive ring-2 ring-destructive/20 animate-pulse"
                    : chip.emphasis && chip.key === "sla_warning"
                    ? "bg-warning/[0.06] hover:bg-warning/[0.12] border-warning/40 text-warning"
                    : isSLA
                    ? "bg-card hover:bg-muted/40 border-border text-muted-foreground"
                    : "bg-card hover:bg-muted/40 border-border text-foreground/70 hover:text-foreground",
                )}
              >
                <chip.Icon className={cn("h-3.5 w-3.5", !active && chip.tone)} />
                <span>{chip.label}</span>
                {chip.count > 0 && (
                  <span className={cn(
                    "tabular-nums px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    active ? (isOverdueChip ? "bg-destructive-foreground/20" : chip.key === "sla_warning" ? "bg-warning-foreground/20" : "bg-primary-foreground/20")
                    : chip.emphasis && isOverdueChip ? "bg-destructive/15"
                    : chip.emphasis && chip.key === "sla_warning" ? "bg-warning/15"
                    : "bg-muted/80 text-muted-foreground"
                  )}>
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Separador visual sutil */}
        <div className="hidden md:block h-6 w-px bg-border" />

        {/* Botón único "Vista" — abre popover con groupBy + sortBy */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card hover:bg-muted/40 text-xs font-medium transition-colors">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Vista:</span>
              <span className="font-bold">{viewSummary}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3 space-y-3">
            {/* GROUP BY: agrupar */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Agrupar por
              </p>
              <div className="grid grid-cols-1 gap-0.5">
                {[
                  // "Cliente" se oculta en modo client view — no aporta agrupar
                  // por cliente cuando solo hay 1 cliente activo.
                  ...(isClientMode ? [] : [{ v: "cliente" as const, Icon: Building2, label: "Cliente", hint: "Cada cliente es un grupo" }]),
                  { v: "prioridad" as const,  Icon: Flame,         label: "Prioridad",  hint: "Crítica → Alta → Media → Baja" },
                  { v: "estado" as const,     Icon: AlertTriangle, label: "Estado",     hint: "PENDIENTE → EN ATENCIÓN" },
                  { v: "sla" as const,        Icon: Clock,         label: "Plazo",      hint: "Vencidos → En riesgo → OK · separa Política vs SLA cliente" },
                  { v: "antiguedad" as const, Icon: Clock,         label: "Antigüedad", hint: "Hoy → Esta semana → Mes → +1 mes" },
                  { v: "flat" as const,       Icon: ListMinus,     label: "Plana",      hint: "Sin grupos, lista única" },
                ].map((opt) => {
                  const active = groupBy === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => setGroupBy(opt.v)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                        active ? "bg-primary/10 text-primary" : "hover:bg-muted/40"
                      )}
                    >
                      <opt.Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.hint}</p>
                      </div>
                      {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SORT BY: solo aplica con groupBy=cliente (en otros casos el orden
                es implícito: críticos arriba, etc.) */}
            {groupBy === "cliente" && (
              <div className="space-y-1.5 pt-3 border-t border-border/60">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
                  <ArrowUpDown className="h-3 w-3" /> Ordenar clientes por
                </p>
                <div className="grid grid-cols-1 gap-0.5">
                  {[
                    { v: "priority" as const, Icon: Flame,     label: "Más críticos primero", hint: "Clientes con más casos críticos arriba" },
                    { v: "age" as const,      Icon: Clock,     label: "Casos más viejos",     hint: "Clientes con casos más antiguos arriba" },
                    { v: "client" as const,   Icon: Building2, label: "Alfabético (A→Z)",     hint: "Por nombre de cliente" },
                  ].map((opt) => {
                    const active = sortBy === opt.v;
                    return (
                      <button
                        key={opt.v}
                        onClick={() => setSortBy(opt.v)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                          active ? "bg-primary/10 text-primary" : "hover:bg-muted/40"
                        )}
                      >
                        <opt.Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.hint}</p>
                        </div>
                        {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hint si no hay sortBy */}
            {groupBy !== "cliente" && (
              <p className="text-[10px] text-muted-foreground italic px-1 pt-1 border-t border-border/60">
                💡 Agrupando por <strong>{GROUP_LABELS[groupBy].toLowerCase()}</strong>: el orden es automático (críticos / pendientes / más antiguos primero).
              </p>
            )}
          </PopoverContent>
        </Popover>

        {/* Search — toma el espacio sobrante */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 pr-8 h-8 text-xs"
            placeholder="Buscar por ID o asunto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded hover:bg-muted/60 flex items-center justify-center"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Cargando bandeja…</CardContent></Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center flex flex-col items-center gap-3">
            {hasActiveFilters ? (
              <>
                <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center">
                  <SlidersHorizontal className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Sin resultados con estos filtros</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ajustá los chips o la búsqueda para ver tickets.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setQuickFilter("all"); setSearch(""); }} className="h-7 text-xs">
                  Limpiar filtros
                </Button>
              </>
            ) : (
              <>
                <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCheck className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Bandeja vacía 🎉</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No hay tickets pendientes. Los nuevos aparecerán aquí en tiempo real.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(group => {
            const isOpen = !collapsed.has(group.key);
            const Icon = group.IconTag;
            return (
              <Card key={group.key} className={group.critical > 0 ? "border-destructive/40" : ""}>
                <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.key)}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", group.iconTone)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <span className="truncate">{group.label}</span>
                            {group.sublabel && (
                              <Badge variant="outline" className="text-[10px]">
                                {group.sublabel}
                              </Badge>
                            )}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {groupBy !== "prioridad" && group.critical > 0 && (
                            <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] gap-0.5">
                              <Flame className="h-3 w-3" /> {group.critical}
                            </Badge>
                          )}
                          {group.fromClient > 0 && (
                            <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] gap-0.5">
                              <Radio className="h-3 w-3" /> {group.fromClient}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] tabular-nums">{group.total}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="space-y-2 pt-0">
                      <AnimatePresence initial={false}>
                        {group.items.map(t => {
                          const s = priorityStyle(t.prioridad);
                          const src = sourceIcon(t.fuente);
                          const isNew = recentlyAdded.has(t.id);
                          const sla = slaByTicketId.get(t.id);
                          const isOverdueSLA = sla?.status === "overdue";
                          const isWarningSLA = sla?.status === "warning";
                          return (
                            <motion.div
                              key={t.id}
                              initial={isNew ? { opacity: 0, y: -8, scale: 0.95 } : false}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, height: 0 }}
                              className={cn(
                                "flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors",
                                // Border-left grueso si vencido (alerta visual fuerte)
                                isOverdueSLA ? "border-destructive/60 border-l-4 bg-destructive/[0.03]" :
                                isWarningSLA ? "border-warning/50 border-l-4 bg-warning/[0.02]" :
                                s.border,
                                isNew ? "ring-2 ring-primary/40 bg-primary/5" : "hover:bg-muted/20",
                                !isOverdueSLA && !isWarningSLA && !isNew && "bg-card"
                              )}
                            >
                              <div className={`h-8 w-8 rounded-md ${s.bg} flex items-center justify-center shrink-0`}>
                                <s.Icon className={`h-4 w-4 ${s.text}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <code className="text-[11px] font-mono font-bold text-muted-foreground">{t.ticket_id}</code>
                                  {(t.reopen_count ?? 0) > 0 && (
                                    <ReopenBadge count={t.reopen_count} lastReason={t.last_reopen_reason} lastReopenAt={t.last_reopen_at} size="sm" />
                                  )}
                                  {t.is_confidential && (
                                    <span title="Confidencial" className="inline-flex items-center justify-center h-4 w-4 rounded bg-warning/10 text-warning">
                                      <Lock className="h-2.5 w-2.5" />
                                    </span>
                                  )}
                                  <span title={src.label} className={cn("inline-flex items-center justify-center h-4 w-4 rounded bg-muted/40", src.color)}>
                                    <src.Icon className="h-2.5 w-2.5" />
                                  </span>
                                  {isNew && (
                                    <Badge className="bg-primary text-primary-foreground text-[10px] h-4 animate-pulse">NUEVO</Badge>
                                  )}
                                  <span className={cn(
                                    "inline-flex items-center gap-0.5 h-4 px-1.5 rounded text-[10px] font-semibold",
                                    s.bg, s.text
                                  )}>
                                    <s.Icon className="h-2.5 w-2.5" />
                                    {t.prioridad === "Critica, Impacto Negocio" ? "Crítica" : t.prioridad}
                                  </span>

                                  {/* Plazo badge — distingue fuente: política vs SLA cliente.
                                      "SLA" solo aparece cuando viene del contrato del cliente.
                                      Cuando viene de la política global, dice "Política". */}
                                  {sla && sla.status !== "no_sla" && (() => {
                                    const isClientSource = sla.source === "client_override";
                                    const sourceLabel = isClientSource ? "SLA Cliente" : "Política";
                                    const sourceTooltip = isClientSource
                                      ? `SLA del contrato del cliente: ${sla.deadlineDays}d · llevamos ${sla.daysElapsed}d`
                                      : `Política v4.5: ${sla.deadlineDays}d · llevamos ${sla.daysElapsed}d`;
                                    const SourceIcon = isClientSource ? Building2 : ListMinus;
                                    return (
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1 h-4 px-1.5 rounded text-[10px] font-bold border whitespace-nowrap",
                                          isOverdueSLA && "bg-destructive/15 text-destructive border-destructive/40 animate-pulse",
                                          isWarningSLA && "bg-warning/15 text-warning border-warning/40",
                                          sla.status === "ok" && "bg-success/10 text-success border-success/30"
                                        )}
                                        title={sourceTooltip}
                                      >
                                        <SourceIcon className="h-2.5 w-2.5" />
                                        {isOverdueSLA
                                          ? `+${sla.daysElapsed - sla.deadlineDays}d ${sourceLabel}`
                                          : isWarningSLA
                                          ? `${sla.deadlineDays - sla.daysElapsed}d (${sourceLabel})`
                                          : `${sourceLabel} ${sla.deadlineDays}d`}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <p className="text-sm font-medium mt-0.5 line-clamp-2">{t.asunto}</p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                  <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: es })}</span>
                                  <span>·</span>
                                  <span>{t.tipo}</span>
                                  {t.responsable && t.responsable !== "—" && (
                                    <>
                                      <span>·</span>
                                      <span className="truncate">{t.responsable.split(" ")[0]}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenTicket) onOpenTicket(t);
                                    else { setSelectedTicketId(t.id); setDetailOpen(true); }
                                  }}
                                  className="h-7 gap-1 text-[11px]"
                                >
                                  <Eye className="h-3 w-3" /> Ver
                                </Button>
                                {t.estado === "PENDIENTE" && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleAcknowledge(t); }}
                                    disabled={update.isPending}
                                    className="h-7 gap-1 text-[11px]"
                                  >
                                    <CheckCheck className="h-3 w-3" /> Atender
                                  </Button>
                                )}
                                {/* Cerrar rápido — solo en boletas vencidas SLA o EN ATENCIÓN
                                    Política v4.5 sugiere resolver inmediatamente lo vencido. */}
                                {(isOverdueSLA || t.estado === "EN ATENCIÓN") && (
                                  <Button
                                    size="sm"
                                    variant={isOverdueSLA ? "destructive" : "outline"}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (!confirm(`¿Cerrar ${t.ticket_id} como resuelto?`)) return;
                                      try {
                                        await update.mutateAsync({
                                          id: t.id,
                                          updates: {
                                            estado: "CERRADA",
                                            fecha_entrega: new Date().toISOString(),
                                          } as any,
                                        });
                                        toast.success(`${t.ticket_id} cerrado`, {
                                          description: isOverdueSLA ? "Resolución de boleta vencida SLA" : "Marcado como resuelto",
                                        });
                                      } catch (err: any) {
                                        toast.error(err.message);
                                      }
                                    }}
                                    disabled={update.isPending}
                                    className="h-7 gap-1 text-[11px]"
                                  >
                                    <Lock className="h-3 w-3" /> Cerrar
                                  </Button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sheet de detalle — se abre al click en "Ver" */}
      <TicketDetailSheet
        ticket={selectedTicket}
        open={detailOpen}
        onOpenChange={(o) => { setDetailOpen(o); if (!o) setSelectedTicketId(null); }}
        canEditInternal={true}
      />
    </div>
  );
}
