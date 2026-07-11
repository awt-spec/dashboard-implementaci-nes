import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Search, Hash } from "lucide-react";
import { useState, useMemo } from "react";
import { useContractChunks, type ContractDocument } from "@/hooks/useContractKb";

// Explorador de la base de conocimiento: muestra los fragmentos indexados de un
// documento (el texto real que la IA usa para extraer y responder).
export function ContractKbDocViewer({ doc, onOpenChange }: { doc: ContractDocument | null; onOpenChange: (o: boolean) => void }) {
  const { data: chunks = [], isLoading } = useContractChunks(doc?.id);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return chunks;
    return chunks.filter((c) => c.content.toLowerCase().includes(t));
  }, [chunks, search]);

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> {doc?.filename}</DialogTitle>
        </DialogHeader>
        {doc && (
          <>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{chunks.length} fragmentos indexados</span>
              {doc.page_count != null && <span>· {doc.page_count} páginas</span>}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en el contenido indexado…" className="h-8 pl-8 text-xs" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">{search ? "Ningún fragmento coincide." : "Sin fragmentos indexados."}</p>
              ) : (
                filtered.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[9px] gap-0.5"><Hash className="h-2.5 w-2.5" />{c.chunk_index}</Badge>
                      {c.token_count != null && <span className="text-[10px] text-muted-foreground">{c.token_count} tokens</span>}
                    </div>
                    <p className="text-[12px] whitespace-pre-wrap leading-relaxed text-foreground/85">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
