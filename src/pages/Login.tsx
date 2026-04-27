import { useState, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Eye, EyeOff, Shield, Briefcase, Headphones, Crown, ShieldAlert, User as UserIcon, type LucideProps } from "lucide-react";
import sysdelogo from "@/assets/logo-sysde.png";
import { cn } from "@/lib/utils";

type DemoAccount = {
  label: string;
  email: string;
  pw: string;
  /** Si está presente, se renderiza con tratamiento destacado (botón hero) */
  featured?: boolean;
  /** Icono opcional para el avatar del botón */
  Icon?: ComponentType<LucideProps>;
  /** Tone del avatar: amber, primary, info, default */
  tone?: "amber" | "primary" | "info" | "default";
  /** Subtítulo opcional debajo del label */
  hint?: string;
};

const SYSDE_USERS: DemoAccount[] = [
  {
    label: "CEO",
    email: "ceo@sysde.com",
    pw: "CeoSysde2026!",
    featured: true,
    Icon: Crown,
    tone: "amber",
    hint: "Cockpit ejecutivo · read-only",
  },
  { label: "Admin", email: "admin@sysde.com", pw: "AdminSysde2026!", Icon: ShieldAlert, tone: "primary" },
  { label: "PM", email: "pm@sysde.com", pw: "PmFernando2026!", Icon: Briefcase, tone: "primary" },
  { label: "Soporte (Hellen)", email: "hellen.calvo@sysde.com", pw: "HellenCalvo2026!", Icon: Headphones, tone: "info" },
  { label: "Fauricio Navarro", email: "navarro.fuentes@sysde.com", pw: "Sysde2026!", Icon: UserIcon },
  { label: "Olga Lucia Cuervo", email: "olga.lucia@sysde.com", pw: "Sysde2026!", Icon: UserIcon },
  { label: "Orlando Castro", email: "orlando.castro@sysde.com", pw: "Sysde2026!", Icon: UserIcon },
  { label: "Carlos Solis", email: "solis.sequeira@sysde.com", pw: "Sysde2026!", Icon: UserIcon },
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

  const fillCredentials = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.pw);
  };

  const TONE_STYLES: Record<NonNullable<DemoAccount["tone"]>, { avatar: string; ring: string; gradient: string }> = {
    amber:   { avatar: "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30", ring: "ring-amber-500/30 hover:ring-amber-500/50",   gradient: "from-amber-500/5 via-transparent to-amber-500/5" },
    primary: { avatar: "bg-primary/15 text-primary",                                                              ring: "ring-primary/20 hover:ring-primary/40",          gradient: "from-primary/5 via-transparent to-transparent" },
    info:    { avatar: "bg-info/15 text-info",                                                                    ring: "ring-info/20 hover:ring-info/40",                gradient: "from-info/5 via-transparent to-transparent" },
    default: { avatar: "bg-muted text-muted-foreground",                                                          ring: "ring-border hover:ring-primary/30",              gradient: "" },
  };

  const renderAccountList = (accounts: DemoAccount[]) => {
    const featured = accounts.filter(a => a.featured);
    const regular = accounts.filter(a => !a.featured);

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {/* Featured: botones grandes con avatar + label + hint */}
        {featured.map((acc) => {
          const tone = TONE_STYLES[acc.tone || "amber"];
          const Icon = acc.Icon || Crown;
          return (
            <button
              key={acc.email}
              type="button"
              onClick={() => fillCredentials(acc)}
              className={cn(
                "w-full group relative overflow-hidden flex items-center gap-3 p-2.5 rounded-lg border bg-card text-left transition-all ring-1",
                tone.ring
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-r opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none", tone.gradient)} />
              <div className={cn("relative h-9 w-9 rounded-xl flex items-center justify-center shrink-0", tone.avatar)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="relative flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight truncate">{acc.label}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{acc.hint || acc.email}</p>
              </div>
              <span className="relative text-[9px] uppercase tracking-wider font-bold text-amber-500 shrink-0 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10">
                Demo
              </span>
            </button>
          );
        })}

        {/* Separador si hay featured + regular */}
        {featured.length > 0 && regular.length > 0 && (
          <div className="flex items-center gap-2 py-0.5">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Otros usuarios</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>
        )}

        {/* Regular: filas compactas con avatar pequeño + label + email */}
        {regular.map((acc) => {
          const tone = TONE_STYLES[acc.tone || "default"];
          const Icon = acc.Icon || UserIcon;
          return (
            <button
              key={acc.email}
              type="button"
              onClick={() => fillCredentials(acc)}
              className="w-full group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/60 transition-colors text-left"
            >
              <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0 border border-border/40", tone.avatar)}>
                <Icon className="h-3 w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground leading-tight truncate">{acc.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{acc.email}</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

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
