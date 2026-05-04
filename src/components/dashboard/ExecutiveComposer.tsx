import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  LayoutDashboard, BookmarkPlus, Pin, PinOff, Trash2,
  Loader2, ChevronRight, ChevronDown, Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useSavedViews, useSaveView, useDeleteView, useTogglePinView,
} from "@/hooks/useSavedViews";

// ─── Tipos ──────────────────────────────────────────────────────────

export interface WidgetDef {
  key: string;
  label: string;
  description?: string;
  group: "salud" | "tareas" | "alertas" | "tiempo";
  /** Si true, viene activado por default cuando no hay vista guardada. */
  defaultOn?: boolean;
}

const GROUP_LABELS: Record<WidgetDef["group"], string> = {
  salud: "Salud y resumen",
  tareas: "Tareas y entregables",
  alertas: "Alertas y riesgos",
  tiempo: "Tiempo y proyectos",
};

// ─── Props ──────────────────────────────────────────────────────────

interface Props {
  /** Lista de widgets disponibles para componer la vista. */
  widgets: WidgetDef[];
  /** Set de widget keys actualmente activos. */
  selected: Set<string>;
  /** Setter del Set de widgets activos. */
  onChange: (next: Set<string>) => void;
}

// ─── Componente ─────────────────────────────────────────────────────

