import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClients } from "@/hooks/useClients";
import { type Client } from "@/data/projectData";
import { Building2, MapPin, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
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
  const { data: clients, isLoading, error } = useClients();
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Use static data as fallback
  const clientData = clients && clients.length > 0 ? clients : staticClients;

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {(role === "admin" || role === "pm") && (
          <CreateClientDialog />
        )}
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
    </div>
  );
}
