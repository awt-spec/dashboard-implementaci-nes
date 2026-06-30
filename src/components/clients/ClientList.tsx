import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClients } from "@/hooks/useClients";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { type Client } from "@/data/projectData";
import { Building2, MapPin, Search, Loader2, Database, Upload, Download, FileSpreadsheet, GitMerge, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { CreateClientDialog } from "./CreateClientDialog";

const statusConfig: Record<Client["status"], { label: string; className: string }> = {
  activo: { label: "Activo", className: "bg-success text-success-foreground" },
  "en-riesgo": { label: "En Riesgo", className: "bg-destructive text-destructive-foreground" },
  completado: { label: "Completado", className: "bg-info text-info-foreground" },
  pausado: { label: "Pausado", className: "bg-muted text-muted-foreground" },
};

interface ClientListProps {
  onSelectClient: (clientId: string) => void;
  selectedClientId?: string;
}

export function ClientList({ onSelectClient, selectedClientId }: ClientListProps) {
  const { data: clients, isLoading } = useClients();
  const { data: allTickets = [] } = useSupportTickets();
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Tickets abiertos por cliente, para la vista de estado general (ERP-072).
  const openTicketsByClient = useMemo(() => {
    const closed = new Set(["CERRADA", "ANULADA"]);
    const map: Record<string, number> = {};
    allTickets.forEach((t: any) => {
      if (closed.has((t.estado || "").toUpperCase())) return;
      map[t.client_id] = (map[t.client_id] || 0) + 1;
    });
    return map;
  }, [allTickets]);

  // Solo clientes con client_type='implementacion'. Coherente con el sidebar
  // que cuenta del mismo modo (`AppSidebar.tsx:53`).
  //
  // Fix 2026-05-16: la versión anterior incluía clientes 'soporte' con tasks
  // no terminales — pero esto producía discrepancias con el sidebar (Dos Pinos
  // y CMI aparecían en cards pero no en sidebar). AWT confirmó que un cliente
  // que migró a soporte NO debe aparecer acá.
  //
  // Si en el futuro hace falta mostrar un cliente 'soporte' por implementación
  // activa de un producto específico, agregar bandera explícita en BD
  // (ej: clients.implementation_active boolean) en lugar de inferir por tasks.
  const clientData = (clients || []).filter(
    (c: any) => c.client_type === "implementacion"
  );

  const filtered = clientData.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = ["todos", "activo", "en-riesgo", "completado", "pausado"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canManage = role === "admin" || role === "pm";

  return (
    <Tabs defaultValue="clientes" className="space-y-4">
      <TabsList className="h-9">
        <TabsTrigger value="clientes" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Clientes</TabsTrigger>
        <TabsTrigger value="estado" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Estado general</TabsTrigger>
        {canManage && (
          <TabsTrigger value="datos" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Datos & Sync</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="clientes" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {canManage && <CreateClientDialog />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                {s === "todos" ? "Todos" : statusConfig[s as Client["status"]]?.label}
              </button>
            ))}
          </div>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((client, i) => {
          const config = statusConfig[client.status];
          const isSelected = selectedClientId === client.id;
          return (
            <motion.div key={client.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card
                className={`cursor-pointer hover:shadow-md transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
                onClick={() => onSelectClient(client.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-tight">{client.name}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {client.country}
                        </p>
                      </div>
                    </div>
                    <Badge className={config.className}>{config.label}</Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-bold text-foreground">{client.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${client.progress}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                      <span>{client.tasks.length} tareas</span>
                      <span>{client.risks.filter(r => r.status === "abierto").length} riesgos</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No se encontraron clientes</p>
        )}
      </TabsContent>

      {/* Estado general consolidado de todos los clientes (ERP-072) */}
      <TabsContent value="estado" className="space-y-4">
        {(() => {
          const order: Record<string, number> = { "en-riesgo": 0, activo: 1, pausado: 2, completado: 3 };
          const all = [...(clients || [])].sort(
            (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.name.localeCompare(b.name),
          );
          const totals = {
            total: all.length,
            riesgo: all.filter(c => c.status === "en-riesgo").length,
            tickets: all.reduce((s, c) => s + (openTicketsByClient[c.id] || 0), 0),
            riesgos: all.reduce((s, c) => s + c.risks.filter(r => r.status === "abierto").length, 0),
          };
          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Clientes</p><p className="text-2xl font-bold">{totals.total}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">En riesgo</p><p className="text-2xl font-bold text-destructive">{totals.riesgo}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Tickets abiertos</p><p className="text-2xl font-bold">{totals.tickets}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Riesgos abiertos</p><p className="text-2xl font-bold text-warning">{totals.riesgos}</p></CardContent></Card>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>País</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Progreso</TableHead>
                        <TableHead className="text-right">Tareas</TableHead>
                        <TableHead className="text-right">Tickets abiertos</TableHead>
                        <TableHead className="text-right">Riesgos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {all.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">Sin clientes</TableCell></TableRow>
                      ) : all.map(c => {
                        const cfg = statusConfig[c.status];
                        const openRisks = c.risks.filter(r => r.status === "abierto").length;
                        return (
                          <TableRow key={c.id} className="cursor-pointer" onClick={() => onSelectClient(c.id)}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{c.country}</TableCell>
                            <TableCell><Badge className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge></TableCell>
                            <TableCell className="text-right tabular-nums">{c.progress}%</TableCell>
                            <TableCell className="text-right tabular-nums">{c.tasks.length}</TableCell>
                            <TableCell className="text-right tabular-nums">{openTicketsByClient[c.id] || 0}</TableCell>
                            <TableCell className={`text-right tabular-nums ${openRisks > 0 ? "text-warning font-semibold" : ""}`}>{openRisks}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          );
        })()}
      </TabsContent>

      {canManage && (
        <TabsContent value="datos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Agregar cliente manualmente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Crea un cliente nuevo con contrato, SLA y contacto. Quedará disponible en la lista.
                </p>
                <CreateClientDialog />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-info" />
                  Importar desde CSV/Excel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Sube un archivo con múltiples clientes, contratos o tareas.
                  Columnas aceptadas: <code className="text-[10px] bg-muted px-1 rounded">name, country, industry, contact_name, contact_email, client_type, nivel_servicio</code>.
                </p>
                <Button variant="outline" disabled className="w-full gap-2">
                  <Upload className="h-4 w-4" /> Subir archivo (próximamente)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Download className="h-4 w-4 text-success" />
                  Exportar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Descarga todos los clientes de implementación con su data actualizada.
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const csv = [
                      "id,name,country,industry,client_type,nivel_servicio,status,progress",
                      ...filtered.map(c =>
                        [c.id, c.name, c.country, (c as any).industry, "implementacion", (c as any).nivel_servicio || "Base", c.status, c.progress].map(v => `"${v ?? ""}"`).join(","),
                      ),
                    ].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `clientes-implementacion-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4" /> Exportar CSV ({filtered.length} clientes)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-primary" />
                  Azure DevOps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Sincronizar tareas desde Azure DevOps a un cliente específico. Abrí el detalle de un cliente y andá al tab "Datos & Sync".
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
