import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, ExternalLink, Headset, Presentation, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SharedItem {
  id: string;
  token: string;
  title: string;
  created_at: string;
  expires_at: string;
  source: "implementacion" | "soporte";
  selected_slides: number[];
}

interface Props {
  clientId: string;
  /** Optional max items to show (default unlimited). */
  limit?: number;
  /** Compact mode reduces paddings (used inside other tabs). */
  compact?: boolean;
}

export function SharedMinutasPanel({ clientId, limit, compact }: Props) {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const now = new Date().toISOString();
      const [impl, supp] = await Promise.all([
        supabase
          .from("shared_presentations")
          .select("id, token, title, created_at, expires_at, selected_slides")
          .eq("client_id", clientId)
          .gt("expires_at", now)
          .order("created_at", { ascending: false }),
        supabase
          .from("shared_support_presentations")
          .select("id, token, title, created_at, expires_at, selected_slides")
          .eq("client_id", clientId)
          .gt("expires_at", now)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const merged: SharedItem[] = [
        ...((impl.data || []) as any[]).map(r => ({ ...r, source: "implementacion" as const })),
        ...((supp.data || []) as any[]).map(r => ({ ...r, source: "soporte" as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(limit ? merged.slice(0, limit) : merged);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [clientId, limit]);

  if (loading) {
    return (
      <Card>
        <CardContent className={cn("flex items-center justify-center", compact ? "p-4" : "p-6")}>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className={cn("text-center", compact ? "p-4" : "p-6")}>
          <Presentation className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            Aún no has recibido presentaciones del equipo Sysde.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const expiresIn = Math.max(
          0,
          Math.ceil((new Date(item.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );
        const path = item.source === "soporte" ? `/shared-support/${item.token}` : `/shared/${item.token}`;
        const Icon = item.source === "soporte" ? Headset : Presentation;
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.04, 0.2) }}
          >
            <Card className="hover:border-primary/40 transition-colors group">
              <CardContent className={cn(compact ? "p-3" : "p-4")}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                    item.source === "soporte" ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-bold leading-tight line-clamp-2">{item.title}</p>
                      <Badge variant="outline" className="text-[9px] gap-1 shrink-0 capitalize">
                        {item.source === "soporte" ? "Soporte" : "Implementación"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(item.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-2.5 w-2.5" />
                        {item.selected_slides?.length || 0} diapositivas
                      </span>
                      {expiresIn > 0 && (
                        <span className={cn(expiresIn <= 2 && "text-warning font-semibold")}>
                          {expiresIn}d para expirar
                        </span>
                      )}
                    </div>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1.5 group-hover:border-primary/50"
                    >
                      <a href={path} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                        Abrir presentación
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
