import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Muestra su contenido sólo si `show` es true; de lo contrario enmascara el
 * valor con un candado y el texto "Referir a Eduardo" (info financiera
 * restringida). Uso: <Confidential show={canAmounts}>{fmtMoney(x)}</Confidential>
 */
export function Confidential({
  show,
  children,
  className,
  label = "Referir a Eduardo",
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  if (show) return <>{children}</>;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-muted-foreground italic", className)}
      title={`Información financiera restringida — ${label}`}
    >
      <Lock className="h-3 w-3 shrink-0" />
      <span className="tracking-wider">•••</span>
    </span>
  );
}
