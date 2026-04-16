---
name: Team Scrum & Activity Tracking
description: Colaborador dashboard with sprint+backlog+timer; admin tracking panels in TeamScrumDashboard and AdminUsers
type: feature
---
Colaborador role sees "Mi Sprint actual + Backlog WSJF + Minutas" with per-item timer and scrum status moves.
Tracking tables: user_sessions (login + heartbeat 60s + ended_at), work_time_entries (timer per task/ticket), user_activity_log (login, timer_start/stop, move_item, pull_to_sprint).
useActivityTracker hook mounted in Index.tsx auto-tracks sessions for all logged-in users.
TeamActivityPanel component shown in 2 places: TeamScrumDashboard "Equipo" tab (compact, only colaboradores) and AdminUsers "Actividad" tab (full with activity log + admins/pms).
Online = last_heartbeat < 5 min ago. Tracking RLS: users see own data; admin/pm see all.
