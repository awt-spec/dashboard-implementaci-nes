import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Package, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { type Client } from "@/data/projectData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface UpcomingDeliverablesProps {
  clients: Client[];
  client?: Client;
}

function parseDate(dateStr: string): Date | null {
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  const months: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
    jan: 0, apr: 3, aug: 7, dec: 11,
  };
  const parts = dateStr.replace(",", "").split(" ");
  if (parts.length >= 3) {
    const day = parseInt(parts[0]);
    const mon = months[parts[1].toLowerCase().slice(0, 3)];
    const year = parseInt(parts[2]);
    if (!isNaN(day) && mon !== undefined && !isNaN(year)) return new Date(year, mon, day);
  }
  if (parts.length === 2) {
    const mon = months[parts[0].toLowerCase().slice(0, 3)];
    const year = parseInt(parts[1]);
    if (mon !== undefined && !isNaN(year)) return new Date(year, mon, 1);
  }
  return null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  aprobado: { label: "Aprobado", className: "bg-success text-success-foreground" },
  entregado: { label: "Entregado", className: "bg-info text-info-foreground" },
  "en-revision": { label: "En Revisión", className: "bg-warning text-warning-foreground" },
  pendiente: { label: "Pendiente", className: "bg-muted text-muted-foreground" },
};

export function UpcomingDeliverables({ clients, client }: UpcomingDeliverablesProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const items = useMemo(() => {
    const targetClients = client ? [client] : clients;
    const all = targetClients.flatMap(c =>
      c.deliverables.map(d => ({
        ...d,
        clientName: c.name,
        clientId: c.id,
        parsedDate: parseDate(d.dueDate),
      }))
    );

    // Also include tasks
    const allTasks = targetClients.flatMap(c =>
      c.tasks.map(t => ({
        id: `task-${t.id}`,
        name: t.title,
        type: "tarea" as const,
        status: t.status,
        dueDate: t.dueDate,
        clientName: c.name,
        clientId: c.id,
        parsedDate: parseDate(t.dueDate),
        owner: t.owner,
      }))
    );

    if (!selectedDate) {
      // Show upcoming (next 30 days)
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const filtered = all.filter(d => d.parsedDate && d.parsedDate >= now && d.parsedDate <= in30 && d.status !== "aprobado" && d.status !== "entregado");
      const filteredTasks = allTasks.filter(t => t.parsedDate && t.parsedDate >= now && t.parsedDate <= in30 && t.status !== "completada");
      return { deliverables: filtered.sort((a, b) => (a.parsedDate?.getTime() || 0) - (b.parsedDate?.getTime() || 0)), tasks: filteredTasks.sort((a, b) => (a.parsedDate?.getTime() || 0) - (b.parsedDate?.getTime() || 0)) };
    }

    // Filter by exact date
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Extend to match by month/year for items without exact day
    const filtered = all.filter(d => {
      if (!d.parsedDate) return false;
      return d.parsedDate >= dayStart && d.parsedDate <= dayEnd;
    });
    const filteredTasks = allTasks.filter(t => {
      if (!t.parsedDate) return false;
      return t.parsedDate >= dayStart && t.parsedDate <= dayEnd;
    });

    return { deliverables: filtered, tasks: filteredTasks };
  }, [clients, client, selectedDate]);

  const totalItems = items.deliverables.length + items.tasks.length;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {selectedDate ? "Seguimientos al" : "Próximos Seguimientos"}
            </h3>
            {selectedDate && (
              <Badge variant="outline" className="text-xs">
                {format(selectedDate, "dd MMM yyyy", { locale: es })}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedDate && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedDate(undefined)}>
                Próximos 30 días
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Filtrar por fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {totalItems === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {selectedDate ? "No hay seguimientos para esta fecha" : "No hay seguimientos pendientes en los próximos 30 días"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {items.deliverables.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Entregables ({items.deliverables.length})</p>
                {items.deliverables.map(d => {
                  const config = statusConfig[d.status] || statusConfig.pendiente;
                  const isOverdue = d.parsedDate && d.parsedDate < new Date() && d.status !== "aprobado" && d.status !== "entregado";
                  return (
                    <div key={d.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {isOverdue && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                          <p className="text-xs font-medium text-foreground truncate">{d.name}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          {!client && <span>{d.clientName}</span>}
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{d.dueDate}</span>
                        </div>
                      </div>
                      <Badge className={config.className}>{config.label}</Badge>
                    </div>
                  );
                })}
              </>
            )}
            {items.tasks.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-3">Tareas ({items.tasks.length})</p>
                {items.tasks.map(t => {
                  const isOverdue = t.parsedDate && t.parsedDate < new Date() && t.status !== "completada";
                  return (
                    <div key={t.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {isOverdue && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                          <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          {!client && <span>{t.clientName}</span>}
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{t.dueDate}</span>
                          <span>• {t.owner}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
