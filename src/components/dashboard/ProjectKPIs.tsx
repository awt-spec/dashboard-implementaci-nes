import { type Client } from "@/data/projectData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Gauge } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProjectKPIsProps {
  clients: Client[];
  /** Show for a single client only */
  client?: Client;
}

function parseDate(dateStr: string): Date | null {
  // Try ISO
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  // Try "DD Mon YYYY" format
  const months: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
    jan: 0, apr: 3, aug: 7, dec: 11,
  };
  const parts = dateStr.replace(",", "").split(" ");
  if (parts.length >= 3) {
    const day = parseInt(parts[0]);
    const mon = months[parts[1].toLowerCase().slice(0, 3)];
    const year = parseInt(parts[2]);
    if (!isNaN(day) && mon !== undefined && !isNaN(year)) return new Date(year, mon, day);
  }
  // Try "Mon YYYY"
  if (parts.length === 2) {
    const mon = months[parts[0].toLowerCase().slice(0, 3)];
    const year = parseInt(parts[1]);
    if (mon !== undefined && !isNaN(year)) return new Date(year, mon, 1);
  }
  return null;
}

function calcSPI(client: Client): number | null {
  const start = parseDate(client.contractStart);
  const end = parseDate(client.contractEnd);
  if (!start || !end) return null;
  const now = new Date();
  const totalDuration = end.getTime() - start.getTime();
  if (totalDuration <= 0) return null;
  const elapsed = Math.min(now.getTime() - start.getTime(), totalDuration);
  if (elapsed <= 0) return null;
  const plannedProgress = (elapsed / totalDuration) * 100;
  return plannedProgress > 0 ? client.progress / plannedProgress : 1;
}

function calcCPI(client: Client, financials?: { hours_estimated: number; hours_used: number; contract_value: number; billed: number }): number | null {
  if (financials && financials.hours_estimated > 0 && financials.hours_used > 0) {
    const ev = (client.progress / 100) * financials.contract_value;
    const ac = financials.billed > 0 ? financials.billed : (financials.hours_used / financials.hours_estimated) * financials.contract_value;
    return ac > 0 ? ev / ac : null;
  }
  // Fallback: use phase progress vs time
  return null;
}

function getIndicatorInfo(value: number) {
  if (value >= 1.05) return { label: "Adelantado", color: "text-success", bg: "bg-success/10", icon: TrendingUp };
  if (value >= 0.95) return { label: "En tiempo", color: "text-info", bg: "bg-info/10", icon: Minus };
  if (value >= 0.8) return { label: "Leve atraso", color: "text-warning", bg: "bg-warning/10", icon: TrendingDown };
  return { label: "Atraso", color: "text-destructive", bg: "bg-destructive/10", icon: TrendingDown };
}

export function ProjectKPIs({ clients, client }: ProjectKPIsProps) {
  const targetClients = client ? [client] : clients;

  const kpiData = targetClients.map(c => {
    const spi = calcSPI(c);
    return { name: c.name, id: c.id, spi, cpi: null as number | null };
  });

  // Global averages
  const validSPIs = kpiData.filter(k => k.spi !== null).map(k => k.spi!);
  const avgSPI = validSPIs.length > 0 ? validSPIs.reduce((a, b) => a + b, 0) / validSPIs.length : null;

  if (client) {
    const spi = kpiData[0]?.spi;
    const spiInfo = spi !== null ? getIndicatorInfo(spi!) : null;

    return (
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg ${spiInfo?.bg || "bg-muted"} flex items-center justify-center`}>
                        <Gauge className={`h-5 w-5 ${spiInfo?.color || "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SPI</p>
                        <p className={`text-xl font-bold ${spiInfo?.color || "text-foreground"}`}>
                          {spi !== null ? spi!.toFixed(2) : "N/A"}
                        </p>
                        {spiInfo && (
                          <Badge variant="outline" className={`text-[9px] ${spiInfo.color} mt-0.5`}>
                            {spiInfo.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Schedule Performance Index<br/>SPI = Progreso Real / Progreso Planificado<br/>&gt;1 = Adelantado, 1 = En tiempo, &lt;1 = Atraso</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="p-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Gauge className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CPI</p>
                        <p className="text-xl font-bold text-muted-foreground">—</p>
                        <Badge variant="outline" className="text-[9px] text-muted-foreground mt-0.5">
                          Datos pendientes
                        </Badge>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Cost Performance Index<br/>CPI = Valor Ganado / Costo Real<br/>Se calculará cuando haya datos financieros completos</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Consolidated view
  const avgSPIInfo = avgSPI !== null ? getIndicatorInfo(avgSPI) : null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Indicadores de Desempeño (KPI)</h3>
        </div>

        {/* Global average */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className={`p-3 rounded-lg ${avgSPIInfo?.bg || "bg-muted/50"} border border-border`}>
            <p className="text-[10px] text-muted-foreground uppercase">SPI Promedio</p>
            <p className={`text-2xl font-bold ${avgSPIInfo?.color || "text-foreground"}`}>
              {avgSPI !== null ? avgSPI.toFixed(2) : "N/A"}
            </p>
            {avgSPIInfo && <Badge variant="outline" className={`text-[9px] ${avgSPIInfo.color}`}>{avgSPIInfo.label}</Badge>}
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase">CPI Promedio</p>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <Badge variant="outline" className="text-[9px] text-muted-foreground">Datos pendientes</Badge>
          </div>
        </div>

        {/* Per-client breakdown */}
        <div className="space-y-2">
          {kpiData.map(k => {
            const info = k.spi !== null ? getIndicatorInfo(k.spi) : null;
            return (
              <div key={k.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <span className="text-xs font-medium text-foreground truncate mr-2">{k.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground">SPI </span>
                    <span className={`text-xs font-bold ${info?.color || "text-foreground"}`}>
                      {k.spi !== null ? k.spi.toFixed(2) : "N/A"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground">CPI </span>
                    <span className="text-xs font-bold text-muted-foreground">—</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
