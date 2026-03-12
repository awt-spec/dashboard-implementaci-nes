import { type EmailNotification } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, CheckCircle2, AlertCircle, Clock, FileText, Bell, ArrowUpRight } from "lucide-react";

const statusConfig = {
  enviado: { label: "Enviado", icon: CheckCircle2, className: "bg-success text-success-foreground" },
  pendiente: { label: "Pendiente", icon: Clock, className: "bg-warning text-warning-foreground" },
  fallido: { label: "Fallido", icon: AlertCircle, className: "bg-destructive text-destructive-foreground" },
};

const typeIcons = {
  reporte: FileText,
  alerta: Bell,
  seguimiento: ArrowUpRight,
  minuta: Send,
};

interface EmailNotificationsTabProps {
  emailNotifications: EmailNotification[];
}

export function EmailNotificationsTab({ emailNotifications }: EmailNotificationsTabProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Notificaciones Email ({emailNotifications.length})</CardTitle>
          <div className="flex gap-2">
            <Badge className="bg-success text-success-foreground">{emailNotifications.filter(e => e.status === "enviado").length} enviados</Badge>
            {emailNotifications.filter(e => e.status === "pendiente").length > 0 && (
              <Badge className="bg-warning text-warning-foreground">{emailNotifications.filter(e => e.status === "pendiente").length} pendientes</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {emailNotifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin notificaciones registradas</p>
        ) : emailNotifications.map(email => {
          const config = statusConfig[email.status];
          const TypeIcon = typeIcons[email.type];
          return (
            <div key={email.id} className="p-3 rounded-lg border border-border hover:bg-secondary/20 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <TypeIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{email.preview}</p>
                  </div>
                </div>
                <Badge className={`${config.className} shrink-0`}>{config.label}</Badge>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-2 ml-[42px] flex-wrap">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {email.to.join(", ")}</span>
                <span>•</span>
                <span>{email.date}</span>
                <span>•</span>
                <span>De: {email.from}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
