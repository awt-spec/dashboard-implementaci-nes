import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { type AccountStatement } from "@/hooks/useAccountStatement";
import { useSysdeStatementData, toSysdeExportData } from "@/hooks/useSysdeStatementData";
import { exportAccountStatementPdf } from "@/lib/exportAccountStatementPdf";
import { AccountStatementDocument } from "./AccountStatementDocument";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stmt: AccountStatement;
  clientId: string;
}

/**
 * Modal con el estado de cuenta en formato SYSDE (documento) + acciones.
 */
export function AccountStatementDetail({ open, onOpenChange, stmt, clientId }: Props) {
  const { pkgRows, rows, totals, analytics } = useSysdeStatementData(stmt, clientId);

  const handleExport = async () => {
    try {
      await exportAccountStatementPdf(stmt, toSysdeExportData({ pkgRows, rows, totals, analytics }));
      toast.success("PDF descargado");
    } catch (e: any) { toast.error(e?.message || "Error al generar PDF"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 gap-0 bg-white text-black">
        <AccountStatementDocument stmt={stmt} clientId={clientId} />

        {/* Barra de acciones (no imprime) */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t bg-neutral-50 sticky bottom-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button size="sm" onClick={handleExport} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Exportar PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
