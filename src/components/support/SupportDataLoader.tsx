import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, FileSpreadsheet, FileText, ClipboardPaste, Loader2, CheckCircle2,
  AlertTriangle, Clock, Trash2, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSupportClients, type SupportClient } from "@/hooks/useSupportTickets";
import { useQueryClient } from "@tanstack/react-query";

interface ParsedTicket {
  ticket_id: string;
  asunto: string;
  tipo: string;
  prioridad: string;
  estado: string;
  producto: string;
  dias_antiguedad: number;
  responsable?: string;
  fecha_registro?: string;
  fecha_entrega?: string;
  notas?: string;
}

// Try to parse pasted/CSV data
function parseTextData(text: string): ParsedTicket[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect separator
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ""));

  const fieldMap: Record<string, string> = {
    "boleta": "ticket_id", "ticket": "ticket_id", "id": "ticket_id", "ticket_id": "ticket_id", "no. boleta": "ticket_id",
    "asunto": "asunto", "descripcion": "asunto", "descripción": "asunto", "subject": "asunto", "resumen": "asunto",
    "tipo": "tipo", "type": "tipo", "clasificacion": "tipo",
    "prioridad": "prioridad", "priority": "prioridad",
    "estado": "estado", "status": "estado",
    "producto": "producto", "product": "producto", "modulo": "producto", "módulo": "producto",
    "dias": "dias_antiguedad", "días": "dias_antiguedad", "dias_antiguedad": "dias_antiguedad", "antigüedad": "dias_antiguedad", "aging": "dias_antiguedad",
    "responsable": "responsable", "asignado": "responsable", "assigned": "responsable",
    "fecha_registro": "fecha_registro", "fecha registro": "fecha_registro", "created": "fecha_registro", "registro": "fecha_registro",
    "fecha_entrega": "fecha_entrega", "fecha entrega": "fecha_entrega", "entrega": "fecha_entrega",
    "notas": "notas", "notes": "notas", "comentarios": "notas",
  };

  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const mapped = fieldMap[h];
    if (mapped) colMap[mapped] = i;
  });

  if (!colMap.ticket_id) return [];

  const results: ParsedTicket[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
    const get = (f: string) => colMap[f] !== undefined ? cols[colMap[f]] || "" : "";

    const ticketId = get("ticket_id");
    if (!ticketId) continue;

    const dias = parseInt(get("dias_antiguedad")) || 0;

    results.push({
      ticket_id: ticketId,
      asunto: get("asunto") || "Sin asunto",
      tipo: get("tipo") || "Requerimiento",
      prioridad: get("prioridad") || "Media",
      estado: get("estado") || "EN ATENCIÓN",
      producto: get("producto") || "",
      dias_antiguedad: dias,
      responsable: get("responsable") || undefined,
      fecha_registro: get("fecha_registro") || undefined,
      fecha_entrega: get("fecha_entrega") || undefined,
      notas: get("notas") || undefined,
    });
  }
  return results;
}

interface Props {
  clientId?: string;
}

