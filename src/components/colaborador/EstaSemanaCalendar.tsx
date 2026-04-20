import { Card, CardContent } from "@/components/ui/card";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";
import { cn } from "@/lib/utils";

interface CalEvent {
  id: string;
  title: string;
  day: number; // 0=Mon..4=Fri
  startHour: number; // 8..18
  durationHours: number;
  color: "rose" | "emerald" | "slate" | "blue" | "amber" | "violet";
}

interface EstaSemanaCalendarProps {
  items: ScrumWorkItem[];
}

const COLOR_CLASS: Record<CalEvent["color"], string> = {
  rose: "bg-rose-400/85 text-rose-50",
  emerald: "bg-emerald-500/80 text-emerald-50",
  slate: "bg-slate-500/80 text-slate-50",
  blue: "bg-sky-500/80 text-sky-50",
  amber: "bg-amber-500/80 text-amber-50",
  violet: "bg-violet-500/80 text-violet-50",
};

const COLORS: CalEvent["color"][] = ["rose", "emerald", "slate", "blue", "amber", "violet"];

function buildEvents(items: ScrumWorkItem[]): CalEvent[] {
  // Map up to 6 sprint items to a deterministic layout across the week, distributing into
  // morning/afternoon slots so the "Esta semana" view stays informative without faking data.
  const slots: Array<{ day: number; startHour: number; durationHours: number }> = [
    { day: 0, startHour: 9, durationHours: 1.5 },
    { day: 1, startHour: 10, durationHours: 1.5 },
    { day: 2, startHour: 9, durationHours: 1 },
    { day: 3, startHour: 11, durationHours: 1.5 },
    { day: 4, startHour: 10, durationHours: 1.5 },
    { day: 0, startHour: 14, durationHours: 1 },
    { day: 2, startHour: 14, durationHours: 2 },
  ];
  return items.slice(0, slots.length).map((item, i) => ({
    id: `${item.source}-${item.id}`,
    title: item.title.length > 22 ? item.title.slice(0, 20) + "…" : item.title,
    day: slots[i].day,
    startHour: slots[i].startHour,
    durationHours: slots[i].durationHours,
    color: COLORS[i % COLORS.length],
  }));
}

const HOURS = [8, 10, 12, 14, 16, 18];
const HOUR_HEIGHT = 36;

export function EstaSemanaCalendar({ items }: EstaSemanaCalendarProps) {
  const events = buildEvents(items.filter(i => i.scrum_status !== "done"));
  const today = new Date();
  const monday = new Date(today);
  const dow = (today.getDay() + 6) % 7;
  monday.setDate(today.getDate() - dow);

  const days = ["LUN", "MAR", "MIÉ", "JUE", "VIE"].map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, num: d.getDate(), isToday: d.toDateString() === today.toDateString() };
  });

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-bold mb-4">Esta semana</h3>
        <div className="grid grid-cols-[40px_repeat(5,1fr)] gap-x-2">
          {/* Header row */}
          <div />
          {days.map(d => (
            <div key={d.label} className="text-center pb-2">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground">{d.label}</p>
              <p className={cn(
                "text-base font-bold mt-0.5",
                d.isToday && "text-primary"
              )}>{d.num}</p>
            </div>
          ))}

          {/* Hours column + day columns */}
          <div className="relative" style={{ height: HOUR_HEIGHT * (HOURS.length - 1) }}>
            {HOURS.map((h, i) => (
              <div key={h} className="absolute left-0 right-0 text-[9px] text-muted-foreground -translate-y-1/2"
                style={{ top: HOUR_HEIGHT * i }}>
                {h}h
              </div>
            ))}
          </div>

          {days.map((_d, dayIdx) => {
            const dayEvents = events.filter(e => e.day === dayIdx);
            return (
              <div key={dayIdx} className="relative border-l border-border/40" style={{ height: HOUR_HEIGHT * (HOURS.length - 1) }}>
                {/* Hour grid lines */}
                {HOURS.map((_h, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-dashed border-border/30"
                    style={{ top: HOUR_HEIGHT * i }} />
                ))}
                {/* Events */}
                {dayEvents.map(ev => {
                  const top = (ev.startHour - HOURS[0]) / 2 * HOUR_HEIGHT;
                  const height = ev.durationHours / 2 * HOUR_HEIGHT;
                  return (
                    <div
                      key={ev.id}
                      className={cn("absolute left-1 right-1 rounded px-1.5 py-1 text-[10px] font-semibold leading-tight overflow-hidden cursor-default", COLOR_CLASS[ev.color])}
                      style={{ top, height }}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
