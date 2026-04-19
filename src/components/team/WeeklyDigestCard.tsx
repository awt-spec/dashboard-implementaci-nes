import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useLatestDigest, useGenerateDigest } from "@/hooks/useMemberAgent";

export function WeeklyDigestCard({ memberId }: { memberId: string }) {
  const { data: digest, isLoading } = useLatestDigest(memberId);
  const gen = useGenerateDigest();

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Tu resumen IA
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1.5"
          onClick={() => gen.mutate(memberId)}
          disabled={gen.isPending}
        >
          {gen.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {digest ? "Regenerar" : "Generar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Cargando...</p>
        ) : !digest ? (
          <p className="text-xs text-muted-foreground">
            Genera tu resumen semanal personalizado por IA con tus métricas, foco de la próxima semana y sugerencias accionables.
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed">{digest.summary}</p>
            {digest.suggestions?.length > 0 && (
              <div className="space-y-1.5">
                {digest.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2">
                    <span className="text-base shrink-0">{s.icon || "✨"}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Semana del {new Date(digest.week_start).toLocaleDateString("es", { day: "numeric", month: "short" })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
