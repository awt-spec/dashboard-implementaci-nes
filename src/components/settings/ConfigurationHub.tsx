import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Search, X, Shield, Users, Lock, Activity, Brain, Sparkles,
  BookOpen, ListChecks, Building2, KeyRound, TrendingUp, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Sub-componentes (existentes en otros lados)
import { SystemUsersTab } from "@/components/admin/SystemUsersTab";
import { TeamHub } from "@/components/team/TeamHub";
import { RBACPermissionsTab } from "@/components/admin/RBACPermissionsTab";
import { TeamActivityPanel } from "@/components/admin/TeamActivityPanel";
import { TeamLevelAIPanel } from "@/components/admin/TeamLevelAIPanel";
import { ClassificationTab, SecurityTab, UsageStatsTab } from "@/components/support/AIUsageDashboard";
import { ActivePolicyPanel } from "./ActivePolicyPanel";
import { BusinessRulesPanel } from "./BusinessRulesPanel";
import { ClientOverridesPanel } from "./ClientOverridesPanel";
import { AIStrategyPanel } from "./AIStrategyPanel";

// ─── Definición de secciones ─────────────────────────────────────────────

type Role = "admin" | "pm";

interface ConfigSection {
  id: string;
  label: string;
  hint: string;
  Icon: typeof Settings;
  tone: string;
  roles: Role[];
  Component: React.ComponentType;
}

interface ConfigGroup {
  id: string;
  label: string;
  Icon: typeof Settings;
  sections: ConfigSection[];
}

