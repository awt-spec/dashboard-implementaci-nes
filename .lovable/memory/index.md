# Memory: index.md
Updated: now

# Project Memory

## Core
Platform is "Sysde Support" (formerly Sysde PMO). Focus on Implementations Management.
RBAC: admin, pm, gerente (client portal), colaborador (sysde team member).
Supabase SSOT. Scoped by client ID. Use `.maybeSingle()`. Mutations use `null` (not `undefined`).
"Progreso" (not "En Progreso"). Strict commercial terminology in Client Portal.
Direct slide interaction blocked; use side panel to edit.
Task state/priority editable only via dialog, not directly on table.
Unified Scrum: tasks + support_tickets share sprint_id, story_points, business_value, effort, scrum_status. WSJF = value/effort.
Sidebar item "Tareas Global" replaced by "Equipo Scrum" (TeamScrumDashboard).
Activity tracking auto-mounted in Index.tsx via useActivityTracker (sessions+heartbeat+activity log).

## Memories
- [Auth & Sessions](mem://features/auth) — RBAC, session persistence rules, resilient login, demo accounts
- [Presentations](mem://features/presentations) — Slide structures, Executive Presentation, PDF export
- [Slide Editor](mem://features/slide-editor) — Canva-style table editor, blocked direct interaction
- [Tasks & Management](mem://features/tasks) — Internal/External visibility, subtasks, dependencies, deliverables, risks vs obstacles
- [Clients & Portal](mem://features/clients) — Client creation, team roles, custom portal for 'gerente', custom charts
- [Communications](mem://features/communications) — Threads linked to tasks, auto-notifications
- [Minutes](mem://features/minutes) — AI wizard for creation, admin-controlled client visibility
- [Design & UI](mem://design/ui) — Full-width dashboard, Sysde branding, charts (Recharts)
- [Technical Setup](mem://technical/architecture) — Supabase database specifics, admin user management
- [Team Scrum](mem://features/team-scrum) — Unified backlog (tasks+tickets), WSJF, Kanban, IA bottlenecks, burndown/velocity
- [Team Tracking](mem://features/team-tracking) — Colaborador dashboard scrum + sessions/timer/activity tracking + admin panels
- [Team Hub](mem://features/team-hub) — Sprints (ceremonies+forecast), 360 profiles (career path), directory cards + skill matrix heatmap + AI recommender + onboarding
- [Team Engagement](mem://features/team-engagement) — Phase 4: kudos+badges+leaderboard, time-off calendar+coverage alerts, learning hub+enrollments+Mentor IA
- [AI Agents](mem://features/ai-agents) — Personal role-based AI agent per member, weekly digest, FAB, profile tab, edge functions member-agent-chat/weekly-digest
