import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, Plane, Check, X, AlertTriangle, Calendar as CalendarIcon } from "lucide-react";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useTimeOff, useRequestTimeOff, useUpdateTimeOff } from "@/hooks/useTeamEngagement";
import { format, eachDayOfInterval, isWithinInterval, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";

const TYPES = [
  { value: "vacation", label: "🏖️ Vacaciones", color: "bg-cyan-500" },
  { value: "sick", label: "🤒 Enfermedad", color: "bg-rose-500" },
  { value: "personal", label: "🏠 Personal", color: "bg-violet-500" },
  { value: "training", label: "📚 Capacitación", color: "bg-amber-500" },
];

export function TimeOffCalendar() {
  const { data: members = [] } = useSysdeTeamMembers();
  const { data: requests = [] } = useTimeOff();
  const create = useRequestTimeOff();
  const update = useUpdateTimeOff();

  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState("vacation");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const today = new Date();
  const days = useMemo(() => eachDayOfInterval({ start: today, end: addDays(today, 30) }), [today.toDateString()]);

  // Coverage analysis: any day with >30% team OOO
  const coverage = useMemo(() => {
    const approved = requests.filter((r: any) => r.status === "approved");
    return days.map(d => {
      const oooMembers = approved.filter((r: any) => isWithinInterval(d, { start: parseISO(r.start_date), end: parseISO(r.end_date) }));
      const pct = members.length ? (oooMembers.length / members.length) * 100 : 0;
      return { date: d, oooCount: oooMembers.length, pct, members: oooMembers };
    });
  }, [days, requests, members]);

  const alerts = coverage.filter(c => c.pct > 30);

  const handleSubmit = async () => {
    if (!memberId || !start || !end) return;
    await create.mutateAsync({ member_id: memberId, type, start_date: start, end_date: end, reason });
    setReason(""); setStart(""); setEnd(""); setOpen(false);
  };

  const pending = requests.filter((r: any) => r.status === "pending");
  const upcoming = requests.filter((r: any) => r.status === "approved" && parseISO(r.end_date) >= today);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30">
            <Plane className="h-4 w-4 text-cyan-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Time-off & Calendario equipo</h3>
            <p className="text-[11px] text-muted-foreground">Vacaciones, permisos y cobertura del equipo en tiempo real</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><CalendarPlus className="h-3.5 w-3.5" />Solicitar tiempo libre</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva solicitud</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Colaborador" /></SelectTrigger>
                <SelectContent>{members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Desde</label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
                <div><label className="text-xs">Hasta</label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
              </div>
              <Textarea placeholder="Motivo (opcional)" value={reason} onChange={e => setReason(e.target.value)} rows={2} />
              <Button onClick={handleSubmit} disabled={create.isPending} className="w-full">Enviar solicitud</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {alerts.length > 0 && (
        <Card className="p-3 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-semibold">⚠ Alertas de cobertura ({alerts.length} días)</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Más del 30% del equipo estará ausente en: {alerts.slice(0, 5).map(a => format(a.date, "d MMM", { locale: es })).join(", ")}
            {alerts.length > 5 && ` y ${alerts.length - 5} más`}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-3">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" />Próximos 30 días</div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const c = coverage[i];
              const intensity = c.pct > 30 ? "bg-rose-500/40 border-rose-500/60" : c.pct > 15 ? "bg-amber-500/30 border-amber-500/50" : c.oooCount > 0 ? "bg-emerald-500/20 border-emerald-500/40" : "bg-muted/30 border-border";
              return (
                <div key={i} className={`aspect-square rounded-md border p-1 flex flex-col items-center justify-center ${intensity}`} title={c.members.map((m: any) => m.sysde_team_members?.name).join(", ")}>
                  <div className="text-[10px] text-muted-foreground">{format(d, "EEE", { locale: es }).slice(0, 1).toUpperCase()}</div>
                  <div className="text-xs font-bold">{format(d, "d")}</div>
                  {c.oooCount > 0 && <div className="text-[9px] font-semibold">{c.oooCount}</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-muted/30 border" />0</span>
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />1-15%</span>
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-amber-500/30 border border-amber-500/50" />15-30%</span>
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-rose-500/40 border border-rose-500/60" />&gt;30% ⚠</span>
          </div>
        </Card>

        <div className="space-y-3">
          {pending.length > 0 && (
            <Card className="p-3">
              <div className="text-xs font-semibold mb-2">Pendientes ({pending.length})</div>
              <div className="space-y-2">
                {pending.map((r: any) => (
                  <div key={r.id} className="p-2 rounded-md border bg-amber-500/5">
                    <div className="text-xs font-medium">{r.sysde_team_members?.name}</div>
                    <div className="text-[10px] text-muted-foreground mb-1">{TYPES.find(t => t.value === r.type)?.label} · {format(parseISO(r.start_date), "d MMM", { locale: es })} → {format(parseISO(r.end_date), "d MMM", { locale: es })}</div>
                    {r.reason && <div className="text-[11px] italic mb-1">"{r.reason}"</div>}
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-emerald-600" onClick={() => update.mutate({ id: r.id, status: "approved", approved_at: new Date().toISOString() })}>
                        <Check className="h-3 w-3 mr-1" />Aprobar
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-rose-600" onClick={() => update.mutate({ id: r.id, status: "rejected" })}>
                        <X className="h-3 w-3 mr-1" />Rechazar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-3">
            <div className="text-xs font-semibold mb-2">Próximas ausencias ({upcoming.length})</div>
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {upcoming.length === 0 && <p className="text-[11px] text-muted-foreground py-2">Sin ausencias programadas</p>}
              {upcoming.map((r: any) => {
                const tInfo = TYPES.find(t => t.value === r.type);
                return (
                  <div key={r.id} className="flex items-center gap-2 p-1.5 rounded border-l-2" style={{ borderColor: "currentColor" }}>
                    <div className={`h-2 w-2 rounded-full ${tInfo?.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{r.sysde_team_members?.name}</div>
                      <div className="text-[10px] text-muted-foreground">{format(parseISO(r.start_date), "d MMM", { locale: es })} → {format(parseISO(r.end_date), "d MMM", { locale: es })}</div>
                    </div>
                    <Badge variant="outline" className="text-[9px]">{tInfo?.label.split(" ")[0]}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