const GROUPS: ConfigGroup[] = [
  {
    id: "users",
    label: "Usuarios y Equipo",
    Icon: Users,
    sections: [
      {
        id: "accounts",
        label: "Cuentas del sistema",
        hint: "Crear, editar y gestionar accesos · roles",
        Icon: Shield,
        tone: "bg-destructive/15 text-destructive border-destructive/30",
        roles: ["admin"],
        Component: SystemUsersTab,
      },
      {
        id: "team",
        label: "Equipo SYSDE",
        hint: "Miembros del equipo · colaboradores",
        Icon: Users,
        tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
        roles: ["admin"],
        Component: TeamHub,
      },
      {
        id: "rbac",
        label: "Permisos RBAC",
        hint: "Política de acceso por rol · matriz",
        Icon: Lock,
        tone: "bg-primary/15 text-primary border-primary/30",
        roles: ["admin"],
        Component: RBACPermissionsTab,
      },
      {
        id: "activity",
        label: "Actividad del equipo",
        hint: "Logs · auditoría de acciones",
        Icon: Activity,
        tone: "bg-info/15 text-info border-info/30",
        roles: ["admin"],
        Component: TeamActivityPanel,
      },
    ],
  },
  {
    id: "ai",
    label: "Inteligencia Artificial",
    Icon: Brain,
    sections: [
      {
        id: "ai-classification",
        label: "Clasificación de tickets",
        hint: "Cobertura · categorías · cliente",
        Icon: Brain,
        tone: "bg-violet-500/15 text-violet-500 border-violet-500/30",
        roles: ["admin", "pm"],
        Component: ClassificationTab,
      },
      {
        id: "ai-level",
        label: "Nivel IA por equipo",
        hint: "Configuración por miembro del equipo",
        Icon: Sparkles,
        tone: "bg-amber-500/15 text-amber-500 border-amber-500/30",
        roles: ["admin"],
        Component: TeamLevelAIPanel,
      },
      {
        id: "ai-security",
        label: "Seguridad y cifrado",
        hint: "Redacción · rate limit · logs",
        Icon: Shield,
        tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
        roles: ["admin", "pm"],
        Component: SecurityTab,
      },
      {
        id: "ai-tokens",
        label: "Tokens y agentes",
        hint: "Consumo · costo · performance",
        Icon: TrendingUp,
        tone: "bg-info/15 text-info border-info/30",
        roles: ["admin", "pm"],
        Component: UsageStatsTab,
      },
    ],
  },
  {
    id: "system",
    label: "Sistema y Políticas",
    Icon: Settings,
    sections: [
      {
        id: "policy",
        label: "Política activa v4.5",
        hint: "Reglas vigentes de cierre",
        Icon: BookOpen,
        tone: "bg-primary/15 text-primary border-primary/30",
        roles: ["admin", "pm"],
        Component: ActivePolicyPanel,
      },
      {
        id: "rules",
        label: "Reglas de negocio",
        hint: "Triggers · condiciones",
        Icon: ListChecks,
        tone: "bg-amber-500/15 text-amber-500 border-amber-500/30",
        roles: ["admin", "pm"],
        Component: BusinessRulesPanel,
      },
      {
        id: "overrides",
        label: "Overrides por cliente",
        hint: "Customizaciones puntuales",
        Icon: Building2,
        tone: "bg-info/15 text-info border-info/30",
        roles: ["admin", "pm"],
        Component: ClientOverridesPanel,
      },
      {
        id: "ai-strategy",
        label: "IA & Estrategia",
        hint: "Recomendaciones de estrategia con IA",
        Icon: Sparkles,
        tone: "bg-violet-500/15 text-violet-500 border-violet-500/30",
        roles: ["admin", "pm"],
        Component: AIStrategyPanel,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════════════════════════════════════

export function ConfigurationHub() {
  const { role } = useAuth();
  const [active, setActive] = useState<string>("accounts");
  const [search, setSearch] = useState("");

  // Filtrar secciones por rol del usuario
  const visibleGroups = useMemo(() => {
    return GROUPS.map((g) => ({
      ...g,
      sections: g.sections.filter((s) => role && s.roles.includes(role as Role)),
    })).filter((g) => g.sections.length > 0);
  }, [role]);

  // Aplicar búsqueda
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleGroups;
    return visibleGroups
      .map((g) => ({
        ...g,
        sections: g.sections.filter(
          (s) => s.label.toLowerCase().includes(q) || s.hint.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.sections.length > 0);
  }, [visibleGroups, search]);

  // Encontrar la sección activa (siempre del set sin filtrar para no perderla al buscar)
  const activeSection = useMemo(() => {
    for (const g of visibleGroups) {
      const s = g.sections.find((s) => s.id === active);
      if (s) return { group: g, section: s };
    }
    // Fallback al primero disponible
    const first = visibleGroups[0]?.sections[0];
    if (first) return { group: visibleGroups[0], section: first };
    return null;
  }, [visibleGroups, active]);

  // Stats totales (visible para el usuario)
  const totalSections = useMemo(
    () => visibleGroups.reduce((acc, g) => acc + g.sections.length, 0),
    [visibleGroups]
  );

  if (visibleGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-bold">Sin acceso a configuración</p>
          <p className="text-xs text-muted-foreground">Tu rol no tiene secciones disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ════════ HERO ════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-4">
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Centro de configuración
              </p>
              <h2 className="text-lg font-black leading-tight mt-0.5">
                Sistema, usuarios e IA
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {totalSections} secciones · {visibleGroups.length} categorías
              </p>
            </div>
          </div>
          {activeSection && (
            <Badge
              variant="outline"
              className={cn("gap-1.5 h-7 px-2", activeSection.section.tone)}
            >
              <activeSection.section.Icon className="h-3 w-3" />
              {activeSection.section.label}
            </Badge>
          )}
        </div>
      </div>

      {/* ════════ LAYOUT: Sidebar + Contenido ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* SIDEBAR vertical */}
        <Card className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-7rem)] overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar configuración…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded hover:bg-muted/60 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Search className="h-6 w-6 mx-auto text-muted-foreground/40" />
                <p className="text-[11px] text-muted-foreground">Sin resultados</p>
                <button
                  onClick={() => setSearch("")}
                  className="text-[10px] text-primary hover:underline"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              filteredGroups.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                    <g.Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      {g.label}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {g.sections.map((s) => {
                      const isActive = active === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setActive(s.id)}
                          className={cn(
                            "w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all group",
                            isActive
                              ? "bg-primary/[0.08] ring-1 ring-primary/20"
                              : "hover:bg-muted/40"
                          )}
                        >
                          <div className={cn(
                            "h-7 w-7 rounded-md flex items-center justify-center shrink-0 border transition-all",
                            isActive ? s.tone : "bg-card border-border/60 text-muted-foreground"
                          )}>
                            <s.Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-xs leading-tight truncate transition-colors",
                              isActive ? "font-bold text-foreground" : "font-semibold text-foreground/80 group-hover:text-foreground"
                            )}>
                              {s.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{s.hint}</p>
                          </div>
                          {isActive && (
                            <ChevronRight className="h-3 w-3 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* CONTENIDO de la sección activa */}
        <div className="min-w-0">
          {activeSection ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection.section.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <activeSection.section.Component />
              </motion.div>
            </AnimatePresence>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <p className="text-sm">Seleccioná una sección</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
