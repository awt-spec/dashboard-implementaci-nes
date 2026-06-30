import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MonitorSmartphone, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  last_heartbeat: string;
  user_agent: string | null;
  duration_seconds: number | null;
}

// Detalle de sesiones individuales de los usuarios (ERP-109). El registro de
// sesiones lo hace useActivityTracker (insert + heartbeat + cierre); este panel
// es la vista admin del detalle: usuario, inicio, fin/activa, duración y
// dispositivo. La RLS de user_sessions ya permite a admin/PM ver todas.
function useSessionsDetail() {
  return useQuery({
    queryKey: ["sessions-detail"],
    queryFn: async () => {
      const [{ data: sessions, error }, { data: profiles }] = await Promise.all([
        supabase
          .from("user_sessions")
          .select("id, user_id, started_at, ended_at, last_heartbeat, user_agent, duration_seconds")
          .order("started_at", { ascending: false })
          .limit(150),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      if (error) throw error;
      const names = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      return ((sessions || []) as SessionRow[]).map((s) => ({
        ...s,
        user_name: names.get(s.user_id) || "Usuario",
      }));
    },
  });
}

function fmtDuration(secs: number | null): string {
  if (!secs || secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function device(ua: string | null): string {
  if (!ua) return "—";
  if (/mobile|android|iphone/i.test(ua)) return "Móvil";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Escritorio";
}

export function SessionsDetailPanel() {
  const { data: sessions = [], isLoading } = useSessionsDetail();
  const [q, setQ] = useState("");

  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () => sessions.filter((s: any) => !term || (s.user_name || "").toLowerCase().includes(term)),
    [sessions, term],
  );

  const ACTIVE_MS = 5 * 60_000; // activa = heartbeat en últimos 5 min y sin ended_at

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">Detalle de sesiones</h2>
        <Badge variant="outline" className="ml-1">{sessions.length} recientes</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por usuario..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 w-[260px] pl-8 text-xs"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="text-right">Duración</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary inline" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">Sin sesiones registradas</TableCell></TableRow>
              ) : filtered.map((s: any) => {
                const active = !s.ended_at && (Date.now() - new Date(s.last_heartbeat).getTime() < ACTIVE_MS);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.user_name}</TableCell>
                    <TableCell className="text-xs">{format(new Date(s.started_at), "d MMM HH:mm", { locale: es })}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.ended_at ? format(new Date(s.ended_at), "d MMM HH:mm", { locale: es }) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmtDuration(s.duration_seconds)}</TableCell>
                    <TableCell className="text-xs">{device(s.user_agent)}</TableCell>
                    <TableCell>
                      {active
                        ? <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">Activa</Badge>
                        : <Badge variant="secondary" className="text-[10px]">Finalizada</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
