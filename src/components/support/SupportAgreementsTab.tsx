import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, ArrowRight, Calendar, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Minuta {
  id: string;
  title: string;
  date: string;
  agreements: string[];
  action_items: string[];
  cases_referenced: string[];
}

interface AgreementRow {
  text: string;
  type: "acuerdo" | "acción";
  minutaId: string;
  minutaTitle: string;
  minutaDate: string;
}

interface Props {
  clientId: string;
}

export function SupportAgreementsTab({ clientId }: Props) {
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [minutaFilter, setMinutaFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    supabase.from("support_minutes").select("id,title,date,agreements,action_items,cases_referenced")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (data) setMinutas(data as any);
        setLoading(false);
      });
  }, [clientId]);

  const allRows = useMemo(() => {
    const rows: AgreementRow[] = [];
    minutas.forEach(m => {
      (m.agreements || []).forEach(text => {
        rows.push({ text, type: "acuerdo", minutaId: m.id, minutaTitle: m.title, minutaDate: m.date });
      });
      (m.action_items || []).forEach(text => {
        rows.push({ text, type: "acción", minutaId: m.id, minutaTitle: m.title, minutaDate: m.date });
      });
    });
    return rows;
  }, [minutas]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (typeFilter !== "all") rows = rows.filter(r => r.type === typeFilter);
    if (minutaFilter !== "all") rows = rows.filter(r => r.minutaId === minutaFilter);
    return rows;
  }, [allRows, typeFilter, minutaFilter]);

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            Acuerdos y Acciones
            <Badge variant="outline" className="text-xs">{allRows.length} total</Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="acuerdo">Acuerdos</SelectItem>
              <SelectItem value="acción">Acciones</SelectItem>
            </SelectContent>
          </Select>
          <Select value={minutaFilter} onValueChange={setMinutaFilter}>
            <SelectTrigger className="w-[220px] h-7 text-xs"><SelectValue placeholder="Todas las minutas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las minutas</SelectItem>
              {minutas.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.title} ({new Date(m.date).toLocaleDateString("es")})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-xs">{filtered.length} resultados</Badge>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No hay acuerdos ni acciones registrados.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {filtered.map((row, i) => (
              <div key={`${row.minutaId}-${row.type}-${i}`} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
                <div className={`mt-0.5 shrink-0 ${row.type === "acuerdo" ? "text-emerald-400" : "text-blue-400"}`}>
                  {row.type === "acuerdo" ? <CheckSquare className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">{row.text}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className={`text-[9px] ${row.type === "acuerdo" ? "border-emerald-500/30 text-emerald-400" : "border-blue-500/30 text-blue-400"}`}>
                      {row.type === "acuerdo" ? "Acuerdo" : "Acción"}
                    </Badge>
                    <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(row.minutaDate).toLocaleDateString("es")}</span>
                    <span className="truncate">{row.minutaTitle}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
