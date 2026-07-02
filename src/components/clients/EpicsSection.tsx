import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, GitBranch } from "lucide-react";
import { EpicsProgressPanel } from "./EpicsProgressPanel";
import { EpicsBacklogTree } from "./EpicsBacklogTree";

interface Props {
  clientId: string;
}

/** Sección de épicas con dos vistas: Resumen (avance + facturación) y
 *  Backlog en árbol estilo DevOps (Épica → Feature → HU → Task). */
export function EpicsSection({ clientId }: Props) {
  const [view, setView] = useState<"resumen" | "backlog">("resumen");

  return (
    <div className="space-y-3">
      <div className="flex items-center rounded-md border border-border overflow-hidden w-fit h-8">
        <button
          onClick={() => setView("resumen")}
          className={`px-3 h-full text-xs flex items-center gap-1.5 ${view === "resumen" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          <Layers className="h-3.5 w-3.5" /> Resumen
        </button>
        <button
          onClick={() => setView("backlog")}
          className={`px-3 h-full text-xs flex items-center gap-1.5 ${view === "backlog" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          <GitBranch className="h-3.5 w-3.5" /> Backlog (árbol)
        </button>
      </div>

      {view === "resumen" ? (
        <EpicsProgressPanel clientId={clientId} />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" /> Backlog · Épica → Feature → HU → Task
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <EpicsBacklogTree clientId={clientId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
