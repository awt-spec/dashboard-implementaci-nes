import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Cambio de contraseña self-service (PORTAL-014 / ERP-004 propio).
 * Usa supabase.auth.updateUser para que cualquier usuario autenticado —
 * incluido el rol cliente del Portal — cambie su propia contraseña.
 */
export function ChangePasswordDialog({ trigger }: { trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (pw.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    if (pw !== pw2) { toast.error("Las contraseñas no coinciden"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { toast.error(error.message || "No se pudo actualizar la contraseña"); return; }
    toast.success("Contraseña actualizada");
    setPw(""); setPw2(""); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPw(""); setPw2(""); } }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" title="Cambiar contraseña">
            <KeyRound className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Cambiar contraseña</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nueva contraseña</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mínimo 8 caracteres" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirmar contraseña</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-9"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !pw || !pw2} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
