import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSignature, Shield, Plus, Trash2, DollarSign, Clock, AlertTriangle, Edit2 } from "lucide-react";
import { toast } from "sonner";
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

export function ContractsSLATab({ clientId }: { clientId: string }) {
  const { data: contracts = [] } = useClientContracts(clientId);
  const { data: slas = [] } = useClientSLAs(clientId);
  const upsertContract = useUpsertContract();
  const deleteContract = useDeleteContract();
  const upsertSLA = useUpsertSLA();
  const deleteSLA = useDeleteSLA();

  const [contractDialog, setContractDialog] = useState<Partial<ClientContract> | null>(null);
  const [slaDialog, setSlaDialog] = useState<Partial<ClientSLA> | null>(null);

  const totalMonthly = contracts.filter(c => c.is_active).reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const activeContract = contracts.find(c => c.is_active);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="contracts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contracts" className="gap-2"><FileSignature className="h-4 w-4" /> Contratos</TabsTrigger>
          <TabsTrigger value="slas" className="gap-2"><Shield className="h-4 w-4" /> SLAs</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-[10px] uppercase text-muted-foreground">Valor mensual activo</p>
              <p className="text-2xl font-bold mt-1">${totalMonthly.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{activeContract?.currency || "USD"}</span></p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-[10px] uppercase text-muted-foreground">Contratos activos</p>
              <p className="text-2xl font-bold mt-1">{contracts.filter(c => c.is_active).length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-[10px] uppercase text-muted-foreground">Tarifa hora promedio</p>
              <p className="text-2xl font-bold mt-1">${contracts.length ? Math.round(contracts.reduce((s, c) => s + Number(c.hourly_rate || 0), 0) / contracts.length) : 0}</p>
            </CardContent></Card>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2"><FileSignature className="h-4 w-4" /> Contratos</h3>
            <Button size="sm" onClick={() => setContractDialog({ client_id: clientId, contract_type: "bolsa_horas", currency: "USD", is_active: true })}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo contrato
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor mensual</TableHead>
                    <TableHead>Tarifa hora</TableHead>
                    <TableHead>Horas incluidas</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">Sin contratos registrados</TableCell></TableRow>
                  ) : contracts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell><Badge variant="outline">{CONTRACT_TYPES.find(t => t.value === c.contract_type)?.label || c.contract_type}</Badge></TableCell>
                      <TableCell className="font-medium">${Number(c.monthly_value).toLocaleString()} {c.currency}</TableCell>
                      <TableCell>${Number(c.hourly_rate)}/h</TableCell>
                      <TableCell>{c.included_hours}h</TableCell>
                      <TableCell className="text-xs">{c.start_date || "—"} → {c.end_date || "indef."}</TableCell>
                      <TableCell>
                        {c.is_active ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Activo</Badge> : <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setContractDialog(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar contrato?")) deleteContract.mutate(c.id, { onSuccess: () => toast.success("Eliminado") }); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
            <Button size="sm" onClick={() => setSlaDialog({ client_id: clientId, priority_level: "Alta", case_type: "all", response_time_hours: 4, resolution_time_hours: 24, business_hours_only: true, is_active: true })}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo SLA
            </Button>
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
                      <TableCell className="text-xs">{s.penalty_amount ? `$${s.penalty_amount}` : "—"}</TableCell>
                      <TableCell>
                        {s.is_active ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Activo</Badge> : <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSlaDialog(s)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar SLA?")) deleteSLA.mutate(s.id, { onSuccess: () => toast.success("Eliminado") }); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
    </div>
  );
}
