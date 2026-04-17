import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GripVertical, ListChecks, Ticket } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface QuickItem {
  source: "task" | "ticket";
  id: string;
  title: string;
  client_id: string | null;
  client_name?: string;
}

export function useMyQuickItems() {
  const { user } = useAuth();
  const [items, setItems] = useState<QuickItem[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [{ data: tasks }, { data: tickets }, { data: clients }] = await Promise.all([
        supabase.from("tasks").select("id, title, client_id, status").eq("assigned_user_id", user.id).neq("status", "completada").limit(15),
        supabase.from("support_tickets").select("id, asunto, client_id, estado").eq("assigned_user_id", user.id).neq("estado", "cerrado").limit(15),
        supabase.from("clients").select("id, name"),
      ]);
      const cmap = new Map((clients || []).map(c => [c.id, c.name]));
      const list: QuickItem[] = [
        ...((tasks || []).map(t => ({ source: "task" as const, id: t.id, title: t.title, client_id: t.client_id, client_name: cmap.get(t.client_id) }))),
        ...((tickets || []).map(t => ({ source: "ticket" as const, id: t.id, title: t.asunto, client_id: t.client_id, client_name: cmap.get(t.client_id) }))),
      ];
      setItems(list);
    })();
  }, [user?.id]);
  return items;
}

export function QuickLogItems() {
  const items = useMyQuickItems();

  const handleDragStart = (e: React.DragEvent, item: QuickItem) => {
    e.dataTransfer.setData("application/x-quick-item", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-primary" />
          Mis pendientes
          <Badge variant="outline" className="ml-auto text-[10px]">{items.length}</Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">Arrastra a un día del calendario para registrar horas</p>
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="h-[280px] pr-2">
          <div className="space-y-1.5">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sin tareas asignadas</p>
            ) : items.map(item => (
              <div
                key={`${item.source}-${item.id}`}
                draggable
                onDragStart={e => handleDragStart(e, item)}
                className="group flex items-start gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent/50 hover:border-primary/50 cursor-grab active:cursor-grabbing transition-all"
              >
                <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
                {item.source === "task" ? (
                  <ListChecks className="h-3 w-3 text-info shrink-0 mt-0.5" />
                ) : (
                  <Ticket className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight line-clamp-2">{item.title}</p>
                  {item.client_name && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.client_name}</p>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
