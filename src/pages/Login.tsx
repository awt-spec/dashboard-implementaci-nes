import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle, ArrowRight, Eye, EyeOff, Headset, KeyRound, Loader2,
  Lock, Mail, Moon, ShieldCheck, Sun, Workflow,
} from "lucide-react";
import sysdelogo from "@/assets/logo-sysde.png";
import { applyTheme, readStoredTheme, storeTheme } from "@/lib/theme";
import { mensajeDeError } from "@/lib/authErrors";
import { cn } from "@/lib/utils";

/** Lo que el ERP hace, en la puerta de entrada. Sin cifras inventadas. */
const CAPACIDADES = [
  { Icon: Headset, titulo: "Soporte con SLA", detalle: "Reloj de primera respuesta y de resolución por prioridad" },
  { Icon: Workflow, titulo: "Implementaciones", detalle: "Fases, entregables y riesgos de cada proyecto" },
  { Icon: ShieldCheck, titulo: "Contratos", detalle: "Vigencia, horas incluidas y cobertura caso por caso" },
];

/**
 * Foco y error NO pueden verse igual, y acá cuesta más que en otras paletas:
 * --primary (0 72% 51%) y --destructive (0 84% 60%) son casi el mismo tono.
 * El Input base enfoca con `ring-ring`, que es ese rojo. Resultado: el campo
 * con autofoco arrancaba con un contorno rojo idéntico al de un campo
 * inválido — "algo está mal" antes de escribir una tecla — y una vez que
 * fallaba el login, el campo enfocado y el campo con error eran el mismo
 * dibujo.
 *
 * Un halo rojo más suave tampoco alcanzaba: sigue siendo rojo. El foco pasa a
 * ser NEUTRO, que además es la convención del sistema operativo; el rojo queda
 * reservado para el error, junto con el fondo teñido y el aviso de arriba.
 *
 * El `!` fuerza el orden sobre las utilidades del componente base; sin él
 * dependería de cómo Tailwind ordene la hoja, que no es algo que convenga
 * asumir.
 */
const CAMPO =
  "h-11 !ring-offset-0 transition-shadow focus-visible:!ring-[3px] focus-visible:!ring-foreground/15 focus-visible:border-foreground/45";
const CAMPO_ERROR = "border-destructive/60 bg-destructive/[0.04]";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dark, setDark] = useState(() => readStoredTheme() === "dark");
  useEffect(() => {
    const theme = dark ? "dark" : "light";
    applyTheme(theme);
    storeTheme(theme);
  }, [dark]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      // El error vive en la pantalla, no en un toast que se va solo mientras
      // el usuario relee lo que escribió.
      setError(mensajeDeError(err.message));
      setPassword("");
      setLoading(false);
      return;
    }
    // Sin setLoading(false) en el camino feliz: la sesión desmonta esta
    // pantalla, y apagarlo antes deja el botón parpadeando.
  };

  const verCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Panel de marca ────────────────────────────────────────────────
          Sólo de lg para arriba. En teléfono la pantalla es el formulario:
          una portada que empuja el campo de correo fuera de la vista es
          decoración que cuesta un scroll. */}
      <aside className="relative hidden overflow-hidden border-r border-black/10 bg-primary p-10 text-primary-foreground shadow-[8px_0_24px_-12px_rgba(0,0,0,0.35)] lg:flex lg:flex-col lg:justify-between xl:p-14">
        {/* Profundidad: dos halos y una retícula, todo en CSS. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-32 -right-16 h-[380px] w-[380px] rounded-full bg-black/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 p-2 backdrop-blur-sm ring-1 ring-white/25">
            <img src={sysdelogo} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold tracking-tight">SYSDE</p>
            <p className="text-[11.5px] font-medium text-primary-foreground/75">Gestión de Implementaciones</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[30px] font-extrabold leading-[1.15] tracking-tight xl:text-[34px]">
            Soporte, proyectos y contratos en una sola pantalla.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-primary-foreground/80">
            El estado real de cada cliente, medido contra lo que se firmó.
          </p>

          <ul className="mt-8 space-y-4">
            {CAPACIDADES.map(({ Icon, titulo, detalle }) => (
              <li key={titulo} className="flex items-start gap-3">
                <span className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/20">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-tight">{titulo}</span>
                  <span className="block text-[12px] leading-snug text-primary-foreground/70">{detalle}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] font-medium text-primary-foreground/55">
          © {new Date().getFullYear()} SYSDE · Acceso restringido a personal autorizado
        </p>
      </aside>

      {/* ── Formulario ──────────────────────────────────────────────────── */}
      <main className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setDark(!dark)}
          aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="absolute right-4 top-4 h-9 w-9 text-muted-foreground"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="w-full max-w-[368px] animate-fade-in">
          {/* Marca en teléfono, donde el panel de la izquierda no existe. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary p-2">
              <img src={sysdelogo} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <p className="text-[14px] font-extrabold tracking-tight text-foreground">SYSDE</p>
              <p className="text-[11px] font-medium text-muted-foreground">Gestión de Implementaciones</p>
            </div>
          </div>

          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
            Iniciar sesión
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Ingresá con tu cuenta corporativa.
          </p>

          {error && (
            <Alert variant="destructive" className="mt-5 border-destructive/40 bg-destructive/[0.06] py-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-[12.5px] font-medium">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12px] font-semibold text-foreground">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="nombre@sysde.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  aria-invalid={!!error}
                  required
                  className={cn(CAMPO, "pl-9", error && CAMPO_ERROR)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px] font-semibold text-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={verCaps}
                  onKeyDown={verCaps}
                  onBlur={() => setCapsLock(false)}
                  aria-invalid={!!error}
                  required
                  className={cn(CAMPO, "pl-9 pr-11", error && CAMPO_ERROR)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Mayúsculas activas: la causa más común de "no me deja entrar"
                  con la contraseña correcta. */}
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[11.5px] font-medium text-warning transition-opacity",
                  capsLock ? "opacity-100" : "pointer-events-none opacity-0",
                )}
                aria-live="polite"
              >
                <KeyRound className="h-3 w-3 shrink-0" />
                Bloq Mayús está activado
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="group h-11 w-full gap-2 text-[13.5px] font-bold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Ingresando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-balance text-center text-[11.5px] leading-relaxed text-muted-foreground">
            ¿Problemas para entrar? Escribinos a{" "}
            <a
              href="mailto:soporte@sysde.com"
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              soporte@sysde.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
