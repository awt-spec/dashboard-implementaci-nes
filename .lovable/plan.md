
The user wants to improve team dashboards, especially focused on time tracking ("registrar horas"). Let me explore current state of team dashboards and time tracking.

Already exists:
- `useActivityTracker.tsx` with `useWorkTimer` hook (start/stop timers, work_time_entries table)
- `TeamScrumDashboard` with Auditoría tab
- `TeamAnalytics.tsx` (Phase 4 - team health)
- `ColaboradorDashboard.tsx` (personal view with sprint+timer)
- `MemberProfile.tsx` (360° profile)

Gaps for "mejorar dashboards + registrar horas":
1. No dedicated **Time Tracking** dashboard with weekly timesheet view
2. No way to **manually log hours** (only auto-timer)
3. No **billable vs non-billable** classification
4. No **per-client / per-project hours** breakdown
5. Personal dashboard lacks weekly summary, goals, today's focus
6. Team dashboard lacks consolidated time view (who's logging, who's not)
7. No timesheet approval workflow
8. No export of hours for billing

Plan focused on time tracking + dashboard overhaul.
