import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRightLeft, Settings, History, Link2, CheckCircle2,
  XCircle, Loader2, RefreshCw, AlertTriangle, ExternalLink, Plug
} from "lucide-react";
import { toast } from "sonner";
import {
  useDevOpsConnection, useDevOpsSyncLogs, useDevOpsMappings,
  useSaveDevOpsConnection, useTriggerSync, useTestDevOpsConnection,
} from "@/hooks/useDevOps";

const DEFAULT_STATE_MAP: Record<string, string> = {
  "EN ATENCIÓN": "Active",
  "PENDIENTE": "New",
  "ENTREGADA": "Resolved",
  "CERRADA": "Closed",
  "ANULADA": "Removed",
  "POR CERRAR": "Resolved",
  "COTIZADA": "New",
  "APROBADA": "Active",
  "ON HOLD": "New",
  "VALORACIÓN": "New",
};

const DEFAULT_PRIO_MAP: Record<string, string> = {
  "Critica, Impacto Negocio": "1",
  "Alta": "1",
  "Media": "2",
  "Baja": "3",
};

interface DevOpsPanelProps {
  clientId: string;
  clientName?: string;
}

export function DevOpsPanel({ clientId, clientName }: DevOpsPanelProps) {
  const { data: connection, isLoading } = useDevOpsConnection(clientId);
  const { data: logs = [] } = useDevOpsSyncLogs(clientId);
  const { data: mappings = [] } = useDevOpsMappings(clientId);
  const saveConn = useSaveDevOpsConnection();
  const triggerSync = useTriggerSync();
  const testConn = useTestDevOpsConnection();

  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [team, setTeam] = useState("");
  const [workItemType, setWorkItemType] = useState("Task");
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState(15);
  const [stateMap, setStateMap] = useState<Record<string, string>>(DEFAULT_STATE_MAP);
  const [prioMap, setPrioMap] = useState<Record<string, string>>(DEFAULT_PRIO_MAP);
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing connection
  if (connection && !initialized) {
    setOrg(connection.organization);
    setProject(connection.project);
    setTeam(connection.team || "");
    setWorkItemType(connection.default_work_item_type);
    setAutoSync(connection.auto_sync);
    setSyncInterval(connection.sync_interval_minutes);
    if (Object.keys(connection.state_mapping).length > 0) setStateMap(connection.state_mapping);
    if (Object.keys(connection.priority_mapping).length > 0) setPrioMap(connection.priority_mapping);
    setInitialized(true);
  }

  const handleSave = async () => {
    if (!org || !project) {
      toast.error("Organización y proyecto son requeridos");
      return;
    }
    try {
      await saveConn.mutateAsync({
        client_id: clientId,
        organization: org,
        project,
        team: team || null,
        default_work_item_type: workItemType,
        auto_sync: autoSync,
        sync_interval_minutes: syncInterval,
        state_mapping: stateMap,
        priority_mapping: prioMap,
        is_active: true,
      });
      toast.success("Conexión guardada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTest = async () => {
    try {
      const result = await testConn.mutateAsync(clientId);
      toast.success(`Conexión exitosa al proyecto: ${result.project}`);
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    }
  };

  const handleSync = async (direction: string) => {
    try {
      const result = await triggerSync.mutateAsync({ clientId, direction });
      const msg = `Sync ${result.status}: ${result.items_pulled || 0} importados, ${result.items_pushed || 0} exportados`;
      if (result.status === "error") toast.error(msg);
      else if (result.status === "partial") toast.warning(msg);
      else toast.success(msg);
    } catch (e: any) {
      toast.error(`Error de sincronización: ${e.message}`);
    }
  };

  const ticketMappings = mappings.filter(m => m.entity_type === "ticket");
  const sprintMappings = mappings.filter(m => m.entity_type === "sprint");

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            Azure DevOps — {clientName || clientId}
          </h3>
          <p className="text-sm text-muted-foreground">Sincronización bidireccional de casos y sprints</p>
        </div>
        {connection && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testConn.isPending}>
              {testConn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Probar
            </Button>
            <Button size="sm" onClick={() => handleSync("bidirectional")} disabled={triggerSync.isPending}>
              {triggerSync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar
            </Button>
          </div>
        )}
      </div>

      {!connection && (
        <Card className="border-dashed border-2 border-primary/30">
          <CardContent className="py-8 text-center">
            <Plug className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No hay conexión configurada para este cliente</p>
            <p className="text-xs text-muted-foreground">Configura la organización y proyecto de Azure DevOps abajo</p>
          </CardContent>
        </Card>
      )}

      {connection?.last_sync_at && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          Última sincronización: {new Date(connection.last_sync_at).toLocaleString()}
          <span className="ml-2">•</span>
          <Badge variant="outline" className="text-xs">{ticketMappings.length} tickets mapeados</Badge>
          <Badge variant="outline" className="text-xs">{sprintMappings.length} sprints mapeados</Badge>
        </div>
      )}

      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config"><Settings className="h-3.5 w-3.5 mr-1" />Configuración</TabsTrigger>
          <TabsTrigger value="mappings"><Link2 className="h-3.5 w-3.5 mr-1" />Mapeos ({mappings.length})</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" />Historial ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 mt-3">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Conexión Azure DevOps</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Organización *</Label>
                  <Input placeholder="mi-organizacion" value={org} onChange={e => setOrg(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Proyecto *</Label>
                  <Input placeholder="mi-proyecto" value={project} onChange={e => setProject(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Equipo (opcional)</Label>
                  <Input placeholder="mi-equipo" value={team} onChange={e => setTeam(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Tipo Work Item</Label>
                  <Select value={workItemType} onValueChange={setWorkItemType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Task">Task</SelectItem>
                      <SelectItem value="Bug">Bug</SelectItem>
                      <SelectItem value="User Story">User Story</SelectItem>
                      <SelectItem value="Product Backlog Item">Product Backlog Item</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <Switch checked={autoSync} onCheckedChange={setAutoSync} />
                  <Label className="text-xs">Auto-sync</Label>
                </div>
                {autoSync && (
                  <div>
                    <Label className="text-xs">Intervalo (min)</Label>
                    <Input type="number" min={5} value={syncInterval} onChange={e => setSyncInterval(Number(e.target.value))} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs">Mapeo de Estados</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stateMap).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate font-medium">{key}</span>
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Input
                      className="h-7 text-xs"
                      value={val}
                      onChange={e => setStateMap(p => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs">Mapeo de Prioridades</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(prioMap).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-40 truncate font-medium">{key}</span>
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Input
                      className="h-7 text-xs"
                      value={val}
                      onChange={e => setPrioMap(p => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={handleSave} disabled={saveConn.isPending}>
              {saveConn.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Guardar Configuración
            </Button>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-amber-400 mb-1">Llave PAT pendiente</p>
                  <p>La sincronización requiere un Personal Access Token de Azure DevOps con permisos de lectura/escritura en Work Items e Iterations. Será configurado próximamente.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Entidades Mapeadas ({mappings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hay mapeos aún. Ejecuta una sincronización para crear los primeros.</p>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {mappings.map(m => (
                    <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{m.entity_type}</Badge>
                        <span className="font-mono text-muted-foreground">{m.local_id.slice(0, 8)}…</span>
                        <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">DevOps #{m.devops_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.last_direction === "push" ? "default" : "secondary"} className="text-[10px]">
                          {m.last_direction === "push" ? "→ Push" : "← Pull"}
                        </Badge>
                        <span className="text-muted-foreground">{new Date(m.last_synced_at).toLocaleDateString()}</span>
                        {m.devops_url && (
                          <a href={m.devops_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 text-primary" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Historial de Sincronización
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin historial de sincronización.</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-auto">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/20 text-xs">
                      <div className="flex items-center gap-2">
                        {log.status === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        {log.status === "partial" && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        {log.status === "error" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                        <Badge variant="outline" className="text-[10px]">{log.direction}</Badge>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400">↓{log.items_pulled}</span>
                        <span className="text-blue-400">↑{log.items_pushed}</span>
                        {log.items_failed > 0 && <span className="text-red-400">✕{log.items_failed}</span>}
                        <span className="text-muted-foreground">{log.duration_ms}ms</span>
                        <Badge variant="outline" className="text-[10px]">{log.triggered_by}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {connection && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Acciones de sincronización manual</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleSync("pull")} disabled={triggerSync.isPending}>
                  ↓ Solo Importar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleSync("push")} disabled={triggerSync.isPending}>
                  ↑ Solo Exportar
                </Button>
                <Button size="sm" onClick={() => handleSync("bidirectional")} disabled={triggerSync.isPending}>
                  {triggerSync.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRightLeft className="h-4 w-4 mr-1" />}
                  Bidireccional
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
