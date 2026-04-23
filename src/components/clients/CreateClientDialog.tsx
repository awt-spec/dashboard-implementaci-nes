import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateClient } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [status, setStatus] = useState<string>("activo");
  const [coreVersion, setCoreVersion] = useState("");
  const [clientType, setClientType] = useState<"soporte" | "implementacion">("soporte");
  const [nivelServicio, setNivelServicio] = useState<"Base" | "Premium" | "Platinum">("Base");
  const createClient = useCreateClient();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name || !country || !contactName || !contactEmail || !contractStart || !contractEnd) {
      toast({ title: "Campos requeridos", description: "Completa todos los campos obligatorios", variant: "destructive" });
      return;
    }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    try {
      await createClient.mutateAsync({
        id,
        name,
        country,
        industry: industry || "General",
        contact_name: contactName,
        contact_email: contactEmail,
        contract_start: contractStart,
        contract_end: contractEnd,
        status,
        progress: 0,
        team_assigned: [],
        core_version: coreVersion || "",
        modules: [],
        client_type: clientType,
        nivel_servicio: nivelServicio,
      } as any);
      toast({ title: "Cliente creado", description: `${name} · ${clientType} · ${nivelServicio}` });
      setOpen(false);
      setName(""); setCountry(""); setIndustry(""); setContactName(""); setContactEmail("");
      setContractStart(""); setContractEnd(""); setStatus("activo"); setCoreVersion("");
      setClientType("soporte"); setNivelServicio("Base");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nuevo Cliente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Crear Nuevo Cliente</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Grupo Ejemplo" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">País *</label>
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Costa Rica" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Industria</label>
              <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Tecnología" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="en-riesgo">En Riesgo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contacto *</label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email contacto *</label>
              <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="juan@empresa.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo *</label>
              <Select value={clientType} onValueChange={(v) => setClientType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="soporte">Soporte</SelectItem>
                  <SelectItem value="implementacion">Implementación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nivel servicio *</label>
              <Select value={nivelServicio} onValueChange={(v) => setNivelServicio(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Base">Base</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Inicio contrato *</label>
              <Input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fin contrato *</label>
              <Input type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Versión del Core</label>
            <Input value={coreVersion} onChange={e => setCoreVersion(e.target.value)} placeholder="ej. 2024.4.1" />
            <p className="text-[10px] text-muted-foreground">Los módulos contratados se configuran luego desde el detalle del cliente.</p>
          </div>
          <Button onClick={handleCreate} disabled={createClient.isPending} className="w-full">
            {createClient.isPending ? "Creando..." : "Crear Cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
