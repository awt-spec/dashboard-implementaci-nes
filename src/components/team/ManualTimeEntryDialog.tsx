import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateManualEntry } from "@/hooks/useTimeTracking";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultClientId?: string;
  defaultItem?: { source: "task" | "ticket"; id: string; title?: string };
}

export function ManualTimeEntryDialog({ open, onOpenChange, defaultClientId, defaultItem }: Props) {
  const create = useCreateManualEntry();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [source, setSource] = useState<"task" | "ticket">(defaultItem?.source ?? "ticket");
  const [itemId, setItemId] = useState<string>(defaultItem?.id ?? "");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState<string>("1");
  const [description, setDescription] = useState<string>("");
  const [billable, setBillable] = useState<boolean>(true);

  useEffect(() => {
    if (!open) return;
    supabase.from("clients").select("id, name").order("name").then(({ data }) => setClients(data || []));
  }, [open]);

  useEffect(() => {
    if (defaultClientId) setClientId(defaultClientId);
    if (defaultItem) { setSource(defaultItem.source); setItemId(defaultItem.id); }
  }, [defaultClientId, defaultItem, open]);

  const submit = async () => {
    const h = parseFloat(hours);
    if (!h || h <= 0 || h > 24) return toast.error("Horas inválidas (0-24)");
    if (!itemId) return toast.error("Indica el ID del task o ticket");
    try {
      await create.mutateAsync({
        source, item_id: itemId, client_id: clientId || null,
        work_date: date, hours: h, description, is_billable: billable,
      });
      toast.success("Horas registradas");
      onOpenChange(false);
      setHours("1"); setDescription("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Registrar horas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Horas</Label>
              <Input type="number" step="0.25" min="0.25" max="24" value={hours} onChange={e => setHours(e.target.value)} className="h-8" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={source} onValueChange={(v: any) => setSource(v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Tarea</SelectItem>
                  <SelectItem value="ticket">Ticket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">ID</Label>
              <Input value={itemId} onChange={e => setItemId(e.target.value)} placeholder="UUID o número" className="h-8" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Qué hiciste..." className="text-sm" />
          </div>
          <div className="flex items-center justify-between rounded border border-border bg-muted/30 p-2">
            <Label className="text-xs">Facturable</Label>
            <Switch checked={billable} onCheckedChange={setBillable} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Guardando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
