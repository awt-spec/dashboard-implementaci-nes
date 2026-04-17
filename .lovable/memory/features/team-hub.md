---
name: SYSDE Team Hub (sprints + profiles + directory)
description: Comprehensive team management with sprints (ceremonies, AI forecast), 360 profiles (career path AI, capacity), directory (cards, skill matrix heatmap, AI recommender, onboarding tracker)
type: feature
---
**Phase 1 - Sprints** (TeamScrumDashboard tabs):
- SprintManager.tsx: CRUD sprints, drag-and-drop planning from WSJF backlog, capacity tracking
- DailyStandupPanel.tsx: digital daily check-ins (yesterday/today/blockers + mood)
- SprintAnalytics.tsx: avg velocity, predictability, weekly throughput, CFD chart
- SprintReviewDialog.tsx + SprintRetroDialog.tsx: ceremony wizards
- forecast-sprint edge function: AI predicts backlog completion using historical velocity
- Tables: sprint_dailies, sprint_retrospectives, sprint_reviews; support_sprints + ceremony_dates/notes

**Phase 2 - Profiles** (/team/:memberId):
- MemberProfile.tsx: 360 view with overview, performance KPIs, skill radar, career path tab, capacity tab
- analyze-career-path edge function: Gemini 2.5 Flash returns skills_gap, recommended_certifications, roadmap
- Tables: team_member_capacity (weekly_hours, OOO), team_member_certifications, team_career_paths
- useMemberProfile.ts hook consolidates all profile data

**Phase 3 - Team Hub** (AdminUsers tab "Equipo SYSDE" → TeamHub.tsx with sub-tabs):
- TeamDirectoryCards.tsx: visual card grid with search/dept/skill filters, top-4 skills bar visualization, links to /team/:id
- SkillMatrix.tsx: heatmap matrix (level 0-5 = muted→red→amber→lime→emerald), click cell to cycle level, top skills KPIs
- OnboardingTracker.tsx: 8-step default checklist, buddy assignment, progress per member
- TeamRecommenderDialog.tsx: AI picks best N candidates per project (client_id or brief), returns match_score/strengths/gaps/role/justification + missing_skills + hiring_recommendations
- recommend-team-for-client edge function: Gemini 2.5 Flash with tool_call structured output
- Tables: team_member_skills (member_id, skill_name UNIQUE, category, level 1-5, certified), team_onboarding (member_id UNIQUE, checklist jsonb, progress_pct, buddy_member_id)

Old SysdeTeamManager kept in "Administrar" sub-tab for raw CRUD + access creation.
