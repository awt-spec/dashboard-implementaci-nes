/**
 * OverdueTicketsSheet — Vista perfecta de TODOS los casos vencidos.
 *
 * Soluciona la discrepancia: el dashboard mostraba "85 vencidas" pero al
 * hacer click solo veías 55 porque la Bandeja filtraba PENDIENTE+EN ATENCIÓN.
 *
 * Esta vista muestra TODOS los vencidos (cualquier estado no-cerrado) con:
 *   • Filtros: source (Política / SLA Cliente), prioridad, cliente
 *   • Sort: severidad (default), antigüedad, cliente A→Z
 *   • Bulk actions: cerrar varios, asignar a mí
 *   • Quick view: click → abre TicketDetailSheet
 *
 * Trigger: window.dispatchEvent(new CustomEvent("overdue:open"))
 */
import { useEffect, useMemo, useState } from "react";
import { useAllSupportTickets, useSupportClients, useUpdateSupportTicket, type SupportTicket } from "@/hooks/useSupportTickets";
import { useTicketsSLAStatus } from "@/hooks/useTicketsSLAStatus";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle, Search, X, Building2, ListMinus, Eye, Lock,
  CheckCheck, UserPlus, Loader2, Flame, Clock, Check, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TicketDetailSheet } from "./TicketDetailSheet";
import { SLAByClientPanel } from "./SLAByClientPanel";

type SortMode = "severity" | "age" | "client";
type SourceFilter = "all" | "policy" | "client_override";

// Categoría de acción: agrupa estados de manera operativa para que el user
// sepa qué hacer con cada caso. NO se basa en bandeja vs no-bandeja sino en
// la NATURALEZA del trabajo pendiente.
type ActionCategory = "easy_close" | "active_inbox" | "waiting_external";

const ACTION_META: Record<ActionCategory, {
  label: string;
  hint: string;
  Icon: typeof Lock;
  tone: string;
  bg: string;
  border: string;
  states: string[];
}> = {
  easy_close: {
    label: "Listos para cerrar",
    hint: "Trabajo hecho · solo falta cierre formal",
    Icon: Lock,
    tone: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    states: ["POR CERRAR"],
  },
  active_inbox: {
    label: "En bandeja activa",
    hint: "Necesitan acción tuya: asignar / atender",
    Icon: AlertTriangle,
    tone: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/40",
    states: ["PENDIENTE", "EN ATENCIÓN"],
  },
  waiting_external: {
    label: "Esperando externos",
    hint: "Pendientes de cliente, valoración o pausa",
    Icon: Clock,
    tone: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    states: ["COTIZADA", "VALORACIÓN", "ON HOLD"],
  },
};

const ACTION_ORDER: ActionCategory[] = ["easy_close", "active_inbox", "waiting_external"];

function getActionCategory(estado: string): ActionCategory | null {
  for (const cat of ACTION_ORDER) {
    if (ACTION_META[cat].states.includes(estado)) return cat;
  }
  return null;
}

