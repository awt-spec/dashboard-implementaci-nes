import { useState } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMyNotifications, useUnreadNotificationCount,
  useMarkNotificationRead, useMarkAllRead, useNotificationRealtime,
  type NotificationKind,
} from "@/hooks/useNotifications";

const KIND_LABEL: Record<NotificationKind, string> = {
  ticket_assigned: "Asignación",
  ticket_status_changed: "Cambio de estado",
  note_added: "Nota",
  subtask_assigned: "Subtarea",
  minute_shared: "Minuta",
  mention: "Mención",
  system: "Sistema",
};

const KIND_CLASSES: Record<NotificationKind, string> = {
  ticket_assigned: "bg-info/15 text-info border-info/30",
  ticket_status_changed: "bg-warning/15 text-warning border-warning/30",
  note_added: "bg-muted text-muted-foreground border-border",
  subtask_assigned: "bg-primary/10 text-primary border-primary/30",
  minute_shared: "bg-success/10 text-success border-success/30",
  mention: "bg-destructive/10 text-destructive border-destructive/30",
  system: "bg-muted text-muted-foreground border-border",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [], isLoading } = useMyNotifications(20);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  useNotificationRealtime();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notificaciones">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Notificaciones</span>
            {unreadCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                {unreadCount} sin leer
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="h-7 gap-1 text-[11px]"
            >
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Cargando…</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            Sin notificaciones
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <div className="divide-y divide-border/50">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 hover:bg-muted/40 transition-colors ${n.is_read ? "" : "bg-primary/[.03]"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Badge variant="outline" className={`text-[9px] ${KIND_CLASSES[n.kind] ?? ""}`}>
                      {KIND_LABEL[n.kind] ?? n.kind}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground shrink-0" title={n.created_at}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                  <p className={`text-sm ${n.is_read ? "" : "font-semibold"}`}>{n.title}</p>
                  {n.body && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{n.body}</p>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    {n.link ? (
                      <a
                        href={n.link}
                        onClick={() => { markRead.mutate(n.id); setOpen(false); }}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Abrir
                      </a>
                    ) : <span />}
                    {!n.is_read && (
                      <button
                        onClick={() => markRead.mutate(n.id)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
