import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, FileText } from "lucide-react";

interface QuoteSnapshotItem {
  description: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
interface QuoteSnapshot {
  quote_number: string;
  title: string;
  description: string | null;
  terms: string | null;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  valid_until: string | null;
  client_name: string;
  items: QuoteSnapshotItem[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", sent: "Enviada", approved: "Aprobada",
  rejected: "Rechazada", expired: "Expirada", cancelled: "Anulada",
};

export default function SharedQuote() {
  const { token } = useParams<{ token: string }>();
  const [snap, setSnap] = useState<QuoteSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase
        .from("shared_quotes" as any)
        .select("quote_snapshot, expires_at")
        .eq("token", token)
        .maybeSingle() as any);
      if (error || !data) { setError("Cotización no encontrada o expirada."); setLoading(false); return; }
      if (new Date(data.expires_at) < new Date()) { setError("Este link de cotización ha expirado."); setLoading(false); return; }
      setSnap(data.quote_snapshot as QuoteSnapshot);
      setLoading(false);
    })();
  }, [token]);

  const money = (n: number, cur: string) =>
    `${Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/30"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (error || !snap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
            <h1 className="text-lg font-bold mb-1">No disponible</h1>
            <p className="text-sm text-muted-foreground">{error || "Esta cotización no existe."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="overflow-hidden shadow-lg">
          {/* Encabezado */}
          <div className="bg-gradient-to-br from-[#C8200F] to-[#8e1608] text-white px-6 py-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/70">Cotización</p>
              <h1 className="text-2xl font-black mt-0.5">{snap.title}</h1>
              <p className="text-xs text-white/80 mt-1 font-mono">{snap.quote_number}</p>
            </div>
            <Badge className="bg-white/15 text-white border-white/30">{STATUS_LABEL[snap.status] || snap.status}</Badge>
          </div>

          <CardContent className="p-6 space-y-5">
            <div className="flex flex-wrap justify-between gap-3 text-xs">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Cliente</p>
                <p className="font-semibold">{snap.client_name}</p>
              </div>
              {snap.valid_until && (
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground">Válida hasta</p>
                  <p className="font-semibold">{snap.valid_until}</p>
                </div>
              )}
            </div>

            {snap.description && <p className="text-sm text-muted-foreground">{snap.description}</p>}

            {/* Ítems */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] uppercase text-muted-foreground font-semibold">Descripción</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase text-muted-foreground font-semibold">Cant.</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase text-muted-foreground font-semibold">P. unit.</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase text-muted-foreground font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.items.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-xs text-muted-foreground py-4">Sin ítems</td></tr>
                  ) : snap.items.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{it.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(it.unit_price, snap.currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(it.subtotal, snap.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="ml-auto w-full max-w-[260px] space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(snap.subtotal, snap.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">IVA ({snap.tax_rate}%)</span><span className="tabular-nums">{money(snap.tax_amount, snap.currency)}</span></div>
              <div className="flex justify-between border-t pt-1 font-black text-base"><span>Total</span><span className="tabular-nums text-primary">{money(snap.total_amount, snap.currency)}</span></div>
            </div>

            {snap.terms && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Términos y condiciones</p>
                <p className="text-xs whitespace-pre-wrap">{snap.terms}</p>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center pt-2 flex items-center justify-center gap-1">
              <FileText className="h-3 w-3" /> Cotización generada por SYSDE
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
