import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateClient } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, UserPlus } from "lucide-react";

type ClientePermission = "viewer" | "editor" | "admin";

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

  // Invitar primer usuario cliente (opcional)
  const [invitePrimer, setInvitePrimer] = useState(false);
  const [primerName, setPrimerName] = useState("");
  const [primerEmail, setPrimerEmail] = useState("");
  const [primerPassword, setPrimerPassword] = useState("");
  const [primerPermission, setPrimerPermission] = useState<ClientePermission>("admin");

  const createClient = useCreateClient();
  const { toast } = useToast();

  const reset = () => {
    setName(""); setCountry(""); setIndustry(""); setContactName(""); setContactEmail("");
    setContractStart(""); setContractEnd(""); setStatus("activo"); setCoreVersion("");
    setClientType("soporte"); setNivelServicio("Base");
    setInvitePrimer(false); setPrimerName(""); setPrimerEmail(""); setPrimerPassword(""); setPrimerPermission("admin");
  };

  const handleCreate = async () => {
    if (!name || !country || !contactName || !contactEmail || !contractStart || !contractEnd) {
      toast({ title: "Campos requeridos", description: "Completa todos los campos obligatorios", variant: "destructive" });
      return;
    }

    // Validar datos del primer usuario cliente si se decide invitar
    if (invitePrimer) {
      if (!primerEmail || primerPassword.length < 8) {
        toast({
          title: "Datos del primer usuario incompletos",
          description: "Email y contraseña (≥8) son requeridos para invitar al primer usuario.",
          variant: "destructive",
        });
        return;
      }
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

      // Segundo paso opcional: crear el primer usuario cliente
      let inviteMessage = "";
      if (invitePrimer) {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: {
            action: "create_cliente",
            email: primerEmail,
            password: primerPassword,
            full_name: primerName || primerEmail.split("@")[0],
            client_id: id,
            permission_level: primerPermission,
          },
        });
        if (error || data?.error) {
          const msg = (error as any)?.message || data?.error || "Error desconocido";
          toast({
            title: "Cliente creado, pero no se pudo invitar al primer usuario",
            description: msg,
            variant: "destructive",
          });
        } else {
          inviteMessage = ` · Usuario ${primerEmail} invitado como ${primerPermission}`;
        }
      }

      toast({ title: "Cliente creado", description: `${name} · ${clientType} · ${nivelServicio}${inviteMessage}` });
      setOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nuevo Cliente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* ── Bloque opcional: primer usuario cliente ── */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={invitePrimer}
                onCheckedChange={(c) => setInvitePrimer(Boolean(c))}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">Invitar primer usuario al portal cliente</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Opcional. Crea una cuenta con rol «cliente» y la vincula a esta empresa para que el cliente pueda acceder al portal.
                </p>
              </div>
            </label>

            {invitePrimer && (
              <div className="space-y-2 pl-6">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-muted-foreground">Nombre completo</label>
                    <Input value={primerName} onChange={e => setPrimerName(e.target.value)} placeholder="Ana López" className="text-sm h-8" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-muted-foreground">Nivel acceso</label>
                    <Select value={primerPermission} onValueChange={(v) => setPrimerPermission(v as ClientePermission)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer" className="text-xs">Solo lectura</SelectItem>
                        <SelectItem value="editor" className="text-xs">Editor (crea casos)</SelectItem>
                        <SelectItem value="admin" className="text-xs">Admin (gestiona usuarios)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium text-muted-foreground">Email *</label>
                  <Input type="email" value={primerEmail} onChange={e => setPrimerEmail(e.target.value)} placeholder="ana@cliente.com" className="text-sm h-8" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium text-muted-foreground">Contraseña inicial * (≥8)</label>
                  <Input type="text" value={primerPassword} onChange={e => setPrimerPassword(e.target.value)} placeholder="Generá una segura" className="text-sm h-8 font-mono" />
                  <p className="text-[9px] text-muted-foreground">Envíasela al usuario por un canal seguro. La puede cambiar después.</p>
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleCreate} disabled={createClient.isPending} className="w-full">
            {createClient.isPending ? "Creando..." : "Crear Cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