export function ExecutiveComposer({ widgets, selected, onChange }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [loadedFromSaved, setLoadedFromSaved] = useState<string | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const { data: savedViews = [], isLoading } = useSavedViews("executive");
  const saveMutation = useSaveView();
  const deleteMutation = useDeleteView();
  const togglePinMutation = useTogglePinView();

  const pinnedView = savedViews.find(v => v.is_pinned);

  // Auto-cargar vista pinned al primer mount
  useEffect(() => {
    if (autoLoaded || isLoading) return;
    if (pinnedView?.config?.widgets && Array.isArray(pinnedView.config.widgets)) {
      onChange(new Set(pinnedView.config.widgets));
      setLoadedFromSaved(pinnedView.name);
    }
    setAutoLoaded(true);
  }, [pinnedView, isLoading, autoLoaded, onChange]);

  // ── Handlers ──
  const toggleWidget = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
    setLoadedFromSaved(null); // ya editaste, ya no es la vista guardada
  };

  const selectAll = () => {
    onChange(new Set(widgets.map(w => w.key)));
    setLoadedFromSaved(null);
  };
  const selectNone = () => {
    onChange(new Set());
    setLoadedFromSaved(null);
  };
  const selectDefaults = () => {
    onChange(new Set(widgets.filter(w => w.defaultOn).map(w => w.key)));
    setLoadedFromSaved(null);
  };

  const loadSaved = (view: { id: string; name: string; config: any }) => {
    if (Array.isArray(view.config?.widgets)) {
      onChange(new Set(view.config.widgets));
      setLoadedFromSaved(view.name);
      setComposerOpen(false);
      toast.success(`Vista "${view.name}" cargada`);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) return toast.error("Ponele un nombre");
    try {
      await saveMutation.mutateAsync({
        scope: "executive",
        name: saveName.trim(),
        preset_key: "custom",
        config: { widgets: Array.from(selected) },
      });
      toast.success(`Vista "${saveName.trim()}" guardada`);
      setLoadedFromSaved(saveName.trim());
      setSaveDialogOpen(false);
      setSaveName("");
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    }
  };

  const setAsDefault = async () => {
    if (!loadedFromSaved) return toast.error("Primero guardá la vista actual");
    const view = savedViews.find(v => v.name === loadedFromSaved);
    if (!view) return;
    try {
      // Despinear cualquier otra
      if (pinnedView && pinnedView.id !== view.id) {
        await togglePinMutation.mutateAsync({ id: pinnedView.id, pinned: false });
      }
      await togglePinMutation.mutateAsync({ id: view.id, pinned: !view.is_pinned });
      toast.success(view.is_pinned ? "Default removido" : `"${view.name}" es ahora tu vista predeterminada`);
    } catch (e: any) {
      toast.error(e.message || "Error fijando default");
    }
  };

  // ── Group widgets by section ──
  const groupedWidgets = useMemo(() => {
    const map = new Map<WidgetDef["group"], WidgetDef[]>();
    widgets.forEach(w => {
      if (!map.has(w.group)) map.set(w.group, []);
      map.get(w.group)!.push(w);
    });
    return map;
  }, [widgets]);

  const activeView = loadedFromSaved
    ? savedViews.find(v => v.name === loadedFromSaved)
    : null;
  const isPinned = activeView?.is_pinned;

  return (
    <Card className="border-border/60 overflow-hidden">
      {/* Trigger compacto — single-row, padding reducido. Era una card grande
          ocupando 90px+ para una settings; ahora son 48px de altura total. */}
      <button
        onClick={() => setComposerOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="h-7 w-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
          <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold">¿Qué querés ver hoy?</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {selected.size}/{widgets.length} secciones · {savedViews.length} vista{savedViews.length === 1 ? "" : "s"}
          </span>
          {loadedFromSaved && (
            <Badge variant="outline" className="text-[9px] gap-0.5 bg-primary/10 text-primary border-primary/30 h-4">
              {isPinned && <Pin className="h-2 w-2" />}
              {loadedFromSaved}
            </Badge>
          )}
        </div>
        {composerOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence>
        {composerOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-4">
              {/* Saved views grid */}
              {!isLoading && savedViews.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">Mis vistas guardadas</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {savedViews.map(v => (
                      <div key={v.id} className="group relative">
                        <button
                          onClick={() => loadSaved(v)}
                          className={cn(
                            "w-full text-left flex items-center gap-2 p-2.5 rounded-lg border transition-colors",
                            v.is_pinned ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card hover:border-primary/40"
                          )}
                        >
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Eye className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-semibold truncate">{v.name}</p>
                              {v.is_pinned && (
                                <Badge variant="outline" className="text-[8px] h-4 gap-0.5 bg-primary/10 text-primary border-primary/30">
                                  <Pin className="h-2 w-2" /> Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {Array.isArray(v.config?.widgets) ? v.config.widgets.length : 0} secciones
                            </p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </button>
                        <div className="absolute top-1.5 right-8 hidden group-hover:flex items-center gap-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePinMutation.mutate({ id: v.id, pinned: !v.is_pinned }); }}
                            className="h-5 w-5 rounded hover:bg-muted/60 flex items-center justify-center"
                            title={v.is_pinned ? "Quitar default" : "Marcar default"}
                          >
                            {v.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm(`Borrar "${v.name}"?`)) deleteMutation.mutate(v.id); }}
                            className="h-5 w-5 rounded hover:bg-destructive/20 text-destructive flex items-center justify-center"
                            title="Borrar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Widget multi-select */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Componé tu vista — marcá las secciones
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={selectAll} className="text-[10px] text-primary hover:underline">Todas</button>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <button onClick={selectDefaults} className="text-[10px] text-primary hover:underline">Default</button>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <button onClick={selectNone} className="text-[10px] text-muted-foreground hover:underline">Ninguna</button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(Object.keys(GROUP_LABELS) as WidgetDef["group"][]).map(g => {
                    const items = groupedWidgets.get(g) ?? [];
                    if (items.length === 0) return null;
                    return (
                      <div key={g}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">{GROUP_LABELS[g]}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {items.map(w => {
                            const active = selected.has(w.key);
                            return (
                              <label
                                key={w.key}
                                className={cn(
                                  "flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                                  active ? "border-primary/40 bg-primary/[0.04]" : "border-border hover:border-border/80 hover:bg-muted/30"
                                )}
                              >
                                <Checkbox
                                  checked={active}
                                  onCheckedChange={() => toggleWidget(w.key)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold leading-tight">{w.label}</p>
                                  {w.description && (
                                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-1">
                                      {w.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Save bar */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/60 flex-wrap">
                <p className="text-[11px] text-muted-foreground flex-1">
                  {selected.size === 0 ? "Marcá al menos 1 sección" : `Vas a ver ${selected.size} secciones`}
                </p>
                {loadedFromSaved && activeView && (
                  <Button
                    size="sm"
                    variant={isPinned ? "default" : "outline"}
                    onClick={setAsDefault}
                    className="h-7 gap-1 text-xs"
                    disabled={togglePinMutation.isPending}
                  >
                    {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    {isPinned ? "Default activo" : "Fijar como default"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSaveName(loadedFromSaved || ""); setSaveDialogOpen(true); }}
                  disabled={selected.size === 0}
                  className="h-7 gap-1 text-xs"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" /> Guardar vista
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Guardar vista</DialogTitle></DialogHeader>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Ej: Resumen del lunes"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Si ya existe una con este nombre, se actualiza.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
