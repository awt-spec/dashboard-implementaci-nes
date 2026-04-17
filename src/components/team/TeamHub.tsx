import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Users, Grid3x3, Rocket, Settings, Trophy, Plane, GraduationCap, Activity } from "lucide-react";
import { TeamDirectoryCards } from "@/components/team/TeamDirectoryCards";
import { SkillMatrix } from "@/components/team/SkillMatrix";
import { OnboardingTracker } from "@/components/team/OnboardingTracker";
import { TeamRecommenderDialog } from "@/components/team/TeamRecommenderDialog";
import { SysdeTeamManager } from "@/components/support/SysdeTeamManager";
import { RecognitionWall } from "@/components/team/RecognitionWall";
import { TimeOffCalendar } from "@/components/team/TimeOffCalendar";
import { LearningHub } from "@/components/team/LearningHub";
import { TeamAnalytics } from "@/components/team/TeamAnalytics";
import { CompareCollaboratorsDialog } from "@/components/team/CompareCollaboratorsDialog";

export function TeamHub() {
  const [recommenderOpen, setRecommenderOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Equipo SYSDE</h2>
          <p className="text-xs text-muted-foreground">Directorio, métricas, habilidades, onboarding y desarrollo del talento</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Activity className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="directory" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <LayoutGrid className="h-3.5 w-3.5" /> Directorio
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Grid3x3 className="h-3.5 w-3.5" /> Skill Matrix
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Rocket className="h-3.5 w-3.5" /> Onboarding
          </TabsTrigger>
          <TabsTrigger value="recognition" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Trophy className="h-3.5 w-3.5" /> Reconocimientos
          </TabsTrigger>
          <TabsTrigger value="timeoff" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Plane className="h-3.5 w-3.5" /> Time-off
          </TabsTrigger>
          <TabsTrigger value="learning" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <GraduationCap className="h-3.5 w-3.5" /> Learning
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-2 data-[state=active]:shadow-sm py-2 px-3">
            <Settings className="h-3.5 w-3.5" /> Administrar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <TeamAnalytics />
        </TabsContent>
        <TabsContent value="directory" className="mt-4">
          <TeamDirectoryCards onCompare={() => setRecommenderOpen(true)} onCompareMulti={() => setCompareOpen(true)} />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillMatrix />
        </TabsContent>
        <TabsContent value="onboarding" className="mt-4">
          <OnboardingTracker />
        </TabsContent>
        <TabsContent value="recognition" className="mt-4">
          <RecognitionWall />
        </TabsContent>
        <TabsContent value="timeoff" className="mt-4">
          <TimeOffCalendar />
        </TabsContent>
        <TabsContent value="learning" className="mt-4">
          <LearningHub />
        </TabsContent>
        <TabsContent value="manage" className="mt-4">
          <SysdeTeamManager />
        </TabsContent>
      </Tabs>

      <TeamRecommenderDialog open={recommenderOpen} onOpenChange={setRecommenderOpen} />
      <CompareCollaboratorsDialog open={compareOpen} onOpenChange={setCompareOpen} />
    </div>
  );
}
