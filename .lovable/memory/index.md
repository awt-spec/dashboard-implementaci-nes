# Project Memory

## Core
Platform is "Sysde Support" (formerly Sysde PMO). Focus on Implementations Management.
RBAC: admin, pm, gerente (client portal).
Supabase SSOT. Scoped by client ID. Use `.maybeSingle()`. Mutations use `null` (not `undefined`).
"Progreso" (not "En Progreso"). Strict commercial terminology in Client Portal.
Direct slide interaction blocked; use side panel to edit.
Task state/priority editable only via dialog, not directly on table.
Unified Scrum: tasks + support_tickets share sprint_id, story_points, business_value, effort, scrum_status. WSJF = value/effort.
Sidebar item "Tareas Global" replaced by "Equipo Scrum" (TeamScrumDashboard).
TanStack Query global defaults: staleTime 5min, gcTime 10min — set in App.tsx, do not duplicate per-hook.
AI edge functions use AbortSignal.timeout(30000) on Gemini fetch.

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
- [Performance](mem://technical/performance) — Query cache defaults, useClients active-only filter, AI fetch 30s timeout
- [Team Scrum](mem://features/team-scrum) — Unified backlog (tasks+tickets), WSJF, Kanban, IA bottlenecks, burndown/velocity
- [Time Tracking](mem://features/time-tracking) — Hours registration, weekly timesheet, billable, approvals, workload bands
- [Política Cierre v4.5](mem://features/policy-rules) — business_rules + case_compliance + ConfigurationHub (⚙️) + IA (recommend/notice/validate) + sync sprint
