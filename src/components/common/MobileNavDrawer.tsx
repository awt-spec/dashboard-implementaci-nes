import { useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SectionLabel } from "@/components/common/StatCard";
import { projectInfo } from "@/data/projectData";
import { useAuth } from "@/hooks/useAuth";
import { visibleNav } from "@/lib/navigation";
import { useMyPermissions } from "@/hooks/usePermissions";
import { useClients } from "@/hooks/useClients";
import { useSLASummary } from "@/hooks/useSLASummary";
import { cn } from "@/lib/utils";

export interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  pm: "PM",
  gerente: "Gerente",
  gerente_soporte: "Gte. Soporte",
  csr: "CSR",
};

const STATUS_DOT: Record<string, string> = {
  activo: "bg-success",
  "en-riesgo": "bg-destructive",
  completado: "bg-info",
  pausado: "bg-muted-foreground",
};

/** Drawer de navegación móvil: mismas secciones y gating por rol que AppSidebar. */
export function MobileNavDrawer({ open, onOpenChange, activeSection, onSectionChange }: MobileNavDrawerProps) {
  const { role, profile, signOut } = useAuth();
  const { data: myPerms } = useMyPermissions();
  const { data: clientsData } = useClients();
  const { data: slaSummary } = useSLASummary();
  const [search, setSearch] = useState("");

  const mainNav = useMemo(() => visibleNav(role, myPerms), [role, myPerms]);

  const allClients = (clientsData || []) as any[];
  const term = search.trim().toLowerCase();
  const byName = (list: any[]) =>
    term ? list.filter((c) => String(c.name).toLowerCase().includes(term)) : list;

  const implClients = byName(allClients.filter((c) => c.client_type === "implementacion"));
  const supportClients = byName(allClients.filter((c) => c.client_type === "soporte"));

  // Mismo gating que el sidebar: "gerente" no ve el stack de clientes y
  // gerente_soporte/csr no ven implementación.
  const showClients = role !== "gerente";
  const showImpl = showClients && role !== "gerente_soporte" && role !== "csr";

  const go = (section: string) => {
    onSectionChange(section);
    onOpenChange(false);
  };

  const renderClients = (list: any[], prefix: string) =>
    list.map((client) => {
      const sectionId = `${prefix}${client.id}`;
      const isActive = activeSection === sectionId;
      return (
        <button
          key={sectionId}
          type="button"
          onClick={() => go(sectionId)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
            isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
          )}
        >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[client.status] || "bg-muted-foreground")} />
          <span className="truncate text-xs">{client.name}</span>
        </button>
      );
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[86%] max-w-[320px] flex-col gap-0 p-0 md:hidden">
        {/* Cabecera: logo + marca + rol del usuario */}
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-black text-primary-foreground">S</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-bold leading-tight text-foreground">{projectInfo.company}</h2>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {profile?.full_name || "Usuario"} · {ROLE_LABEL[role || ""] || "—"}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <SectionLabel className="px-3 pb-1.5">Navegación</SectionLabel>
          <nav className="space-y-0.5">
            {mainNav.map((item) => {
              const isActive = activeSection === item.id;
              // Badge de vencidos solo en Soporte, igual que en el sidebar.
              const overdue = item.id === "soporte" ? (slaSummary?.overdue ?? 0) : 0;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                  {overdue > 0 && (
                    <span className="relative ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold tabular-nums text-destructive-foreground">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-30 animate-ping" />
                      <span className="relative">{overdue}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {showClients && allClients.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="px-1 pb-2">
                <Input
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {showImpl && implClients.length > 0 && (
                <div className="mb-2">
                  <SectionLabel className="px-3 pb-1.5">Implementación ({implClients.length})</SectionLabel>
                  <div className="space-y-0.5">{renderClients(implClients, "client-")}</div>
                </div>
              )}

              {supportClients.length > 0 && (
                <div>
                  <SectionLabel className="px-3 pb-1.5">Soporte ({supportClients.length})</SectionLabel>
                  <div className="space-y-0.5">{renderClients(supportClients, "support-client-")}</div>
                </div>
              )}

              {term && implClients.length === 0 && supportClients.length === 0 && (
                <p className="px-3 py-2 text-[11.5px] italic text-muted-foreground">Sin resultados</p>
              )}
            </>
          )}
        </div>

        <div
          className="border-t border-border p-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
