import { Card, CardContent } from "@/components/ui/card";
import { Wallet, AlertTriangle } from "lucide-react";

export interface HoursPocket {
  id: string;
  policy_number: number;
  package_number: number;
  hours_contracted: number;
  consumed: number;
  balance: number;
  end_date: string;
}

const n1 = (v: number) => Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

/** Color por saldo restante: verde / ámbar / rojo. */
function tone(pctLeft: number, negative: boolean) {
  if (negative) return { ring: "hsl(var(--destructive))", text: "text-destructive" };
  if (pctLeft > 40) return { ring: "hsl(var(--success))", text: "text-success" };
  if (pctLeft > 15) return { ring: "hsl(var(--warning))", text: "text-warning" };
  return { ring: "hsl(var(--destructive))", text: "text-destructive" };
}

function Ring({ pctLeft, color, hours, negative }: { pctLeft: number; color: string; hours: number; negative: boolean }) {
  const r = 22, c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, pctLeft));
  const off = c * (1 - shown / 100);
  return (
    <div className="relative shrink-0" style={{ width: 60, height: 60 }}>
      <svg width={60} height={60} viewBox="0 0 60 60">
        <circle cx={30} cy={30} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={6} />
        <circle
          cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 30 30)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-sm font-black tabular-nums">{negative ? "0" : n1(hours)}</span>
        <span className="text-[8px] text-muted-foreground">h</span>
      </div>
    </div>
  );
}

/**
 * Bolsa de horas: saldo disponible de un vistazo por póliza activa (tipo saldo
 * bancario). Solo horas — no gatea información financiera.
 */
export function HoursBalanceStrip({ pockets }: { pockets: HoursPocket[] }) {
  if (pockets.length === 0) return null;
  const totalDisponible = pockets.reduce((s, p) => s + p.balance, 0);
  const totalContratado = pockets.reduce((s, p) => s + Number(p.hours_contracted), 0);
  const totalNeg = totalDisponible < 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Total disponible */}
          <div className="flex items-center gap-3 pr-4 border-r border-border">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Horas disponibles</p>
              <p className={`text-2xl font-black tabular-nums leading-tight ${totalNeg ? "text-destructive" : ""}`}>
                {n1(totalDisponible)} <span className="text-xs font-normal text-muted-foreground">de {n1(totalContratado)} h</span>
              </p>
            </div>
          </div>

          {/* Ring por póliza activa */}
          <div className="flex items-center gap-4 flex-wrap">
            {pockets.map((p) => {
              const pctLeft = Number(p.hours_contracted) ? (p.balance / Number(p.hours_contracted)) * 100 : 0;
              const neg = p.balance < 0;
              const t = tone(pctLeft, neg);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <Ring pctLeft={pctLeft} color={t.ring} hours={p.balance} negative={neg} />
                  <div className="text-[11px] leading-tight">
                    <p className="font-semibold">Póliza {p.policy_number}</p>
                    <p className="text-muted-foreground tabular-nums">{n1(p.consumed)}/{n1(p.hours_contracted)} h usadas</p>
                    <p className="text-[10px] text-muted-foreground">vence {fmtDate(p.end_date)}</p>
                    {neg && (
                      <p className="text-[10px] text-destructive flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> sobreconsumo {n1(Math.abs(p.balance))} h</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