export function SupportDataLoader({ clientId }: Props) {
  const { data: clients = [] } = useSupportClients();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [selectedClient, setSelectedClient] = useState(clientId || "");
  const [rawText, setRawText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedTicket[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  // Last update info per client
  const [lastUpdates, setLastUpdates] = useState<Record<string, { date: string; count: number; source: string }>>({});

  // Load last updates
  useMemo(() => {
    supabase.from("support_data_updates").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (!data) return;
      const map: Record<string, { date: string; count: number; source: string }> = {};
      data.forEach((d: any) => {
        if (!map[d.client_id]) {
          map[d.client_id] = { date: d.created_at, count: d.records_count, source: d.source_type };
        }
      });
      setLastUpdates(map);
    });
  }, []);

  const handleParse = useCallback(() => {
    const parsed = parseTextData(rawText);
    setParsedData(parsed);
    setImportResult(null);
    if (parsed.length === 0 && rawText.trim()) {
      toast.error("No se pudieron parsear datos. Verifica que incluyas encabezados (boleta, asunto, tipo, prioridad, estado, producto, dias).");
    } else if (parsed.length > 0) {
      toast.success(`${parsed.length} registros encontrados`);
    }
  }, [rawText]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setRawText(text);
      const parsed = parseTextData(text);
      setParsedData(parsed);
      setImportResult(null);
      if (parsed.length > 0) toast.success(`${parsed.length} registros de ${file.name}`);
      else toast.error("No se pudieron parsear datos del archivo");
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedClient || parsedData.length === 0) {
      toast.error("Selecciona un cliente y asegúrate de tener datos parseados");
      return;
    }

    setImporting(true);
    let success = 0, errors = 0;

    // Batch insert
    const batch = parsedData.map(t => ({
      client_id: selectedClient,
      ticket_id: t.ticket_id,
      asunto: t.asunto,
      tipo: t.tipo,
      prioridad: t.prioridad,
      estado: t.estado,
      producto: t.producto,
      dias_antiguedad: t.dias_antiguedad,
      responsable: t.responsable || null,
      fecha_registro: t.fecha_registro || null,
      fecha_entrega: t.fecha_entrega || null,
      notas: t.notas || null,
    }));

    const { error } = await supabase.from("support_tickets").upsert(
      batch as any,
      { onConflict: "client_id,ticket_id", ignoreDuplicates: false }
    );

    if (error) {
      // Fallback: insert one by one
      for (const ticket of batch) {
        const { error: err } = await supabase.from("support_tickets").upsert([ticket] as any, { onConflict: "client_id,ticket_id" });
        if (err) errors++;
        else success++;
      }
    } else {
      success = batch.length;
    }

    // Record update
    await supabase.from("support_data_updates").insert([{
      client_id: selectedClient,
      records_count: success,
      source_type: mode === "file" ? "archivo" : "pegado",
      source_name: `${success} registros importados`,
    }] as any);

    setImporting(false);
    setImportResult({ success, errors });
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
    qc.invalidateQueries({ queryKey: ["support-tickets-all"] });

    if (success > 0) toast.success(`${success} tickets importados exitosamente`);
    if (errors > 0) toast.error(`${errors} tickets con errores`);
  }, [selectedClient, parsedData, mode, qc]);

  const selectedClientName = clients.find(c => c.id === selectedClient)?.name || "";

  return (
    <div className="space-y-4">
      {/* Last Updates Summary */}
      {Object.keys(lastUpdates).length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Últimas Actualizaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {clients.filter(c => lastUpdates[c.id]).map(c => {
                const u = lastUpdates[c.id];
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-muted/20 border border-border/30 px-3 py-2">
                    <div>
                      <div className="text-xs font-semibold truncate max-w-[150px]">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(u.date).toLocaleDateString("es")} · {u.source}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono">{u.count}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/20 bg-gradient-to-r from-card via-muted/10 to-card">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            Cargar Datos de Soporte
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Importa datos desde CSV, Excel exportado, o pegando texto directamente. Los encabezados se mapean automáticamente.
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Client + Mode Selection */}
          <div className="flex flex-wrap gap-3">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[250px] h-9 text-xs rounded-lg">
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-0.5 bg-muted/40 rounded-lg p-0.5 border border-border/30">
              <button onClick={() => setMode("paste")}
                className={`text-[11px] px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${mode === "paste" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                <ClipboardPaste className="h-3.5 w-3.5" /> Pegar Texto
              </button>
              <button onClick={() => setMode("file")}
                className={`text-[11px] px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${mode === "file" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Subir Archivo
              </button>
            </div>
          </div>

          {/* Input Area */}
          {mode === "paste" ? (
            <div className="space-y-2">
              <Textarea
                placeholder={`Pega aquí los datos con encabezados separados por tab, coma, o punto y coma.

Ejemplo:
Boleta\tAsunto\tTipo\tPrioridad\tEstado\tProducto\tDias
BOL-001\tError en módulo\tIncidente\tAlta\tEN ATENCIÓN\tSAP\t45`}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                className="min-h-[160px] font-mono text-xs resize-y"
              />
              <Button size="sm" className="gap-1.5 text-xs" onClick={handleParse} disabled={!rawText.trim()}>
                <FileText className="h-3.5 w-3.5" /> Parsear Datos
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-3">Arrastra un archivo CSV o haz clic para seleccionar</p>
              <label className="cursor-pointer">
                <input type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" onChange={handleFileUpload} className="hidden" />
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                  <span><FileSpreadsheet className="h-3.5 w-3.5" /> Seleccionar Archivo</span>
                </Button>
              </label>
              <p className="text-[10px] text-muted-foreground mt-2">Soporta: CSV, TSV, TXT (delimitados)</p>
            </div>
          )}

          {/* Encabezados esperados */}
          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Encabezados reconocidos</div>
            <div className="flex flex-wrap gap-1.5">
              {["Boleta/Ticket", "Asunto", "Tipo", "Prioridad", "Estado", "Producto", "Días", "Responsable", "Fecha Registro", "Notas"].map(h => (
                <Badge key={h} variant="outline" className="text-[9px] font-mono">{h}</Badge>
              ))}
            </div>
          </div>

          {/* Preview Table */}
          <AnimatePresence>
            {parsedData.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b border-border/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-xs font-semibold">{parsedData.length} registros listos</span>
                      {selectedClientName && <Badge variant="secondary" className="text-[10px]">{selectedClientName}</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground" onClick={() => { setParsedData([]); setRawText(""); }}>
                        <Trash2 className="h-3 w-3 mr-1" /> Limpiar
                      </Button>
                      <Button size="sm" className="h-7 text-[10px] gap-1" onClick={handleImport} disabled={importing || !selectedClient}>
                        {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {importing ? "Importando..." : "Importar"}
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border/30">
                          <th className="text-left p-2 font-medium text-muted-foreground">Ticket</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Asunto</th>
                          <th className="text-center p-2 font-medium text-muted-foreground">Tipo</th>
                          <th className="text-center p-2 font-medium text-muted-foreground">Prioridad</th>
                          <th className="text-center p-2 font-medium text-muted-foreground">Estado</th>
                          <th className="text-center p-2 font-medium text-muted-foreground">Producto</th>
                          <th className="text-center p-2 font-medium text-muted-foreground">Días</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 50).map((t, i) => (
                          <tr key={i} className="border-b border-border/10 hover:bg-muted/15">
                            <td className="p-2 font-mono font-bold">{t.ticket_id}</td>
                            <td className="p-2 max-w-[200px] truncate">{t.asunto}</td>
                            <td className="p-2 text-center">{t.tipo}</td>
                            <td className="p-2 text-center">{t.prioridad}</td>
                            <td className="p-2 text-center">{t.estado}</td>
                            <td className="p-2 text-center">{t.producto}</td>
                            <td className="p-2 text-center font-mono">{t.dias_antiguedad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedData.length > 50 && (
                      <div className="text-center text-[10px] text-muted-foreground py-2">Mostrando 50 de {parsedData.length} registros</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Import Result */}
          <AnimatePresence>
            {importResult && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl border p-4 flex items-center gap-3"
                style={{ borderColor: importResult.errors > 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}>
                {importResult.errors > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-semibold">
                    {importResult.success} tickets importados exitosamente
                    {importResult.errors > 0 && ` · ${importResult.errors} errores`}
                  </div>
                  <div className="text-xs text-muted-foreground">Los datos se reflejarán en el dashboard inmediatamente</div>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => setImportResult(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
