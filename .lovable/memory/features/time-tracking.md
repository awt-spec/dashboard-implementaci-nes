---
name: Time Tracking & Productivity Dashboards
description: Hours registration with employment-type aware UX (hourly vs salaried), timesheet, weekly goals, billable tracking, approval workflow, audit, and team workload analytics
type: feature
---
Time tracking infrastructure: `work_time_entries` (description, is_billable, is_manual, approval_status, tags, work_date, category, mood, productivity_score, is_locked) + `time_tracking_goals` (per-user weekly_target_hours, billable_target_pct) + `time_entry_audit_log` (trigger-driven) + `time_weekly_locks`.

**Employment types** (in `sysde_team_members`): `employment_type` ('hourly' | 'salaried', default salaried), `hourly_rate` numeric, `rate_currency` (USD default). Surfaced via `useMyTeamMember`.

Hooks in `useTimeTracking.ts`: useMyTimeEntries, useAllTimeEntries (admin/PM), useMyTimeGoal, useUpsertTimeGoal, useCreateManualEntry, useUpdateTimeEntry, useDeleteTimeEntry. Helpers: startOfWeek, formatHours, entryHours.

Components:
- `ManualTimeEntryDialog` — redesigned: gradient header with employment-type badge (hourly=amber/salaried=emerald), quick-hour pills (15m/30m/1h/2h/4h/8h), category chips with colored icons, today/yesterday quick date, searchable client + task/ticket combobox (via Command palette filtered by assigned_user_id and active status), live billable amount preview (rate × hours) shown only for hourly, weekly impact bar vs target. The `Facturable` toggle is hidden for salaried employees and forced false.
- `MyProductivityDashboard` — personal KPIs, 14-day stacked bar, per-client breakdown, embedded TimesheetView.
- `TimesheetView` — weekly grid 7-day, per-day total bars vs 8h target.
- `TimeTrackingDashboard` — admin view: KPIs, byMember chart, billable pie, member×day heatmap, recent entries with approval, CSV export.
- `TimeAuditPanel` (admin) — anomaly detection (overlaps, >12h, <5min), utilization charts, audit log, weekly locks.
- `TeamWorkloadDashboard` — bands: sobrecargado >45h / saludable 30-45h / subutilizado <30h.
- `TimeTrackingHub` (collaborator) — QuickTimer + AITimeCapture (NLP via parse-time-entry edge fn) + DailyCalendarView.

RLS: users CRUD their own entries; admin/PM SELECT + UPDATE all; locked entries blocked by trigger except admin/PM.
