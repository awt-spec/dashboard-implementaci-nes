import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Inbox, Building2, Clock, Lock, AlertTriangle, Flame, User,
  ChevronDown, ChevronRight, CheckCheck, Eye, RefreshCw, Radio, Zap,
  Search, X, ArrowUpDown, SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSupportClients, useUpdateSupportTicket, type SupportTicket } from "@/hooks/useSupportTickets";
import { useAuth } from "@/hooks/useAuth";
import { TicketDetailSheet } from "./TicketDetailSheet";

// ─── Hook: tickets "en bandeja" (PENDIENTE, ordenados por creación) ─────

const INBOX_STATES = ["PENDIENTE", "EN ATENCIÓN"];

function useInboxTickets() {
  return useQuery({
    queryKey: ["support-inbox"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("support_tickets")
        .select("*") as any)
        .in("estado", INBOX_STATES)
        .order("created_at", { ascending: false })
        .limit(200);
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
  onOpenTicket?: (ticket: SupportTicket) => void;
}

// ─── Componente principal ───────────────────────────────────────────────

export function SupportInbox({ clientId, onOpenTicket }: Props) {
  const { data: tickets = [], isLoading, refetch } = useInboxTickets();
  const { data: clients = [] } = useSupportClients();
  const update = useUpdateSupportTicket();
  const qc = useQueryClient();
  const { user, profile } = useAuth();

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // UX controls
  const [quickFilter, setQuickFilter] = useState<"all" | "critical" | "new24h" | "cliente" | "pendiente" | "enatencion">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "age" | "client">("priority");

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
      if (q && !(t.ticket_id?.toLowerCase().includes(q) || t.asunto?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [scopedTickets, quickFilter, search]);

  // ── Agrupar por cliente ──
  const grouped = useMemo(() => {
    const byClient = new Map<string, SupportTicket[]>();
    filteredTickets.forEach(t => {
      if (!byClient.has(t.client_id)) byClient.set(t.client_id, []);
      byClient.get(t.client_id)!.push(t);
    });

    return Array.from(byClient.entries())
      .map(([id, items]) => {
        const client = clients.find(c => c.id === id);
        const critical = items.filter(t => /critica/i.test(t.prioridad || "")).length;
        const fromClient = items.filter(t => t.fuente === "cliente").length;
        const pending = items.filter(t => t.estado === "PENDIENTE").length;
        return {
          clientId: id,
          clientName: client?.name || id,
          nivelServicio: client?.nivel_servicio || "Base",
          items: items.sort((a, b) => {
            // pendientes primero, luego por fecha desc
            if (a.estado === "PENDIENTE" && b.estado !== "PENDIENTE") return -1;
            if (b.estado === "PENDIENTE" && a.estado !== "PENDIENTE") return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }),
          critical,
          fromClient,
          pending,
          total: items.length,
        };
      })
      .sort((a, b) => {
        // Orden por sortBy user-selected, fallback a críticos > cliente > pending
        if (sortBy === "client") return a.clientName.localeCompare(b.clientName);
        if (sortBy === "age") {
          const oldestA = Math.min(...a.items.map(t => new Date(t.created_at).getTime()));
          const oldestB = Math.min(...b.items.map(t => new Date(t.created_at).getTime()));
          return oldestA - oldestB; // más viejos primero
        }
        // priority (default)
        if (a.critical !== b.critical) return b.critical - a.critical;
        if (a.fromClient !== b.fromClient) return b.fromClient - a.fromClient;
        return b.pending - a.pending;
      });
  }, [filteredTickets, clients, sortBy]);

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

  const CHIPS: Array<{ key: typeof quickFilter; label: string; count: number; Icon: any; tone: string }> = [
    { key: "all",        label: "Todos",       count: scopedTickets.length, Icon: Inbox,          tone: "" },
    { key: "critical",   label: "Críticos",    count: totalCritical,        Icon: Flame,          tone: "text-destructive" },
    { key: "new24h",     label: "Nuevos 24h",  count: totalNew24h,          Icon: Zap,            tone: "text-primary" },
    { key: "cliente",    label: "De cliente",  count: totalFromCliente,     Icon: Radio,          tone: "text-primary" },
    { key: "pendiente",  label: "PENDIENTE",   count: totalPending,         Icon: Clock,          tone: "text-warning" },
    { key: "enatencion", label: "EN ATENCIÓN", count: totalEnAtencion,      Icon: AlertTriangle,  tone: "text-info" },
  ];

  const kpiCards = [
    { label: "Pendientes",  value: totalPending,    Icon: Clock,          color: "text-warning",     bg: "bg-warning/10" },
    { label: "En atención", value: totalEnAtencion, Icon: AlertTriangle,  color: "text-info",        bg: "bg-info/10" },
    { label: "Críticos",    value: totalCritical,   Icon: Flame,          color: "text-destructive", bg: "bg-destructive/10" },
    { label: "De cliente",  value: totalFromCliente,Icon: Radio,          color: "text-primary",     bg: "bg-primary/10" },
  ];

  const hasActiveFilters = quickFilter !== "all" || search.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Inbox className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold">Bandeja de Entrada</h2>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Radio className="h-3 w-3 text-success animate-pulse" /> Escuchando en vivo
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority" className="text-xs">Por prioridad</SelectItem>
              <SelectItem value="age" className="text-xs">Más antiguos primero</SelectItem>
              <SelectItem value="client" className="text-xs">Por cliente A-Z</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-8 gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refrescar
          </Button>
        </div>
      </div>

      {/* KPI cards hero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {kpiCards.map(k => (
          <Card key={k.label} className="border-border/60">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", k.bg)}>
                <k.Icon className={cn("h-4 w-4", k.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black tabular-nums leading-tight">{k.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros rápidos + búsqueda */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {CHIPS.map(chip => {
            const active = quickFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setQuickFilter(chip.key)}
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-muted/40 border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <chip.Icon className={cn("h-3 w-3", !active && chip.tone)} />
                {chip.label}
                {chip.count > 0 && (
                  <span className={cn(
                    "tabular-nums ml-0.5 px-1 rounded text-[10px]",
                    active ? "bg-primary-foreground/20" : "bg-muted"
                  )}>
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
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
            const isOpen = !collapsed.has(group.clientId);
            return (
              <Card key={group.clientId} className={group.critical > 0 ? "border-destructive/40" : ""}>
                <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.clientId)}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <span className="truncate">{group.clientName}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {group.nivelServicio}
                            </Badge>
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {group.critical > 0 && (
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
                          return (
                            <motion.div
                              key={t.id}
                              initial={isNew ? { opacity: 0, y: -8, scale: 0.95 } : false}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, height: 0 }}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${s.border} ${
                                isNew ? "ring-2 ring-primary/40 bg-primary/5" : "bg-card hover:bg-muted/20"
                              } transition-colors`}
                            >
                              <div className={`h-8 w-8 rounded-md ${s.bg} flex items-center justify-center shrink-0`}>
                                <s.Icon className={`h-4 w-4 ${s.text}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <code className="text-[11px] font-mono font-bold text-muted-foreground">{t.ticket_id}</code>
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
                                </div>
                                <p className="text-sm font-medium mt-0.5 line-clamp-2">{t.asunto}</p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                  <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: es })}</span>
                                  <span>·</span>
                                  <span>{t.tipo}</span>
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
