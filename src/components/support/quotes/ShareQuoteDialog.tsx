import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Share2, Copy, Loader2, Check, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type Quote } from "@/hooks/useQuotes";

/**
 * Genera un link público (sin login) para compartir una cotización con el
 * cliente externo. Inserta en shared_quotes un snapshot de la cotización +
 * ítems; el público la ve en /cotizacion/:token mientras no expire (30 días).
 */
export function ShareQuoteDialog({ quote, trigger }: { quote: Quote; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data: items } = await (supabase
        .from("quote_items").select("*").eq("quote_id", quote.id).order("position") as any);
      const { data: client } = await (supabase
        .from("clients").select("name").eq("id", quote.client_id).maybeSingle() as any);
      const snapshot = {
        quote_number: quote.quote_number,
        title: quote.title,
        description: quote.description ?? null,
        terms: (quote as any).terms ?? null,
        currency: quote.currency,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate,
        tax_amount: quote.tax_amount,
        total_amount: quote.total_amount,
        status: quote.status,
        valid_until: quote.valid_until ?? null,
        client_name: client?.name ?? quote.client_id,
        items: (items ?? []).map((it: any) => ({
          description: it.description,
          item_type: it.item_type,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          subtotal: Number(it.subtotal ?? it.quantity * it.unit_price),
        })),
      };
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase
        .from("shared_quotes")
        .insert({
          quote_id: quote.id,
          client_id: quote.client_id,
          title: quote.title,
          quote_snapshot: snapshot,
          created_by: userData?.user?.id ?? null,
        })
        .select("token")
        .single() as any);
      if (error) throw error;
      setUrl(`${window.location.origin}/cotizacion/${data.token}`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo generar el link");
    } finally {
      setLoading(false);
    }
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && !url) generate();
    if (!o) { setUrl(null); setCopied(false); }
  };

  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Link copiado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" /> Compartir
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Compartir cotización {quote.quote_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Link público para que el cliente vea la cotización sin necesidad de iniciar sesión.
            Válido por 30 días.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Generando link…
            </div>
          ) : url ? (
            <>
              <div className="flex gap-2">
                <Input readOnly value={url} className="text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
                <Button size="icon" variant="outline" onClick={copy} title="Copiar">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-info hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Abrir
                </a>
                <Button size="sm" onClick={copy} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar link
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={generate} className="w-full gap-1.5"><Share2 className="h-4 w-4" /> Generar link</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
