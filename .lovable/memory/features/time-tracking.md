---
name: Time Tracking & Productivity Dashboards
description: Hours registration system with timesheet, weekly goals, billable tracking, approval workflow, and team workload analytics
type: feature
---
Time tracking infrastructure built on `work_time_entries` (extended: description, is_billable, is_manual, approval_status pending/approved/rejected, tags, work_date) + `time_tracking_goals` (per-user weekly_target_hours, billable_target_pct).

Hooks in `useTimeTracking.ts`: useMyTimeEntries, useAllTimeEntries (admin/PM), useMyTimeGoal, useUpsertTimeGoal, useCreateManualEntry, useUpdateTimeEntry, useDeleteTimeEntry. Helpers: startOfWeek, formatHours, entryHours.

Components:
- `MyProductivityDashboard` — personal KPIs (hoy/semana/facturable/meta), 14-day stacked bar chart, per-client breakdown, embedded TimesheetView. Used in MemberProfile "Mis horas" tab (visible only when isMe).
- `TimesheetView` — weekly grid 7-day, per-day total bars vs 8h target, edit weeks via prev/next.
- `ManualTimeEntryDialog` — date/hours/client/source/item_id/description/billable. Mounted in ColaboradorDashboard sidebar via "Registrar horas" button.
- `TimeTrackingDashboard` — admin view in TeamHub "Horas Equipo" tab: KPIs, byMember stacked chart, billable pie, member×day heatmap, recent entries list with inline approval, CSV export.
- `TeamWorkloadDashboard` — TeamHub "Carga" tab: bands sobrecargado >45h / saludable 30-45h / subutilizado <30h / sin_carga 0h vs 40h weekly target.

RLS: users CRUD their own entries; admin/PM SELECT + UPDATE all (for approval workflow).
