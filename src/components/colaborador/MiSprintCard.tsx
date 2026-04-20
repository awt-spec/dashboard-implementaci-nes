import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp } from "lucide-react";

interface MiSprintCardProps {
  pointsDone: number;
  pointsTotal: number;
  daysLeft: number | null;
  daysTotal: number | null;
  velocityChange: number; // % vs prev sprint
}

export function MiSprintCard({ pointsDone, pointsTotal, daysLeft, daysTotal, velocityChange }: MiSprintCardProps) {
  const pct = pointsTotal > 0 ? Math.round((pointsDone / pointsTotal) * 100) : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Card className="h-full">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold">Mi sprint</h3>
        </div>

        <div className="flex flex-col items-center justify-center flex-1 my-2">
          <div className="relative h-44 w-44">
            <svg className="-rotate-90 h-44 w-44">
              <circle cx="88" cy="88" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
              <circle
                cx="88" cy="88" r={radius} fill="none"
                stroke="hsl(var(--primary))" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold leading-none">{pct}%</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1.5 font-bold">Completado</p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-xs border-t border-border/60 pt-3">
          <Row label="Puntos hechos" value={`${pointsDone} / ${pointsTotal}`} />
          {daysLeft !== null && daysTotal !== null && (
            <Row label="Días restantes" value={`${daysLeft} / ${daysTotal}`} />
          )}
          <Row
            label="Mi velocidad"
            value={
              <span className={velocityChange >= 0 ? "text-emerald-600 font-bold flex items-center gap-1" : "text-red-500 font-bold flex items-center gap-1"}>
                <TrendingUp className="h-3 w-3" />
                {velocityChange >= 0 ? "+" : ""}{velocityChange}%
              </span>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
