import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Users, Grid3x3, Rocket, Settings } from "lucide-react";
import { TeamDirectoryCards } from "@/components/team/TeamDirectoryCards";
import { SkillMatrix } from "@/components/team/SkillMatrix";
import { OnboardingTracker } from "@/components/team/OnboardingTracker";
import { TeamRecommenderDialog } from "@/components/team/TeamRecommenderDialog";
import { SysdeTeamManager } from "@/components/support/SysdeTeamManager";

export function TeamHub() {
  const [recommenderOpen, setRecommenderOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Equipo SYSDE</h2>
          <p className="text-xs text-muted-foreground">Directorio, habilidades, onboarding y administración del talento</p>
        </div>
      </div>

      <Tabs defaultValue="directory">
        <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="directory" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <LayoutGrid className="h-3.5 w-3.5" /> Directorio
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Grid3x3 className="h-3.5 w-3.5" /> Skill Matrix
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Rocket className="h-3.5 w-3.5" /> Onboarding
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Settings className="h-3.5 w-3.5" /> Administrar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-4">
          <TeamDirectoryCards onCompare={() => setRecommenderOpen(true)} />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillMatrix />
        </TabsContent>
        <TabsContent value="onboarding" className="mt-4">
          <OnboardingTracker />
        </TabsContent>
        <TabsContent value="manage" className="mt-4">
          <SysdeTeamManager />
        </TabsContent>
      </Tabs>

      <TeamRecommenderDialog open={recommenderOpen} onOpenChange={setRecommenderOpen} />
    </div>
  );
}
