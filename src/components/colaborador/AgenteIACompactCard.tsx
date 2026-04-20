import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, AlertTriangle, TrendingUp, Calendar, Send, Bot } from "lucide-react";
import { useState } from "react";

interface Insight {
  id: string;
  type: "warning" | "trend" | "meeting" | "info";
  text: string;
}

interface AgenteIACompactCardProps {
  insights: Insight[];
  onAsk: (q: string) => void;
  onOpenFull: () => void;
}

const ICONS = {
  warning: AlertTriangle,
  trend: TrendingUp,
  meeting: Calendar,
  info: Sparkles,
};

const COLORS: Record<string, string> = {
  warning: "text-amber-500",
  trend: "text-emerald-500",
  meeting: "text-blue-500",
  info: "text-primary",
};

export function AgenteIACompactCard({ insights, onAsk, onOpenFull }: AgenteIACompactCardProps) {
  const [q, setQ] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    onAsk(q);
    setQ("");
  };

  return (
    <Card className="h-full bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Mi Agente IA</h3>
          </div>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
            {insights.length} insights
          </Badge>
        </div>

        <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto">
          {insights.length === 0 && (
            <button
              onClick={onOpenFull}
              className="w-full text-xs text-muted-foreground italic text-center py-8 hover:text-primary transition-colors"
            >
              <Bot className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Preguntale algo a tu agente
            </button>
          )}
          {insights.map(ins => {
            const Icon = ICONS[ins.type];
            return (
              <button
                key={ins.id}
                onClick={onOpenFull}
                className="w-full text-left rounded-md border border-border/60 bg-card/50 px-2.5 py-2 text-xs hover:border-primary/30 hover:bg-primary/5 transition-colors flex items-start gap-2"
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${COLORS[ins.type]}`} />
                <span className="line-clamp-2 leading-relaxed">{ins.text}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-1.5">
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Pregunta algo al agente..."
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" className="h-8 w-8 p-0 shrink-0" disabled={!q.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
