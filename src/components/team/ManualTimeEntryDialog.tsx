import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCreateManualEntry, useMyTimeEntries, entryHours, useMyTimeGoal, startOfWeek } from "@/hooks/useTimeTracking";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Calendar, DollarSign, Briefcase, Code2, Users, FileText, TestTube2, GraduationCap, MoreHorizontal, Check, ChevronsUpDown, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultClientId?: string;
  defaultItem?: { source: "task" | "ticket"; id: string; title?: string };
}

const QUICK_HOURS = [0.25, 0.5, 1, 2, 4, 8];

const CATEGORIES = [
  { id: "desarrollo", label: "Desarrollo", icon: Code2, color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  { id: "reunion", label: "Reunión", icon: Users, color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  { id: "soporte", label: "Soporte", icon: Briefcase, color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" },
  { id: "documentacion", label: "Doc.", icon: FileText, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  { id: "testing", label: "Testing", icon: TestTube2, color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  { id: "consultoria", label: "Consultoría", icon: GraduationCap, color: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30" },
  { id: "otros", label: "Otros", icon: MoreHorizontal, color: "bg-muted text-muted-foreground border-border" },
] as const;

interface WorkItem { id: string; title: string; client_id: string | null; source: "task" | "ticket"; }

export function ManualTimeEntryDialog({ open, onOpenChange, defaultClientId, defaultItem }: Props) {
  const { user } = useAuth();
  const { data: me } = useMyTeamMember();
  const create = useCreateManualEntry();
  const { data: weekGoal } = useMyTimeGoal();
  const { data: weekEntries = [] } = useMyTimeEntries(7);

  const isHourly = me?.employment_type === "hourly";
  const rate = me?.hourly_rate ?? 0;
  const currency = me?.rate_currency ?? "USD";

  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [source, setSource] = useState<"task" | "ticket">(defaultItem?.source ?? "task");
  const [itemId, setItemId] = useState<string>(defaultItem?.id ?? "");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState<string>("1");
  const [description, setDescription] = useState<string>("");
  const [billable, setBillable] = useState<boolean>(true);
  const [category, setCategory] = useState<string>("desarrollo");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  // Auto-set facturable según tipo de colaborador
  useEffect(() => { if (!isHourly) setBillable(false); }, [isHourly]);

  // Cargar contexto del usuario
  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      const [clientsRes, tasksRes, ticketsRes] = await Promise.all([
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("tasks").select("id, title, client_id").eq("assigned_user_id", user.id).neq("status", "completada").limit(50),
        supabase.from("support_tickets").select("id, asunto, client_id").eq("assigned_user_id", user.id).neq("estado", "cerrado").limit(50),
      ]);
      setClients(clientsRes.data || []);
      const all: WorkItem[] = [
        ...(tasksRes.data || []).map((t: any) => ({ id: t.id, title: t.title, client_id: t.client_id, source: "task" as const })),
        ...(ticketsRes.data || []).map((t: any) => ({ id: t.id, title: t.asunto, client_id: t.client_id, source: "ticket" as const })),
      ];
      setItems(all);
    })();
  }, [open, user?.id]);

  useEffect(() => {
    if (defaultClientId) setClientId(defaultClientId);
    if (defaultItem) { setSource(defaultItem.source); setItemId(defaultItem.id); }
  }, [defaultClientId, defaultItem, open]);

  // Métricas semana
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekHours = useMemo(() => weekEntries
    .filter(e => new Date(e.started_at) >= weekStart)
    .reduce((s, e) => s + entryHours(e), 0), [weekEntries, weekStart]);
  const target = weekGoal?.weekly_target_hours ?? 40;
  const newHours = parseFloat(hours) || 0;
  const projectedWeek = weekHours + newHours;
  const projectedPct = Math.min(100, (projectedWeek / target) * 100);

  const selectedItem = items.find(i => i.id === itemId);
  const selectedClient = clients.find(c => c.id === clientId);

  const estimatedAmount = isHourly && billable ? newHours * rate : 0;

  const submit = async () => {
    if (!newHours || newHours <= 0 || newHours > 24) return toast.error("Horas inválidas (0-24)");
    if (!itemId) return toast.error("Selecciona una tarea o ticket");
    try {
      await create.mutateAsync({
        source, item_id: itemId, client_id: clientId || null,
        work_date: date, hours: newHours, description,
        is_billable: isHourly ? billable : false,
        tags: [category],
      });
      toast.success(isHourly && billable
        ? `${newHours}h registradas · ${currency} ${estimatedAmount.toFixed(2)} facturables`
        : `${newHours}h registradas`);
      onOpenChange(false);
      setHours("1"); setDescription("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        {/* Header con gradient sysde */}
        <DialogHeader className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-5 space-y-1">
          <DialogTitle className="flex items-center justify-between text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold leading-tight">Registrar horas</div>
                <div className="text-xs opacity-80 font-normal">{me?.name || "Mi tiempo"}</div>
              </div>
            </div>
            <Badge variant="secondary" className={cn(
              "border-0 text-xs",
              isHourly ? "bg-amber-500/90 text-white" : "bg-emerald-500/90 text-white"
            )}>
              {isHourly ? <><DollarSign className="h-3 w-3 mr-1" /> Por hora</> : <><Briefcase className="h-3 w-3 mr-1" /> Asalariado</>}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Quick hours pills */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> ¿Cuánto trabajaste?
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_HOURS.map(h => (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant={parseFloat(hours) === h ? "default" : "outline"}
                  className="h-8 text-xs px-3"
                  onClick={() => setHours(String(h))}
                >
                  {h < 1 ? `${h * 60}m` : `${h}h`}
                </Button>
              ))}
              <Input
                type="number" step="0.25" min="0.25" max="24"
                value={hours} onChange={e => setHours(e.target.value)}
                className="h-8 w-20 text-xs" placeholder="otro"
              />
            </div>
          </div>

          {/* Categoría chips */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Categoría</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all",
                      active ? c.color + " ring-2 ring-primary/30" : "bg-background border-border hover:border-primary/30 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha + Cliente en grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> Fecha
              </Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant={date === new Date().toISOString().slice(0,10) ? "default" : "outline"}
                  className="h-9 text-xs flex-1" onClick={() => setDate(new Date().toISOString().slice(0,10))}>Hoy</Button>
                <Button type="button" size="sm" variant="outline" className="h-9 text-xs flex-1"
                  onClick={() => { const d = new Date(); d.setDate(d.getDate()-1); setDate(d.toISOString().slice(0,10)); }}>Ayer</Button>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-xs flex-[2]" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cliente</Label>
              <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="h-9 w-full justify-between text-xs font-normal">
                    {selectedClient?.name || <span className="text-muted-foreground">Seleccionar...</span>}
                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>Sin resultados</CommandEmpty>
                      <CommandGroup>
                        {clients.map(c => (
                          <CommandItem key={c.id} value={c.name} onSelect={() => { setClientId(c.id); setClientPickerOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", clientId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Item picker — visual */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tarea / Ticket</Label>
            <Popover open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="h-10 w-full justify-between text-xs font-normal">
                  {selectedItem ? (
                    <div className="flex items-center gap-2 truncate">
                      <Badge variant="secondary" className="h-5 text-[10px] uppercase">{selectedItem.source}</Badge>
                      <span className="truncate">{selectedItem.title}</span>
                    </div>
                  ) : <span className="text-muted-foreground">Buscar tarea o ticket asignado...</span>}
                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[480px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar..." className="h-9" />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>
                      No tienes tareas/tickets activos. Pega un UUID:
                      <Input value={itemId} onChange={e => setItemId(e.target.value)} placeholder="UUID" className="h-7 text-xs mt-2" />
                    </CommandEmpty>
                    <CommandGroup heading="Mis tareas">
                      {items.filter(i => i.source === "task").map(i => (
                        <CommandItem key={i.id} value={`${i.title} ${i.id}`} onSelect={() => {
                          setItemId(i.id); setSource("task"); if (i.client_id) setClientId(i.client_id); setItemPickerOpen(false);
                        }}>
                          <Code2 className="mr-2 h-3.5 w-3.5 text-blue-500" />
                          <span className="truncate">{i.title}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup heading="Mis tickets">
                      {items.filter(i => i.source === "ticket").map(i => (
                        <CommandItem key={i.id} value={`${i.title} ${i.id}`} onSelect={() => {
                          setItemId(i.id); setSource("ticket"); if (i.client_id) setClientId(i.client_id); setItemPickerOpen(false);
                        }}>
                          <Briefcase className="mr-2 h-3.5 w-3.5 text-orange-500" />
                          <span className="truncate">{i.title}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Descripción */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descripción</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="¿Qué hiciste? (opcional pero recomendado)" className="text-sm resize-none" />
          </div>

          {/* Toggle facturable — solo hourly */}
          {isHourly && (
            <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <Label className="text-xs font-medium">Facturable al cliente</Label>
                  {billable && rate > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      ≈ <span className="font-semibold text-foreground">{currency} {estimatedAmount.toFixed(2)}</span> a {currency} {rate}/h
                    </div>
                  )}
                </div>
              </div>
              <Switch checked={billable} onCheckedChange={setBillable} />
            </div>
          )}

          {/* Preview impacto semanal */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Target className="h-3 w-3" /> Esta semana
              </span>
              <span className="font-medium">
                <span className={cn(projectedWeek > target ? "text-amber-600" : "text-foreground")}>
                  {projectedWeek.toFixed(1)}h
                </span>
                <span className="text-muted-foreground"> / {target}h</span>
              </span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${projectedPct}%` }} />
            </div>
            {newHours > 0 && (
              <div className="text-[11px] text-muted-foreground">
                +{newHours}h ahora · {projectedWeek >= target ? "🎯 Meta alcanzada" : `Faltan ${(target - projectedWeek).toFixed(1)}h`}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            {isHourly ? "Tu tipo: facturación por hora" : "Tu tipo: salario fijo (sin facturación)"}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={create.isPending} className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90">
              {create.isPending ? "Guardando..." : `Registrar ${newHours || 0}h`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
