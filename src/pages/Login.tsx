import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Eye, EyeOff } from "lucide-react";
import sysdelogo from "@/assets/logo-sysde.png";

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
            <p className="text-xs font-medium text-muted-foreground mb-2">Cuentas demo <span className="italic">(clic para autocompletar)</span>:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              {[
                { label: "Admin", email: "admin@sysde.com", pw: "AdminSysde2026!" },
                { label: "PM", email: "pm@sysde.com", pw: "PmFernando2026!" },
                { label: "Soporte (Hellen)", email: "hellen.calvo@sysde.com", pw: "HellenCalvo2026!" },
                { label: "Aurum", email: "gerente.aurum@sysde.com", pw: "GerenteAurum2026!" },
                { label: "Arkfin", email: "gerente.arkfin@sysde.com", pw: "GerenteArkfin2026!" },
                { label: "Apex", email: "gerente.apex@sysde.com", pw: "GerenteApex2026!" },
                { label: "Fauricio Navarro", email: "navarro.fuentes@sysde.com", pw: "Sysde2026!" },
                { label: "Olga Lucia Cuervo", email: "olga.lucia@sysde.com", pw: "Sysde2026!" },
                { label: "Orlando Castro", email: "orlando.castro@sysde.com", pw: "Sysde2026!" },
                { label: "Carlos Solis", email: "solis.sequeira@sysde.com", pw: "Sysde2026!" },
              ].map((acc) => (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
