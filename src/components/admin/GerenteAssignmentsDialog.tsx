import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

interface Props {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerenteAssignmentsDialog({ userId, userName, open, onOpenChange }: Props) {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("gerente_client_assignments").select("client_id").eq("user_id", userId),
    ]).then(([clientsRes, assignRes]) => {
      setClients(clientsRes.data || []);
      setAssigned(new Set((assignRes.data || []).map(a => a.client_id)));
      setLoading(false);
    });
  }, [open, userId]);

  const toggle = async (clientId: string) => {
    const isAssigned = assigned.has(clientId);
    if (isAssigned) {
      await supabase.from("gerente_client_assignments").delete().eq("user_id", userId).eq("client_id", clientId);
      setAssigned(prev => { const n = new Set(prev); n.delete(clientId); return n; });
      toast.success("Cliente desasignado");
    } else {
      await supabase.from("gerente_client_assignments").insert({ user_id: userId, client_id: clientId });
      setAssigned(prev => new Set(prev).add(clientId));
      toast.success("Cliente asignado");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Clientes de {userName}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay clientes registrados.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {clients.map(c => (
              <label key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-accent/50 cursor-pointer transition-colors">
                <Checkbox checked={assigned.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                <span className="text-sm font-medium flex-1">{c.name}</span>
                {assigned.has(c.id) && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Asignado</Badge>}
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {assigned.size} cliente{assigned.size !== 1 ? "s" : ""} asignado{assigned.size !== 1 ? "s" : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
