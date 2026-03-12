import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCreateTask } from "@/hooks/useClients";
import { toast } from "sonner";

interface CreateTaskDialogProps {
  clientId: string;
  clientName?: string;
  trigger?: React.ReactNode;
}

export function CreateTaskDialog({ clientId, clientName, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [taskNumber, setTaskNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [status, setStatus] = useState("pendiente");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const createTask = useCreateTask();

  const resetForm = () => {
    setTaskNumber("");
    setTitle("");
    setDescription("");
    setPriority("media");
    setStatus("pendiente");
    setOwner("");
    setDueDate(undefined);
  };

  const handleCreate = () => {
    if (!title.trim() || !owner.trim() || !dueDate) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    createTask.mutate(
      {
        client_id: clientId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        owner: owner.trim(),
        due_date: format(dueDate, "yyyy-MM-dd"),
        original_id: taskNumber.trim() ? parseInt(taskNumber.trim(), 10) || Date.now() : Date.now(),
        assignees: [],
      },
      {
        onSuccess: () => {
          toast.success("Tarea creada exitosamente");
          resetForm();
          setOpen(false);
        },
        onError: () => toast.error("Error al crear la tarea"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nueva Tarea
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Tarea {clientName && `— ${clientName}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">Nº Tarea</label>
              <Input value={taskNumber} onChange={e => setTaskNumber(e.target.value)} placeholder="12345" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Título *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título de la tarea" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Descripción</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción opcional" className="mt-1 min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">Responsable *</label>
              <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Nombre" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Fecha límite *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy") : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">Prioridad</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Media</SelectItem>
                  <SelectItem value="baja">🟢 Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Estado</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en-progreso">En Progreso</SelectItem>
                  <SelectItem value="bloqueada">Bloqueada</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createTask.isPending}>
              {createTask.isPending ? "Creando..." : "Crear Tarea"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
