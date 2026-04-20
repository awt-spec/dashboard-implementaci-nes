import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Zap, Clock, Play, Square } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface HeroBuenosDiasProps {
  name: string;
  todayTasksCount: number;
  todayMeetingsCount: number;
  streakDays: number;
  sprintPoints: number;
  todayMinutes: number;
  activeTimerLabel: string | null;
  activeTimerStartedAt: number | null;
  onStartFocus: () => void;
  onStopTimer: () => void;
  focusTaskTitle: string | null;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
};

const todayLabel = () => {
  const d = new Date();
  const days = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]}`;
};

export function HeroBuenosDias({
  name, todayTasksCount, todayMeetingsCount, streakDays, sprintPoints, todayMinutes,
  activeTimerLabel, activeTimerStartedAt, onStartFocus, onStopTimer, focusTaskTitle,
}: HeroBuenosDiasProps) {
  const firstName = name.split(" ")[0] || "Colaborador";
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activeTimerStartedAt) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [activeTimerStartedAt]);

  const formatElapsed = () => {
    if (!activeTimerStartedAt) return "--:--:--";
    const s = Math.floor((Date.now() - activeTimerStartedAt) / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };
  void tick; // re-render trigger

  return (
    <Card className="relative overflow-hidden border-l-4 border-l-primary bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left: greeting + summary */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-primary mb-1">{todayLabel()}</p>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{greeting()}, {firstName}</h1>
            <p className="text-sm text-muted-foreground mb-5">
              Tenés <strong className="text-foreground">{todayTasksCount} tareas hoy</strong>
              {todayMeetingsCount > 0 && <> y <strong className="text-foreground">{todayMeetingsCount} reunión</strong></>}.
              Enfoquémonos en lo bloqueado primero.
            </p>

            <div className="flex items-center gap-6 flex-wrap">
              <Stat icon={Flame} iconClass="text-orange-500" value={`${streakDays} días`} label="racha" />
              <Stat icon={Zap} iconClass="text-amber-500" value={`${sprintPoints} pts`} label="completados sprint" />
              <Stat icon={Clock} iconClass="text-emerald-500" value={`${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m`} label="hoy" />
            </div>
          </div>

          {/* Right: Timer card */}
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
            <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur p-4 h-full flex flex-col">
              <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground mb-2">TIMER ACTIVO</p>
              <p className="text-sm font-semibold text-foreground mb-2 line-clamp-1">
                {activeTimerLabel || "Ninguno corriendo"}
              </p>
              <p className="text-3xl font-mono font-bold tracking-tight mb-4 text-foreground/90">
                {formatElapsed()}
              </p>
              <div className="mt-auto">
                {activeTimerStartedAt ? (
                  <Button onClick={onStopTimer} variant="destructive" size="sm" className="w-full gap-2">
                    <Square className="h-3.5 w-3.5 fill-current" /> Detener timer
                  </Button>
                ) : (
                  <Button onClick={onStartFocus} disabled={!focusTaskTitle} size="sm" className="w-full gap-2 bg-primary hover:bg-primary/90">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {focusTaskTitle ? <>Iniciar con "{focusTaskTitle.slice(0, 22)}{focusTaskTitle.length > 22 ? "…" : ""}"</> : "Sin tarea de foco"}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, iconClass, value, label }: any) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`h-8 w-8 rounded-lg bg-current/10 flex items-center justify-center ${iconClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-base font-bold leading-none">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
