import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, BookOpen, ListChecks, Building2, Sparkles } from "lucide-react";
import { ActivePolicyPanel } from "./ActivePolicyPanel";
import { BusinessRulesPanel } from "./BusinessRulesPanel";
import { ClientOverridesPanel } from "./ClientOverridesPanel";
import { AIStrategyPanel } from "./AIStrategyPanel";

export function ConfigurationHub() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-bold">Configuración</h2>
          <p className="text-xs text-muted-foreground">Política de Cierre v4.5 · Reglas de negocio · IA</p>
        </div>
      </div>

      <Tabs defaultValue="policy" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="policy"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Política activa</TabsTrigger>
          <TabsTrigger value="rules"><ListChecks className="h-3.5 w-3.5 mr-1.5" />Reglas</TabsTrigger>
          <TabsTrigger value="overrides"><Building2 className="h-3.5 w-3.5 mr-1.5" />Por cliente</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1.5" />IA & Estrategia</TabsTrigger>
        </TabsList>
        <TabsContent value="policy" className="mt-4"><ActivePolicyPanel /></TabsContent>
        <TabsContent value="rules" className="mt-4"><BusinessRulesPanel /></TabsContent>
        <TabsContent value="overrides" className="mt-4"><ClientOverridesPanel /></TabsContent>
        <TabsContent value="ai" className="mt-4"><AIStrategyPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