export function OverdueTicketsSheet() {
  const [open, setOpen] = useState(false);
  const { data: tickets = [] } = useAllSupportTickets();
  const { data: clients = [] } = useSupportClients();
  const { byId: slaByTicketId } = useTicketsSLAStatus();
  const update = useUpdateSupportTicket();
  const { user, profile } = useAuth();

  const [sortMode, setSortMode] = useState<SortMode>("severity");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionCategory | "all">("all");
  const [clientFilter, setClientFilter] = useState<string | null>(null); // client_id o null
  /** Cuando se abre desde una vista scoped a un cliente, este ID NO se puede
   *  quitar (es el contexto del usuario). El clientFilter sí. */
  const [scopedClientId, setScopedClientId] = useState<string | null>(null);
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);

  // Listener global: cualquier botón "ver vencidas" puede abrir el sheet,
  // opcionalmente con un clientId para scopearlo a ese cliente.
  // Uso:  dispatchEvent(new CustomEvent("overdue:open", { detail: { clientId } }))
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const cid = typeof detail === "object" && detail.clientId ? detail.clientId : null;
      setScopedClientId(cid);
      // Si vino con cliente, limpiar otros filtros de cliente
      if (cid) setClientFilter(null);
      setOpen(true);
    };
    window.addEventListener("overdue:open", handler);
    return () => window.removeEventListener("overdue:open", handler);
  }, []);

  // Limpiar selección + scope al cerrar
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setScopedClientId(null);
    }
  }, [open]);

  // Solo vencidos — y si hay scope a cliente, solo de ese cliente
  const overdueTickets = useMemo(() => {
    return tickets.filter(t => {
      if (slaByTicketId.get(t.id)?.status !== "overdue") return false;
      if (scopedClientId && t.client_id !== scopedClientId) return false;
      return true;
    });
  }, [tickets, slaByTicketId, scopedClientId]);

  const scopedClientName = scopedClientId
    ? clients.find(c => c.id === scopedClientId)?.name || scopedClientId
    : null;

  // Aplicar filtros (action category + source + search)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return overdueTickets.filter(t => {
      // Filtro por categoría de acción
      if (actionFilter !== "all") {
        if (getActionCategory(t.estado) !== actionFilter) return false;
      }
      // Filtro por cliente específico
      if (clientFilter && t.client_id !== clientFilter) return false;
      // Filtro por fuente del SLA
      const sla = slaByTicketId.get(t.id);
      if (sourceFilter !== "all") {
        const expectedSource = sourceFilter === "policy" ? "policy_v4.5" : "client_override";
        if (sla?.source !== expectedSource) return false;
      }
      // Búsqueda libre
      if (q) {
        const cli = clients.find(c => c.id === t.client_id);
        const haystack = `${t.ticket_id} ${t.asunto} ${cli?.name || ""} ${t.responsable || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [overdueTickets, slaByTicketId, sourceFilter, actionFilter, clientFilter, search, clients]);

  // Ordenar
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const sa = slaByTicketId.get(a.id);
      const sb = slaByTicketId.get(b.id);
      if (sortMode === "severity") {
        const exA = sa ? sa.daysElapsed - sa.deadlineDays : 0;
        const exB = sb ? sb.daysElapsed - sb.deadlineDays : 0;
        return exB - exA;
      }
      if (sortMode === "age") {
        return new Date(a.fecha_registro || a.created_at).getTime() - new Date(b.fecha_registro || b.created_at).getTime();
      }
      if (sortMode === "client") {
        const ca = clients.find(c => c.id === a.client_id)?.name || a.client_id;
        const cb = clients.find(c => c.id === b.client_id)?.name || b.client_id;
        return ca.localeCompare(cb);
      }
      return 0;
    });
    return arr;
  }, [filtered, sortMode, slaByTicketId, clients]);

  // Stats por categoría de acción + por fuente
  const stats = useMemo(() => {
    let policy = 0, client = 0;
    const byAction: Record<ActionCategory, { count: number; states: Record<string, number> }> = {
      easy_close:       { count: 0, states: {} },
      active_inbox:     { count: 0, states: {} },
      waiting_external: { count: 0, states: {} },
    };
    overdueTickets.forEach(t => {
      const s = slaByTicketId.get(t.id);
      if (s?.source === "client_override") client++;
      else policy++;
      const cat = getActionCategory(t.estado);
      if (cat) {
        byAction[cat].count++;
        byAction[cat].states[t.estado] = (byAction[cat].states[t.estado] || 0) + 1;
      }
    });
    return { total: overdueTickets.length, policy, client, byAction };
  }, [overdueTickets, slaByTicketId]);

  const allSelected = sorted.length > 0 && sorted.every(t => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map(t => t.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleBulkClose = async () => {
    if (!confirm(`¿Cerrar ${selectedIds.size} boleta${selectedIds.size === 1 ? "" : "s"} como resuelta${selectedIds.size === 1 ? "" : "s"}?`)) return;
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        await update.mutateAsync({
          id,
          updates: {
            estado: "CERRADA",
            fecha_entrega: new Date().toISOString(),
          } as any,
        });
        ok++;
      } catch { fail++; }
    }
    toast.success(`${ok} boleta${ok === 1 ? "" : "s"} cerrada${ok === 1 ? "" : "s"}${fail > 0 ? ` · ${fail} con error` : ""}`);
    setSelectedIds(new Set());
  };

  const handleAssignToMe = async () => {
    if (!user || !profile) return;
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        await update.mutateAsync({
          id,
          updates: {
            assigned_user_id: user.id,
            responsable: profile.full_name || "Yo",
            estado: "EN ATENCIÓN",
          } as any,
        });
        ok++;
      } catch { fail++; }
    }
    toast.success(`${ok} asignada${ok === 1 ? "" : "s"} a vos${fail > 0 ? ` · ${fail} con error` : ""}`);
    setSelectedIds(new Set());
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col gap-0">
          {/* ════════ HEADER FIJO ════════ */}
          <SheetHeader className="space-y-3 px-6 pt-6 pb-4 bg-card border-b border-border/60 shrink-0">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-bold leading-tight text-left">
                  {stats.total} {stats.total === 1 ? "boleta vencida" : "boletas vencidas"}
                  {scopedClientName && (
                    <span className="text-base font-normal text-muted-foreground"> · {scopedClientName}</span>
                  )}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scopedClientName
                    ? <>Solo este cliente · <span className="text-primary font-semibold">{scopedClientName}</span></>
                    : "Pasaron su plazo · Política o SLA del cliente, según corresponda"}
                </p>
              </div>
              {/* Pill recordando scope cuando aplica */}
              {scopedClientName && (
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold shrink-0">
                  <Building2 className="h-2.5 w-2.5" />
                  scope cliente
                </span>
              )}
            </div>

            {/* ════ BREAKDOWN POR CATEGORÍA DE ACCIÓN ════
                3 cards clickables que agrupan por NATURALEZA del trabajo:
                - Listos para cerrar (POR CERRAR)
                - En bandeja activa (PENDIENTE + EN ATENCIÓN)
                - Esperando externos (COTIZADA + ON HOLD + VALORACIÓN)
                Cada card muestra el desglose de estados que la componen. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {ACTION_ORDER.map(cat => {
                const m = ACTION_META[cat];
                const data = stats.byAction[cat];
                const isActive = actionFilter === cat;
                const stateBreakdown = Object.entries(data.states).sort((a, b) => b[1] - a[1]);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActionFilter(isActive ? "all" : cat)}
                    disabled={data.count === 0}
                    className={cn(
                      "flex flex-col gap-2 p-3 rounded-lg border text-left transition-all relative overflow-hidden",
                      isActive
                        ? cn(m.border, m.bg, "ring-2 ring-current/20")
                        : data.count > 0
                        ? "border-border/60 bg-card hover:border-current/40"
                        : "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", m.bg)}>
                        <m.Icon className={cn("h-4 w-4", m.tone)} />
                      </div>
                      {isActive && <Check className="h-3.5 w-3.5 text-current" />}
                    </div>
                    <div>
                      <p className={cn("text-3xl font-black tabular-nums leading-none", m.tone)}>
                        {data.count}
                      </p>
                      <p className="text-[11px] font-semibold mt-1.5">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{m.hint}</p>
                    </div>
                    {/* Desglose de estados — visible siempre, da claridad */}
                    {stateBreakdown.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/40">
                        {stateBreakdown.map(([estado, n]) => (
                          <span key={estado} className="text-[9px] font-mono text-muted-foreground">
                            <strong className={m.tone}>{n}</strong> {estado}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Easy wins banner — si hay POR CERRAR, ofrece bulk close inmediato */}
            {stats.byAction.easy_close.count > 0 && actionFilter !== "easy_close" && (
              <button
                type="button"
                onClick={() => setActionFilter("easy_close")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] transition-colors text-left group"
              >
                <Lock className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    💡 Win rápido: {stats.byAction.easy_close.count} boleta{stats.byAction.easy_close.count === 1 ? "" : "s"} listas para cerrar
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Trabajo hecho · selecciónalas y "Cerrar" baja tu count en {stats.byAction.easy_close.count}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider group-hover:underline">
                  Filtrar →
                </span>
              </button>
            )}

            {/* Filtros secundarios por FUENTE + chip de cliente activo */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Fuente:</span>
              <button
                onClick={() => setSourceFilter("all")}
                className={cn(
                  "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold border transition-all",
                  sourceFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                Todas <span className="tabular-nums">{stats.total}</span>
              </button>
              <button
                onClick={() => setSourceFilter(sourceFilter === "policy" ? "all" : "policy")}
                className={cn(
                  "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold border transition-all",
                  sourceFilter === "policy" ? "bg-muted text-foreground border-border" : "bg-card border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <ListMinus className="h-2.5 w-2.5" />
                Política <span className="tabular-nums">{stats.policy}</span>
              </button>
              <button
                onClick={() => setSourceFilter(sourceFilter === "client_override" ? "all" : "client_override")}
                className={cn(
                  "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold border transition-all",
                  sourceFilter === "client_override" ? "bg-primary/15 text-primary border-primary/30" : "bg-card border-border text-muted-foreground hover:border-primary/40"
                )}
                disabled={stats.client === 0}
              >
                <Building2 className="h-2.5 w-2.5" />
                SLA Cliente <span className="tabular-nums">{stats.client}</span>
              </button>

              {/* Toggle "Por cliente" — solo visible si NO hay scope a un cliente
                  (cuando hay scope no tiene sentido un breakdown por cliente). */}
              {!scopedClientId && (
                <button
                  onClick={() => setShowClientPanel(v => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold border transition-all ml-auto",
                    showClientPanel
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-card border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <Building2 className="h-2.5 w-2.5" />
                  Por cliente
                  <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", showClientPanel && "rotate-180")} />
                </button>
              )}
            </div>

            {/* Chip cliente activo — visible si hay filtro */}
            {clientFilter && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Cliente:</span>
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold border bg-primary/15 text-primary border-primary/30">
                  <Building2 className="h-2.5 w-2.5" />
                  {clients.find(c => c.id === clientFilter)?.name || clientFilter}
                  <button
                    onClick={() => setClientFilter(null)}
                    className="hover:bg-primary/20 rounded-full p-0.5 ml-0.5"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </span>
              </div>
            )}

            {/* Panel "Por cliente" — desplegable con la lista completa */}
            {showClientPanel && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
                <SLAByClientPanel
                  embedded
                  limit={15}
                  onClientClick={(clientId) => {
                    setClientFilter(clientId);
                    setShowClientPanel(false);
                  }}
                />
              </div>
            )}

            {/* Toolbar: search + sort */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, asunto, cliente, responsable…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-8 h-8 text-xs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded hover:bg-muted/60 flex items-center justify-center">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-8 px-2 rounded-md border border-border bg-background text-xs"
                title="Ordenar"
              >
                <option value="severity">↓ Más vencidos</option>
                <option value="age">↓ Más antiguos</option>
                <option value="client">A→Z cliente</option>
              </select>
            </div>

            {/* Bulk actions bar — visible cuando hay selección */}
            {someSelected && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/[0.06] border border-primary/30"
              >
                <span className="text-xs font-bold text-primary">
                  {selectedIds.size} seleccionada{selectedIds.size === 1 ? "" : "s"}
                </span>
                <div className="flex-1" />
                <Button
                  size="sm" variant="outline"
                  onClick={handleAssignToMe}
                  disabled={update.isPending}
                  className="h-7 gap-1 text-[11px]"
                >
                  <UserPlus className="h-3 w-3" /> Asignar a mí
                </Button>
                <Button
                  size="sm" variant="destructive"
                  onClick={handleBulkClose}
                  disabled={update.isPending}
                  className="h-7 gap-1 text-[11px]"
                >
                  {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                  Cerrar
                </Button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 w-7 rounded hover:bg-muted/60 flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}

            {/* Select all */}
            {sorted.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-3.5 w-3.5" />
                <span>Mostrando {sorted.length} de {stats.total}</span>
                {(sourceFilter !== "all" || actionFilter !== "all" || clientFilter || search) && (
                  <button
                    onClick={() => { setSourceFilter("all"); setActionFilter("all"); setClientFilter(null); setSearch(""); }}
                    className="text-primary hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </SheetHeader>

          {/* ════════ BODY scrolleable ════════ */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {sorted.length === 0 ? (
              <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
                <CardContent className="py-12 text-center space-y-3">
                  <CheckCheck className="h-10 w-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold">Sin boletas vencidas con esos filtros</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.total === 0 ? "Todas las boletas están dentro de plazo 🎉" : "Limpiá los filtros para ver el resto"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence>
                {sorted.map((t, i) => {
                  const sla = slaByTicketId.get(t.id);
                  const cli = clients.find(c => c.id === t.client_id);
                  const isClientSource = sla?.source === "client_override";
                  const exceeded = sla ? sla.daysElapsed - sla.deadlineDays : 0;
                  const isSelected = selectedIds.has(t.id);
                  const isCritical = /critica/i.test(t.prioridad || "");

                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={i < 20 ? { opacity: 0, y: 4 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        "rounded-lg border transition-colors group relative overflow-hidden",
                        isSelected ? "border-primary bg-primary/[0.04] ring-1 ring-primary/20" : "border-border/60 bg-card hover:border-destructive/30"
                      )}
                    >
                      {/* Border-left rojo grueso para vencidos */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />

                      <div className="flex items-start gap-3 p-3 pl-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(t.id)}
                          className="mt-1 shrink-0"
                        />

                        <button
                          type="button"
                          onClick={() => setOpenDetailId(t.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          {/* Header row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <code className="text-[11px] font-mono font-bold text-muted-foreground">{t.ticket_id}</code>
                            {isCritical && (
                              <Badge className="h-4 text-[9px] gap-0.5 bg-destructive/15 text-destructive border-destructive/30">
                                <Flame className="h-2.5 w-2.5" /> Crítica
                              </Badge>
                            )}
                            <Badge variant="outline" className="h-4 text-[9px]">{t.estado}</Badge>
                            {/* Source badge */}
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-4 text-[9px] gap-1",
                                isClientSource
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-muted/50 text-muted-foreground border-border"
                              )}
                            >
                              {isClientSource ? <Building2 className="h-2.5 w-2.5" /> : <ListMinus className="h-2.5 w-2.5" />}
                              {isClientSource ? "SLA Cliente" : "Política"}
                            </Badge>
                            {/* Severity badge */}
                            <Badge className="h-4 text-[9px] bg-destructive text-destructive-foreground border-0 tabular-nums">
                              <Clock className="h-2.5 w-2.5 mr-0.5" />
                              +{exceeded}d
                            </Badge>
                          </div>

                          <p className="text-sm font-medium mt-1 line-clamp-2 leading-snug">{t.asunto}</p>

                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                            <span className="font-semibold text-foreground/80">{cli?.name || t.client_id}</span>
                            <span>·</span>
                            <span>{formatDistanceToNow(new Date(t.fecha_registro || t.created_at), { addSuffix: true, locale: es })}</span>
                            <span>·</span>
                            <span>plazo {sla?.deadlineDays}d · llevamos {sla?.daysElapsed}d</span>
                            {t.responsable && t.responsable !== "—" && (
                              <>
                                <span>·</span>
                                <span>{t.responsable}</span>
                              </>
                            )}
                            {(!t.responsable || t.responsable === "—") && (
                              <Badge variant="outline" className="h-4 text-[9px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                                Sin asignar
                              </Badge>
                            )}
                          </div>
                        </button>

                        {/* Quick actions */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => setOpenDetailId(t.id)} className="h-7 w-7 p-0">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalle</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  if (!confirm(`Cerrar ${t.ticket_id}?`)) return;
                                  try {
                                    await update.mutateAsync({
                                      id: t.id,
                                      updates: { estado: "CERRADA", fecha_entrega: new Date().toISOString() } as any,
                                    });
                                    toast.success(`${t.ticket_id} cerrado`);
                                  } catch (e: any) { toast.error(e.message); }
                                }}
                                disabled={update.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <Lock className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cerrar caso</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* TicketDetailSheet anidado para ver detalle de un vencido sin cerrar este Sheet */}
      <TicketDetailSheet
        ticket={openDetailId ? tickets.find(t => t.id === openDetailId) ?? null : null}
        open={!!openDetailId}
        onOpenChange={(o) => { if (!o) setOpenDetailId(null); }}
        canEditInternal={true}
      />
    </TooltipProvider>
  );
}

/** Helper para disparar la sheet desde cualquier botón del app. */
export function openOverdueSheet() {
  window.dispatchEvent(new CustomEvent("overdue:open"));
}
