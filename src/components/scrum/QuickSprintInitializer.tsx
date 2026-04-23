import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Target, CheckCircle2, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useClientsWithoutActiveSprint, useInitSprintForClient } from "@/hooks/useSVAStrategy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function defaultSprintName(now = new Date()): string {
  const y = now.getFullYear();
  const w = Math.ceil((((now.getTime() - new Date(y, 0, 1).getTime()) / 86400000) + new Date(y, 0, 1).getDay() + 1) / 7);
  return `Sprint ${y}-W${String(w).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function QuickSprintInitializer({ open, onOpenChange }: Props) {
  const { data: clients = [], isLoading } = useClientsWithoutActiveSprint();
  const init = useInitSprintForClient();

  const today = new Date().toISOString().slice(0, 10);
  const [sprintName, setSprintName] = useState(defaultSprintName());
  const [startDate, setStartDate] = useState(today);
  const [durationDays, setDurationDays] = useState(14);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const endDate = addDays(startDate, durationDays);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSprintName(defaultSprintName());
      setStartDate(today);
      setDurationDays(14);
    }
  }, [open]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  const toggleAll = () => {
    if (selected.size === clients.length) setSelected(new Set());
    else setSelected(new Set(clients.map(c => c.id)));
  };

  const handleCreate = async () => {
    if (selected.size === 0) {
      toast.error("Selecciona al menos un cliente");
      return;
    }
    if (!sprintName.trim()) {
      toast.error("El nombre del sprint es obligatorio");
      return;
    }
    const ids = Array.from(selected);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        await init.mutateAsync({
          client_id: id,
          name: sprintName,
          start_date: startDate,
          end_date: endDate,
          goal: "Inicializado desde health check del SVA",
        });
        ok++;
      } catch { fail++; }
    }
    if (ok > 0) toast.success(`${ok} sprint(s) creado(s)`);
    if (fail > 0) toast.error(`${fail} fallaron`);
    if (fail === 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Inicializar sprints faltantes
          </DialogTitle>
          <DialogDescription className="text-xs">
            Estos clientes de soporte tienen tickets abiertos pero <strong>ningún sprint activo</strong>.
            Sin sprint, los tickets flotan sin organización y el evaluator no puede medir velocity.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 py-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : clients.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Todos los clientes con actividad tienen sprint activo</p>
                  <p className="text-xs text-muted-foreground mt-1">No hay gaps que cubrir.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Configuración del sprint */}
              <Card className="bg-muted/20">
                <CardContent className="p-3 space-y-3">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Configuración del sprint
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Nombre</label>
                      <Input value={sprintName} onChange={e => setSprintName(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Inicio</label>
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Duración (días)</label>
                      <Input
                        type="number" min="1" max="60"
                        value={durationDays}
                        onChange={e => setDurationDays(Math.max(1, parseInt(e.target.value) || 14))}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Termina el <strong>{endDate}</strong>. Los sprints se crearán con el mismo nombre y fechas
                    para cada cliente seleccionado.
                  </p>
                </CardContent>
              </Card>

              {/* Selector de clientes */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  {clients.length} clientes · seleccionados: {selected.size}
                </span>
                <Button size="sm" variant="ghost" onClick={toggleAll} className="h-7 text-xs">
                  {selected.size === clients.length ? "Ninguno" : "Todos"}
                </Button>
              </div>

              <div className="space-y-1.5">
                {clients.map(c => {
                  const isSelected = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 hover:bg-muted/30"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5">{c.id}</Badge>
                      </div>
                      <Badge className={
                        c.open_tickets > 5
                          ? "bg-destructive/15 text-destructive border-destructive/30 tabular-nums"
                          : c.open_tickets > 2
                          ? "bg-warning/15 text-warning border-warning/30 tabular-nums"
                          : "bg-muted/40 tabular-nums"
                      }>
                        {c.open_tickets} abiertos
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {selected.size > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs">
                      Se crearán <strong>{selected.size}</strong> sprints activos
                      (<strong>{sprintName}</strong>, {startDate} → {endDate}).
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleCreate}
            disabled={clients.length === 0 || selected.size === 0 || init.isPending}
            className="gap-1.5"
          >
            {init.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Crear sprints {selected.size > 0 && `(${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
