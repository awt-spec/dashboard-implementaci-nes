import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Eye, EyeOff, Shield, Briefcase, Headphones } from "lucide-react";
import sysdelogo from "@/assets/logo-sysde.png";

type DemoAccount = { label: string; email: string; pw: string };

const SYSDE_USERS: DemoAccount[] = [
  { label: "Admin", email: "admin@sysde.com", pw: "AdminSysde2026!" },
  { label: "PM", email: "pm@sysde.com", pw: "PmFernando2026!" },
  { label: "Soporte (Hellen)", email: "hellen.calvo@sysde.com", pw: "HellenCalvo2026!" },
  { label: "Fauricio Navarro", email: "navarro.fuentes@sysde.com", pw: "Sysde2026!" },
  { label: "Olga Lucia Cuervo", email: "olga.lucia@sysde.com", pw: "Sysde2026!" },
  { label: "Orlando Castro", email: "orlando.castro@sysde.com", pw: "Sysde2026!" },
  { label: "Carlos Solis", email: "solis.sequeira@sysde.com", pw: "Sysde2026!" },
];

// Usuarios con rol "cliente" (Portal Cliente) — uno por cada empresa activa.
// Generados por scripts/seed-cliente-users.mjs. Al loguearse van al
// ClientPortalDashboard (panel horas + minutas + casos scopeados a su empresa).
const IMPLEMENTATION_CLIENTS: DemoAccount[] = [
  { label: "Apex", email: "cliente.apex@sysde.com", pw: "ClienteApex2026!" },
  { label: "Arkfin", email: "cliente.arkfin@sysde.com", pw: "ClienteArkfin2026!" },
  { label: "Aurum", email: "cliente.aurum@sysde.com", pw: "ClienteAurum2026!" },
];

const SUPPORT_CLIENTS: DemoAccount[] = [
  { label: "CFE Panamá", email: "cliente.cfe@sysde.com", pw: "ClienteCfePanam2026!" },
  { label: "CMI", email: "cliente.cmi@sysde.com", pw: "ClienteCmi2026!" },
  { label: "Coopecar", email: "cliente.coopecar@sysde.com", pw: "ClienteCoopecar2026!" },
  { label: "Credicefi", email: "cliente.credicefi@sysde.com", pw: "ClienteCredicefi2026!" },
  { label: "FIACG", email: "cliente.fiacg@sysde.com", pw: "ClienteFiacg2026!" },
  { label: "Fundap", email: "cliente.fundap@sysde.com", pw: "ClienteFundap2026!" },
  { label: "Quiero Confianza (ION)", email: "cliente.ion@sysde.com", pw: "ClienteQuieroConfianzaIon2026!" },
  { label: "SAF UPV", email: "cliente.safupv@sysde.com", pw: "ClienteSafUpv2026!" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Error de autenticación", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const renderAccountList = (accounts: DemoAccount[]) => (
    <div className="space-y-1 text-xs text-muted-foreground max-h-64 overflow-y-auto pr-1">
      {accounts.map((acc) => (
        <button
          key={acc.email}
          type="button"
          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent/60 transition-colors cursor-pointer"
          onClick={() => { setEmail(acc.email); setPassword(acc.pw); }}
        >
          <strong className="text-foreground">{acc.label}:</strong> {acc.email}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-16 w-16 rounded-xl bg-primary flex items-center justify-center mb-2 p-2">
            <img src={sysdelogo} alt="Sysde" className="h-full w-full object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Sysde Support</CardTitle>
          <CardDescription>Ingresa tus credenciales para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Correo electrónico</label>
              <Input
                type="email"
                placeholder="correo@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Cuentas demo <span className="italic">(clic para autocompletar)</span>:
            </p>
            <Tabs defaultValue="sysde" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger value="sysde" className="text-[10px] gap-1 px-1 py-1.5">
                  <Shield className="h-3 w-3" /> Sysde
                </TabsTrigger>
                <TabsTrigger value="impl" className="text-[10px] gap-1 px-1 py-1.5">
                  <Briefcase className="h-3 w-3" /> Implem.
                </TabsTrigger>
                <TabsTrigger value="support" className="text-[10px] gap-1 px-1 py-1.5">
                  <Headphones className="h-3 w-3" /> Soporte
                </TabsTrigger>
              </TabsList>
              <TabsContent value="sysde" className="mt-2">{renderAccountList(SYSDE_USERS)}</TabsContent>
              <TabsContent value="impl" className="mt-2">{renderAccountList(IMPLEMENTATION_CLIENTS)}</TabsContent>
              <TabsContent value="support" className="mt-2">{renderAccountList(SUPPORT_CLIENTS)}</TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
