import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSignature, Shield, Plus, Trash2, Clock, Edit2, Lock, Package, Search, Sparkles, ShieldCheck, Database, Gauge, Wallet, CalendarClock, RefreshCw, Timer, TriangleAlert } from "lucide-react";
import { ContractAnalysisDialog } from "./ContractAnalysisDialog";
import { ContractKbPanel } from "./ContractKbPanel";
import { ContractAuditPanel } from "./ContractAuditPanel";
import { SlaCompliancePanel } from "./SlaCompliancePanel";
import { SlaHistoryPanel } from "./SlaHistoryPanel";
import { BilledPackagesTab } from "./BilledPackagesTab";
import { ServicePackagesTab } from "./ServicePackagesTab";
import { Confidential } from "@/components/common/Confidential";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useClientContracts, useClientSLAs,
  useUpsertContract, useDeleteContract,
  useUpsertSLA, useDeleteSLA,
  type ClientContract, type ClientSLA,
} from "@/hooks/useClientContracts";

const CONTRACT_TYPES = [
  { value: "bolsa_horas", label: "Bolsa de horas" },
  { value: "fee_mensual", label: "Fee mensual fijo" },
  { value: "proyecto_cerrado", label: "Proyecto cerrado" },
  { value: "tiempo_materiales", label: "Tiempo y materiales" },
];
const PRIORITY_LEVELS = ["Crítica", "Alta", "Media", "Baja"];
const CASE_TYPES = ["all", "Incidente", "Requerimiento", "Mejora", "Consulta"];

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}
// Progreso 0-100 del período de vigencia transcurrido.
function vigenciaPct(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  return Math.min(100, Math.max(0, ((Date.now() - s) / (e - s)) * 100));
}

