import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { clients } from "@/data/projectData";
import { Share2, Link2, FileDown, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { exportReportPdf } from "@/lib/exportReportPdf";

export type ReportSection =
  | "kpis"
  | "status-chart"
  | "tasks"
  | "deliverables"
  | "priority"
  | "team"
  | "alerts"
  | "progress-cards"
  | "client-info"
  | "client-phases"
  | "client-deliverables"
  | "client-tasks"
  | "client-risks";

interface SectionOption {
  id: ReportSection;
  label: string;
  group: "resumen" | "cliente";
}

const SECTIONS: SectionOption[] = [
  { id: "kpis", label: "KPIs Principales", group: "resumen" },
  { id: "status-chart", label: "Estado de Clientes (Gráfico)", group: "resumen" },
  { id: "tasks", label: "Tareas por Estado", group: "resumen" },
  { id: "deliverables", label: "Entregables", group: "resumen" },
  { id: "priority", label: "Prioridad de Tareas", group: "resumen" },
  { id: "team", label: "Equipo por Cliente", group: "resumen" },
  { id: "alerts", label: "Alertas Críticas", group: "resumen" },
  { id: "progress-cards", label: "Progreso por Cliente", group: "resumen" },
  { id: "client-info", label: "Información General", group: "cliente" },
  { id: "client-phases", label: "Fases del Proyecto", group: "cliente" },
  { id: "client-deliverables", label: "Entregables del Cliente", group: "cliente" },
  { id: "client-tasks", label: "Tareas del Cliente", group: "cliente" },
  { id: "client-risks", label: "Riesgos del Cliente", group: "cliente" },
];

interface ShareReportDialogProps {
  trigger?: React.ReactNode;
}

export function ShareReportDialog({ trigger }: ShareReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"resumen" | "cliente">("resumen");
  const [selectedClient, setSelectedClient] = useState<string>(clients[0]?.id || "");
  const [selectedSections, setSelectedSections] = useState<ReportSection[]>([
    "kpis", "status-chart", "alerts", "progress-cards",
  ]);
  const [copied, setCopied] = useState(false);

  const filteredSections = SECTIONS.filter(s => s.group === mode);

  const toggleSection = (id: ReportSection) => {
    setSelectedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const ids = filteredSections.map(s => s.id);
    setSelectedSections(prev => [...new Set([...prev, ...ids])]);
  };

  const deselectAll = () => {
    const ids = new Set(filteredSections.map(s => s.id));
    setSelectedSections(prev => prev.filter(s => !ids.has(s)));
  };

  const buildShareUrl = () => {
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (mode === "cliente") params.set("client", selectedClient);
    params.set("sections", selectedSections.join(","));
    return `${window.location.origin}/report?${params.toString()}`;
  };

  const copyLink = async () => {
    const url = buildShareUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link copiado", description: "El enlace del reporte fue copiado al portapapeles." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = () => {
    const client = mode === "cliente" ? clients.find(c => c.id === selectedClient) : undefined;
    exportReportPdf({ mode, sections: selectedSections, client });
    toast({ title: "PDF generado", description: "El reporte fue descargado exitosamente." });
  };

  const handleModeChange = (newMode: "resumen" | "cliente") => {
    setMode(newMode);
    if (newMode === "resumen") {
      setSelectedSections(["kpis", "status-chart", "alerts", "progress-cards"]);
    } else {
      setSelectedSections(["client-info", "client-phases", "client-deliverables", "client-tasks", "client-risks"]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Compartir</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartir Reporte
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Mode selector */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-2 block">Tipo de Reporte</label>
            <div className="flex gap-2">
              <Button
                variant={mode === "resumen" ? "default" : "outline"}
                size="sm"
                onClick={() => handleModeChange("resumen")}
                className="flex-1"
              >
                Resumen Ejecutivo
              </Button>
              <Button
                variant={mode === "cliente" ? "default" : "outline"}
                size="sm"
                onClick={() => handleModeChange("cliente")}
                className="flex-1"
              >
                Cliente Específico
              </Button>
            </div>
          </div>

          {/* Client selector */}
          {mode === "cliente" && (
            <div>
              <label className="text-xs font-semibold text-foreground mb-2 block">Cliente</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Section selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-foreground">Secciones a incluir</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] text-primary hover:underline">Seleccionar todo</button>
                <button onClick={deselectAll} className="text-[10px] text-muted-foreground hover:underline">Deseleccionar</button>
              </div>
            </div>
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30 max-h-48 overflow-y-auto">
              {filteredSections.map(section => {
                const checked = selectedSections.includes(section.id);
                return (
                  <label key={section.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSection(section.id)}
                    />
                    <span className="text-xs text-foreground">{section.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {selectedSections.filter(s => filteredSections.some(fs => fs.id === s)).length} de {filteredSections.length} secciones seleccionadas
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={copyLink} variant="outline" className="gap-2 justify-center">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
              {copied ? "¡Copiado!" : "Copiar Link para Cliente"}
            </Button>
            <Button onClick={handleExportPdf} className="gap-2 justify-center">
              <FileDown className="h-4 w-4" />
              Descargar PDF
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            El link genera una vista limpia sin menús, ideal para compartir con clientes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
