import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useClientCategories } from "@/hooks/useClientCategories";

interface Props {
  clientId: string;
  currentCategoryId?: string | null;
}

/**
 * Badge + selector de categoría del cliente. Solo admin/pm pueden cambiarla.
 * Persiste en clients.category_id. Gap Tanda A.2 (ERP-055 a 057, lado uso).
 */
export function ClientCategoryBadge({ clientId, currentCategoryId }: Props) {
  const { role } = useAuth();
  const qc = useQueryClient();
  const { data: categories = [] } = useClientCategories();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const canEdit = role === "admin" || role === "pm";
  const current = categories.find(c => c.id === currentCategoryId);

  const setCategory = async (categoryId: string | null) => {
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ category_id: categoryId } as any)
      .eq("id", clientId);
    setSaving(false);
    if (error) {
      toast.error("No se pudo actualizar la categoría");
      return;
    }
    qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success(categoryId ? "Categoría actualizada" : "Categoría removida");
    setOpen(false);
  };

  const badge = current ? (
    <Badge
      variant="outline"
      className="gap-1 border"
      style={{ backgroundColor: `${current.color}1a`, color: current.color, borderColor: `${current.color}40` }}
    >
      <Tag className="h-3 w-3" /> {current.name}
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground border-dashed">
      <Tag className="h-3 w-3" /> Sin categoría
    </Badge>
  );

  if (!canEdit) return badge;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="cursor-pointer hover:opacity-80 transition-opacity" disabled={saving}>
          {saving ? (
            <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Guardando</Badge>
          ) : badge}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="space-y-0.5">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-xs text-left"
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="flex-1">{c.name}</span>
              {c.id === currentCategoryId && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
          {currentCategoryId && (
            <>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => setCategory(null)}
                className="w-full px-2 py-1.5 rounded-md hover:bg-accent text-xs text-left text-muted-foreground"
              >
                Quitar categoría
              </button>
            </>
          )}
          {categories.length === 0 && (
            <p className="text-[11px] text-muted-foreground px-2 py-3 text-center">
              No hay categorías. Creá una en Configuración → Categorías de clientes.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