export function ContractsSLATab({ clientId }: { clientId: string }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { data: contracts = [] } = useClientContracts(clientId);
  const { data: slas = [] } = useClientSLAs(clientId);
  const upsertContract = useUpsertContract();
  const deleteContract = useDeleteContract();
  const upsertSLA = useUpsertSLA();
  const deleteSLA = useDeleteSLA();

  const [contractDialog, setContractDialog] = useState<Partial<ClientContract> | null>(null);
  const [slaDialog, setSlaDialog] = useState<Partial<ClientSLA> | null>(null);
  const [analysisContract, setAnalysisContract] = useState<any | null>(null);

  // Búsqueda/filtros de contratos (ERP-063)
  const [contractSearch, setContractSearch] = useState("");
  const [contractType, setContractType] = useState("all");
  const [contractStatus, setContractStatus] = useState("all");

  const totalMonthly = contracts.filter(c => c.is_active).reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const activeContract = contracts.find(c => c.is_active);
  const { canAmounts } = useFinanceAccess();

  const term = contractSearch.trim().toLowerCase();
  const filteredContracts = contracts.filter(c => {
    if (contractType !== "all" && c.contract_type !== contractType) return false;
    if (contractStatus === "active" && !c.is_active) return false;
    if (contractStatus === "inactive" && c.is_active) return false;
    if (term) {
      const typeLabel = CONTRACT_TYPES.find(t => t.value === c.contract_type)?.label || c.contract_type;
      const hay = [typeLabel, c.notes, c.currency].some(f => (f || "").toLowerCase().includes(term));
      if (!hay) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          <span>Vista de solo lectura. Solo los administradores pueden editar contratos y SLAs.</span>
        </div>
      )}
      <Tabs defaultValue="contracts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contracts" className="gap-2"><FileSignature className="h-4 w-4" /> Contratos</TabsTrigger>
          <TabsTrigger value="slas" className="gap-2"><Shield className="h-4 w-4" /> SLAs</TabsTrigger>
          <TabsTrigger value="policies" className="gap-2"><ShieldCheck className="h-4 w-4" /> Pólizas</TabsTrigger>
          <TabsTrigger value="packages" className="gap-2"><Package className="h-4 w-4" /> Paquetes facturados</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2"><Gauge className="h-4 w-4" /> Auditoría</TabsTrigger>
          <TabsTrigger value="kb" className="gap-2"><Database className="h-4 w-4" /> Base de conocimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="space-y-4">
          {(() => {
            const activeCount = contracts.filter(c => c.is_active).length;
            const avgRate = contracts.length ? Math.round(contracts.reduce((s, c) => s + Number(c.hourly_rate || 0), 0) / contracts.length) : 0;
            const cur = activeContract?.currency || "USD";
            const dleft = daysUntil(activeContract?.end_date);
            const vencTone = activeContract?.auto_renewal ? "success" : dleft == null ? "muted" : dleft < 0 ? "destructive" : dleft < 30 ? "destructive" : dleft < 90 ? "warning" : "success";
            const barTone: Record<string, string> = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", muted: "bg-muted-foreground/30", primary: "bg-primary" };
            const textTone: Record<string, string> = { success: "text-success", warning: "text-warning", destructive: "text-destructive", muted: "text-muted-foreground" };
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="overflow-hidden">
                  <div className="h-1 w-full bg-primary" />
                  <CardContent className="p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Wallet className="h-3 w-3 text-primary" /> Valor mensual activo</p>
                    <p className="text-2xl font-black tabular-nums mt-1"><Confidential show={canAmounts}>${totalMonthly.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{cur}</span></Confidential></p>
                    {totalMonthly > 0 && <p className="text-[10px] text-muted-foreground"><Confidential show={canAmounts}>${(totalMonthly * 12).toLocaleString()} / año</Confidential></p>}
                  </CardContent>
                </Card>
                <Card className="overflow-hidden">
                  <div className="h-1 w-full bg-info" />
                  <CardContent className="p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><FileSignature className="h-3 w-3 text-info" /> Contratos activos</p>
                    <p className="text-2xl font-black tabular-nums mt-1">{activeCount}</p>
                    <p className="text-[10px] text-muted-foreground">de {contracts.length} totales</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden">
                  <div className="h-1 w-full bg-primary" />
                  <CardContent className="p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Timer className="h-3 w-3 text-primary" /> Tarifa hora promedio</p>
                    <p className="text-2xl font-black tabular-nums mt-1"><Confidential show={canAmounts}>${avgRate}<span className="text-xs font-normal text-muted-foreground">/h</span></Confidential></p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden">
                  <div className={`h-1 w-full ${barTone[vencTone]}`} />
                  <CardContent className="p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Vencimiento</p>
                    {activeContract?.auto_renewal ? (
                      <p className="text-lg font-black mt-1 flex items-center gap-1.5 text-success"><RefreshCw className="h-4 w-4" /> Renovación auto</p>
                    ) : dleft == null ? (
                      <p className="text-lg font-black mt-1 text-muted-foreground">Indefinido</p>
                    ) : dleft < 0 ? (
                      <p className="text-lg font-black mt-1 text-destructive flex items-center gap-1.5"><TriangleAlert className="h-4 w-4" /> Vencido</p>
                    ) : (
                      <p className={`text-2xl font-black tabular-nums mt-1 ${textTone[vencTone]}`}>{dleft}<span className="text-xs font-normal text-muted-foreground"> días</span></p>
                    )}
                    {activeContract?.end_date && !activeContract?.auto_renewal && <p className="text-[10px] text-muted-foreground">hasta {activeContract.end_date}</p>}
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <div className="flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2"><FileSignature className="h-4 w-4" /> Contratos</h3>
            {isAdmin && (
              <Button size="sm" onClick={() => setContractDialog({ client_id: clientId, contract_type: "bolsa_horas", currency: "USD", is_active: true })}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo contrato
              </Button>
            )}
          </div>

          {/* Búsqueda y filtros de contratos (ERP-063) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar contrato por tipo, moneda o notas..."
                value={contractSearch}
                onChange={e => setContractSearch(e.target.value)}
                className="h-8 w-[280px] pl-8 text-xs"
              />
            </div>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={contractStatus} onValueChange={setContractStatus}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredContracts.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              {contracts.length === 0 ? "Sin contratos registrados." : "Sin contratos que coincidan con la búsqueda."}
            </CardContent></Card>
          ) : (
            <div className="space-y-2.5">
              {filteredContracts.map(c => {
                const typeLabel = CONTRACT_TYPES.find(t => t.value === c.contract_type)?.label || c.contract_type;
                const pct = vigenciaPct(c.start_date, c.end_date);
                const dleft = daysUntil(c.end_date);
                const dtone = c.auto_renewal ? "text-success" : dleft == null ? "text-muted-foreground" : dleft < 0 ? "text-destructive" : dleft < 30 ? "text-destructive" : dleft < 90 ? "text-warning" : "text-muted-foreground";
                const ptone = pct == null ? "bg-primary" : pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-primary";
                return (
                  <Card key={c.id} className={`overflow-hidden ${c.is_active ? "" : "opacity-70"}`}>
                    <div className="flex items-stretch">
                      <div className={`w-1 shrink-0 ${c.is_active ? "bg-success" : "bg-muted-foreground/30"}`} />
                      <CardContent className="p-4 flex-1 min-w-0 space-y-3">
                        {/* Encabezado */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="gap-1"><FileSignature className="h-3 w-3" />{typeLabel}</Badge>
                            {c.is_active
                              ? <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Activo</Badge>
                              : <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                            {c.auto_renewal && <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30"><RefreshCw className="h-2.5 w-2.5" /> Renovación auto</Badge>}
                            {c.payment_terms && <Badge variant="outline" className="text-[10px]">{c.payment_terms}</Badge>}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Analizar con IA" onClick={() => setAnalysisContract(c)}><Sparkles className="h-3.5 w-3.5 text-primary" /></Button>
                            {isAdmin ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setContractDialog(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("¿Eliminar contrato?")) deleteContract.mutate(c.id, { onSuccess: () => toast.success("Eliminado") }); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </>
                            ) : <Lock className="h-3.5 w-3.5 text-muted-foreground self-center mx-1" />}
                          </div>
                        </div>

                        {/* Cifras */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor mensual</p>
                            <p className="text-lg font-black tabular-nums"><Confidential show={canAmounts}>${Number(c.monthly_value).toLocaleString()} <span className="text-[11px] font-normal text-muted-foreground">{c.currency}</span></Confidential></p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tarifa hora</p>
                            <p className="text-lg font-black tabular-nums"><Confidential show={canAmounts}>${Number(c.hourly_rate)}<span className="text-[11px] font-normal text-muted-foreground">/h</span></Confidential></p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Horas incluidas</p>
                            <p className="text-lg font-black tabular-nums">{c.included_hours}<span className="text-[11px] font-normal text-muted-foreground">h</span></p>
                          </div>
                        </div>

                        {/* Vigencia */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-3 w-3" /> {c.start_date || "—"} → {c.end_date || "indefinido"}</span>
                            <span className={`font-semibold ${dtone}`}>
                              {c.auto_renewal ? "renueva solo" : dleft == null ? "sin vencimiento" : dleft < 0 ? `vencido hace ${Math.abs(dleft)}d` : `faltan ${dleft} días`}
                            </span>
                          </div>
                          {pct != null && (
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${ptone}`} style={{ width: `${pct}%` }} /></div>
                          )}
                        </div>

                        {c.notes && <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2">{c.notes}</p>}
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="slas" className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {PRIORITY_LEVELS.map(p => {
              const sla = slas.find(s => s.priority_level === p && s.case_type === "all" && s.is_active);
              return (
                <Card key={p}><CardContent className="p-3">
                  <Badge variant="outline" className="text-[10px] mb-2">{p}</Badge>
                  {sla ? (
                    <>
                      <p className="text-sm font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> {sla.response_time_hours}h resp.</p>
                      <p className="text-xs text-muted-foreground">{sla.resolution_time_hours}h resolución</p>
                    </>
                  ) : <p className="text-xs text-muted-foreground">Sin definir</p>}
                </CardContent></Card>
              );
            })}
          </div>

          <div className="flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Acuerdos de Nivel de Servicio</h3>
            {isAdmin && (
              <Button size="sm" onClick={() => setSlaDialog({ client_id: clientId, priority_level: "Alta", case_type: "all", response_time_hours: 4, resolution_time_hours: 24, business_hours_only: true, is_active: true })}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo SLA
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Respuesta</TableHead>
                    <TableHead>Resolución</TableHead>
                    <TableHead>Penalidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">Sin SLAs registrados</TableCell></TableRow>
                  ) : slas.map(s => (
                    <TableRow key={s.id}>
                      <TableCell><Badge>{s.priority_level}</Badge></TableCell>
                      <TableCell className="text-xs">{s.case_type === "all" ? "Todos" : s.case_type}</TableCell>
                      <TableCell>{s.response_time_hours}h</TableCell>
                      <TableCell>{s.resolution_time_hours}h</TableCell>
                      <TableCell className="text-xs">{s.penalty_amount ? <Confidential show={canAmounts}>${s.penalty_amount}</Confidential> : "—"}</TableCell>
                      <TableCell>
                        {s.is_active ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Activo</Badge> : <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setSlaDialog(s)}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar SLA?")) deleteSLA.mutate(s.id, { onSuccess: () => toast.success("Eliminado") }); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        ) : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cumplimiento SLA por caso (transfiere el SLA a los casos abiertos) */}
          <SlaCompliancePanel clientId={clientId} />

          {/* Histórico de cumplimiento (casos cerrados) */}
          <SlaHistoryPanel clientId={clientId} />
        </TabsContent>

        {/* PAQUETES FACTURADOS — gap Tanda B (ERP-068 a 070) */}
        <TabsContent value="policies" className="space-y-4">
          <ServicePackagesTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <BilledPackagesTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <ContractAuditPanel clientId={clientId} contractId={activeContract?.id} />
        </TabsContent>

        <TabsContent value="kb" className="space-y-4">
          <ContractKbPanel clientId={clientId} contractId={activeContract?.id} />
        </TabsContent>
      </Tabs>

      {/* Contract Dialog */}
      <Dialog open={!!contractDialog} onOpenChange={(v) => !v && setContractDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{contractDialog?.id ? "Editar contrato" : "Nuevo contrato"}</DialogTitle></DialogHeader>
          {contractDialog && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Tipo de contrato</Label>
                <Select value={contractDialog.contract_type} onValueChange={(v) => setContractDialog({ ...contractDialog, contract_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor mensual</Label>
                <Input type="number" value={contractDialog.monthly_value || 0} onChange={(e) => setContractDialog({ ...contractDialog, monthly_value: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select value={contractDialog.currency || "USD"} onValueChange={(v) => setContractDialog({ ...contractDialog, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="CRC">CRC</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="MXN">MXN</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tarifa hora</Label>
                <Input type="number" value={contractDialog.hourly_rate || 0} onChange={(e) => setContractDialog({ ...contractDialog, hourly_rate: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Horas incluidas</Label>
                <Input type="number" value={contractDialog.included_hours || 0} onChange={(e) => setContractDialog({ ...contractDialog, included_hours: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Inicio</Label>
                <Input type="date" value={contractDialog.start_date || ""} onChange={(e) => setContractDialog({ ...contractDialog, start_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Fin</Label>
                <Input type="date" value={contractDialog.end_date || ""} onChange={(e) => setContractDialog({ ...contractDialog, end_date: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Cláusula de penalidad</Label>
                <Textarea rows={2} value={contractDialog.penalty_clause || ""} onChange={(e) => setContractDialog({ ...contractDialog, penalty_clause: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Notas</Label>
                <Textarea rows={2} value={contractDialog.notes || ""} onChange={(e) => setContractDialog({ ...contractDialog, notes: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Cláusulas / términos del contrato</Label>
                <Textarea rows={5} value={(contractDialog as any).clauses || ""} onChange={(e) => setContractDialog({ ...contractDialog, clauses: e.target.value } as any)} placeholder="Clausulado del contrato (objeto, alcance, vigencia, pagos, SLA, penalidades, confidencialidad…). Insumo del análisis IA." />
              </div>
              <div className="col-span-2 flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={!!contractDialog.is_active} onCheckedChange={(v) => setContractDialog({ ...contractDialog, is_active: v })} />
                  <Label>Activo</Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setContractDialog(null)}>Cancelar</Button>
                  <Button onClick={() => upsertContract.mutate(contractDialog as any, {
                    onSuccess: () => { toast.success("Guardado"); setContractDialog(null); },
                    onError: (e: any) => toast.error(e.message)
                  })} disabled={upsertContract.isPending}>Guardar</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SLA Dialog */}
      <Dialog open={!!slaDialog} onOpenChange={(v) => !v && setSlaDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{slaDialog?.id ? "Editar SLA" : "Nuevo SLA"}</DialogTitle></DialogHeader>
          {slaDialog && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioridad</Label>
                <Select value={slaDialog.priority_level} onValueChange={(v) => setSlaDialog({ ...slaDialog, priority_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_LEVELS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo de caso</Label>
                <Select value={slaDialog.case_type || "all"} onValueChange={(v) => setSlaDialog({ ...slaDialog, case_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CASE_TYPES.map(c => <SelectItem key={c} value={c}>{c === "all" ? "Todos" : c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tiempo respuesta (h)</Label>
                <Input type="number" step="0.5" value={slaDialog.response_time_hours || 0} onChange={(e) => setSlaDialog({ ...slaDialog, response_time_hours: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Tiempo resolución (h)</Label>
                <Input type="number" step="0.5" value={slaDialog.resolution_time_hours || 0} onChange={(e) => setSlaDialog({ ...slaDialog, resolution_time_hours: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Penalidad ($)</Label>
                <Input type="number" value={slaDialog.penalty_amount || 0} onChange={(e) => setSlaDialog({ ...slaDialog, penalty_amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-1 pt-6 flex items-center gap-2">
                <Switch checked={!!slaDialog.business_hours_only} onCheckedChange={(v) => setSlaDialog({ ...slaDialog, business_hours_only: v })} />
                <Label>Solo horario laboral</Label>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descripción de penalidad</Label>
                <Textarea rows={2} value={slaDialog.penalty_description || ""} onChange={(e) => setSlaDialog({ ...slaDialog, penalty_description: e.target.value })} />
              </div>
              <div className="col-span-2 flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={!!slaDialog.is_active} onCheckedChange={(v) => setSlaDialog({ ...slaDialog, is_active: v })} />
                  <Label>Activo</Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSlaDialog(null)}>Cancelar</Button>
                  <Button onClick={() => upsertSLA.mutate(slaDialog as any, {
                    onSuccess: () => { toast.success("Guardado"); setSlaDialog(null); },
                    onError: (e: any) => toast.error(e.message)
                  })} disabled={upsertSLA.isPending}>Guardar</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Análisis IA del contrato */}
      {analysisContract && (
        <ContractAnalysisDialog
          open={!!analysisContract}
          onOpenChange={(o) => !o && setAnalysisContract(null)}
          contract={analysisContract}
        />
      )}
    </div>
  );
}
