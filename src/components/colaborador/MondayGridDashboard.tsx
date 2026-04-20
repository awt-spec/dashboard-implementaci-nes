import { useEffect, useMemo, useState } from "react";
// @ts-ignore - mixed default/named exports
import RGL from "react-grid-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { GripVertical, Settings2, RotateCcw, Save, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useColaboradorLayout, type WidgetConfig, type WidgetLayoutItem } from "@/hooks/useColaboradorLayout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const RGLAny: any = RGL;
const Responsive: any = RGLAny.Responsive;
const WidthProvider: any = RGLAny.WidthProvider;
const ResponsiveGridLayout: any = WidthProvider(Responsive);

export interface WidgetRegistryEntry {
  type: string;
  label: string;
  description: string;
  icon: string;
  defaultSize: { w: number; h: number; minW?: number; minH?: number };
  render: () => React.ReactNode;
}

interface Props {
  registry: Record<string, WidgetRegistryEntry>;
  onEditingChange?: (editing: boolean) => void;
}

export function MondayGridDashboard({ registry, onEditingChange }: Props) {
  const { data, isLoading, save, reset, defaults } = useColaboradorLayout();
  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [layout, setLayout] = useState<WidgetLayoutItem[]>([]);

  useEffect(() => {
    if (data) {
      setWidgets(data.widgets);
      setLayout(data.layout);
    }
  }, [data]);

  useEffect(() => { onEditingChange?.(editing); }, [editing, onEditingChange]);

  const enabledWidgets = useMemo(() => widgets.filter(w => w.enabled), [widgets]);
  const visibleLayout = useMemo(
    () => layout.filter(l => enabledWidgets.find(w => w.id === l.i)),
    [layout, enabledWidgets]
  );

  const handleLayoutChange = (next: any[]) => {
    if (!editing) return;
    setLayout(prev => {
      const map = new Map(prev.map(l => [l.i, l]));
      next.forEach((l: any) => map.set(l.i, { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, minW: l.minW, minH: l.minH }));
      return Array.from(map.values());
    });
  };

  const toggleWidget = (id: string, value: boolean) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled: value } : w));
    if (value && !layout.find(l => l.i === id)) {
      const w = widgets.find(x => x.id === id);
      const reg = w ? registry[w.type] : null;
      if (reg) {
        const maxY = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
        setLayout(prev => [...prev, { i: id, x: 0, y: maxY, w: reg.defaultSize.w, h: reg.defaultSize.h, minW: reg.defaultSize.minW, minH: reg.defaultSize.minH }]);
      }
    }
  };

  const addWidget = (type: string) => {
    const reg = registry[type];
    if (!reg) return;
    const id = `${type}-${Date.now().toString(36)}`;
    setWidgets(prev => [...prev, { id, type, enabled: true }]);
    const maxY = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    setLayout(prev => [...prev, { i: id, x: 0, y: maxY, w: reg.defaultSize.w, h: reg.defaultSize.h, minW: reg.defaultSize.minW, minH: reg.defaultSize.minH }]);
    toast.success(`Widget "${reg.label}" agregado`);
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    setLayout(prev => prev.filter(l => l.i !== id));
  };

  const handleSave = () => {
    save.mutate({ layout, widgets }, {
      onSuccess: () => { toast.success("Dashboard guardado"); setEditing(false); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleReset = () => {
    reset.mutate(undefined, {
      onSuccess: () => { toast.success("Dashboard restablecido"); setEditing(false); },
    });
  };

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 sticky top-14 z-10 bg-background/95 backdrop-blur py-2">
        <div className="flex items-center gap-2">
          <Badge variant={editing ? "default" : "secondary"} className="text-[10px]">
            {editing ? "MODO EDICIÓN" : "MODO VISTA"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {editing ? "Arrastrá para mover • redimensioná desde la esquina" : `${enabledWidgets.length} widgets activos`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {editing && (
            <>
              <Sheet>
                <SheetTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1">
                    <Plus className="h-3.5 w-3.5" /> Agregar widget
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Catálogo de widgets</SheetTitle>
                    <SheetDescription>Mostrá u ocultá widgets, o sumá nuevos al dashboard.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Activos</h4>
                      <div className="space-y-2">
                        {widgets.map(w => {
                          const reg = registry[w.type];
                          if (!reg) return null;
                          return (
                            <div key={w.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border/50">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base">{reg.icon}</span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate">{reg.label}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{reg.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Switch checked={w.enabled} onCheckedChange={(v) => toggleWidget(w.id, v)} />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeWidget(w.id)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Catálogo</h4>
                      <div className="space-y-2">
                        {Object.values(registry).map(reg => (
                          <div key={reg.type} className="flex items-center justify-between gap-2 p-2 rounded border border-border/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">{reg.icon}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{reg.label}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{reg.description}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" className="h-7" onClick={() => addWidget(reg.type)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button size="sm" className="h-8 gap-1" onClick={handleSave}>
                <Save className="h-3.5 w-3.5" /> Guardar
              </Button>
            </>
          )}
          <Button size="sm" variant={editing ? "secondary" : "outline"} className="h-8 gap-1" onClick={() => setEditing(e => !e)}>
            {editing ? <><Check className="h-3.5 w-3.5" /> Listo</> : <><Settings2 className="h-3.5 w-3.5" /> Personalizar</>}
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className={editing ? "rounded-lg border-2 border-dashed border-primary/30 bg-primary/[0.02]" : ""}>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: visibleLayout, md: visibleLayout, sm: visibleLayout, xs: visibleLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 1 }}
          rowHeight={40}
          margin={[12, 12]}
          containerPadding={[8, 8]}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle=".widget-drag-handle"
          onLayoutChange={handleLayoutChange}
        >
          {enabledWidgets.map(w => {
            const reg = registry[w.type];
            if (!reg) return null;
            return (
              <div key={w.id} className="overflow-hidden">
                <Card className="h-full overflow-hidden flex flex-col">
                  {editing && (
                    <div className="widget-drag-handle cursor-move flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/40 border-b border-border/40">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                        <GripVertical className="h-3 w-3" /> {reg.icon} {reg.label}
                      </div>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeWidget(w.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardContent className="p-0 flex-1 overflow-auto">
                    {reg.render()}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
