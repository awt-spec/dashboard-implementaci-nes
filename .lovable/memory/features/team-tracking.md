---
name: Team Scrum & Activity Tracking
description: Colaborador dashboard with sprint+backlog+timer; admin tracking + workload bands in TeamScrumDashboard (tab "Auditoría") and AdminUsers (tab "Actividad")
type: feature
---
Colaborador role sees "Mi Sprint actual + Backlog WSJF + Minutas" with per-item timer and scrum status moves.
Tracking tables: user_sessions (login + heartbeat 60s + ended_at), work_time_entries (timer per task/ticket), user_activity_log (login, timer_start/stop, move_item, pull_to_sprint).
useActivityTracker hook mounted in Index.tsx auto-tracks sessions for all logged-in users.
TeamActivityPanel shown in: TeamScrumDashboard tab "Auditoría" (full panel) and AdminUsers tab "Actividad". Old "Equipo" compact tab in TeamScrumDashboard removed (was duplicated).
Online = last_heartbeat < 5 min ago. Tracking RLS: users see own data; admin/pm see all.

Workload analysis (TeamScrumDashboard):
- Bands: sobrecargado >7 items, saludable 3-7, subutilizado 1-2, sin_carga 0 active items.
- "Análisis Equipo" tab AI returns workload[], underutilized[], team_balance_score 0-100, plus bottlenecks/risks/recommendations. Edge function: analyze-team-scrum.
- "Reportes" tab shows workload summary (4 KPI cards), list of "sin carga" members, and Carga por Persona bar chart colored by band (red/green/amber).
