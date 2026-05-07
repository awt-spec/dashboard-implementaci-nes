# SVA ERP V1 — Documentación Técnica Integral (Levantamiento Original)

> **📚 Documento histórico — preservado tal como fue generado el 2026-04-30**
>
> Este archivo es el **levantamiento técnico original** que solicitó la COO María
> Fernanda para onboarding y para tener la "fotografía" de la plataforma en ese
> momento. **No se actualiza** — es un snapshot histórico.
>
> **Para la versión viva y mantenida** del documento técnico, ver
> [`ARCHITECTURE.md`](../ARCHITECTURE.md) en la raíz del repo.
>
> **Diferencias clave con `ARCHITECTURE.md` (2026-05-04):**
> - Este plan citaba **Anthropic Claude** como proveedor de IA. Verificación
>   posterior demostró que el endpoint productivo es **Google Gemini** vía
>   OpenAI-compat (ver `supabase/functions/_shared/cors.ts:48-49`). El nombre
>   `anthropicTool` que sobrevive en el helper es engaño visual — usa Gemini.
> - Conteos de filas y métricas reflejan estado al 2026-04-30. Para QA actual
>   correr `scripts/qa-database.mjs`.
> - Los "Próximos pasos" de §9 ya se ejecutaron parcialmente en la auditoría
>   2026-05-03/04 (ítems #1-4 de la checklist: RLS strict, bun update, lazy
>   routes, noUnusedLocals).

---

## Context

**SVA ERP** es la plataforma interna de SYSDE Internacional para gestión de:
1. **Soporte de clientes** (boletas/tickets, SLA, reincidencias, minutas)
2. **Implementación de proyectos** (sprints, backlog, scrum, time tracking)
3. **Gestión ejecutiva** (CEO/PM dashboards, IA assistants, reportes compartidos)

Este documento es el levantamiento técnico completo: arquitectura, frontend, backend, BD, integraciones, lo aplicado, lo probado y lo que falta. Sirve como onboarding técnico para el COO (María Fernanda) y para futuros desarrolladores.

**Estado actual (30/04/2026):** Sistema en producción en `qorixnxlaiuyxoentrfa.supabase.co`. ~30 clientes, ~150 tickets soporte vivos + 2099 tasks de implementación, 122 sprints, 30 colaboradores. Health score QA ≥92/100.

---

## 1. Diagramas de Arquitectura

### 1.1 Stack overview

```
┌──────────────────────── BROWSER (Cliente) ────────────────────────┐
│                                                                    │
│  React 18 + Vite + TypeScript + Tailwind + Radix + shadcn-ui      │
│  TanStack Query (cache 5min) · React Router · Recharts · Framer    │
│  React Hook Form + Zod · jsPDF · Sonner · Lucide                   │
│                                                                    │
└────────────────────────┬───────────────────────────────────────────┘
                         │ HTTPS (REST + Realtime)
┌────────────────────────▼───────────────────────────────────────────┐
│                    SUPABASE (qorixnxlaiuyxoentrfa)                 │
│                                                                    │
│  ┌───────────────┐ ┌──────────────┐ ┌────────────────────────┐    │
│  │ PostgreSQL 15 │ │ Auth (GoTrue)│ │ Edge Functions (Deno)  │    │
│  │  · 95+ migr.  │ │  · 7 roles   │ │  · 30 functions        │    │
│  │  · RLS strict │ │  · JWT       │ │  · CORS + auth helper  │    │
│  │  · Triggers   │ │  · profiles  │ │                        │    │
│  └───────────────┘ └──────────────┘ └────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Storage: 5 buckets (attachments, avatars, CVs, media)      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────┬─────────────┬─────────────┬───────────────┬───────────────┘
         │             │             │               │
   ┌─────▼────┐  ┌─────▼────┐  ┌─────▼─────┐  ┌──────▼────────┐
   │ Slack    │  │ Resend   │  │ Anthropic │  │ Azure DevOps  │
   │ Webhook  │  │ Email    │  │ Claude AI │  │ (sync-devops) │
   └──────────┘  └──────────┘  └───────────┘  └───────────────┘
```

> ⚠️ Corrección post-2026-05-04: la nube etiquetada "Anthropic Claude AI"
> realmente es **Google Gemini** (ver `_shared/cors.ts:48-49`). El plan
> original citó mal el proveedor.

### 1.2 Routing por rol (matriz)

```
┌──────────────────┬─────────────────────────────────────────────────────┐
│ Role             │ Landing & vistas accesibles                         │
├──────────────────┼─────────────────────────────────────────────────────┤
│ ceo              │ CEODashboard (read-only super-admin)                │
│ admin            │ ExecutiveOverview → todas las secciones             │
│ pm               │ ExecutiveOverview (mismo que admin sin user mgmt)   │
│ gerente_soporte  │ AUTO-redirect a "soporte" (SupportDashboard)        │
│ gerente          │ GerenteSupportDashboard | GerenteMobileDashboard    │
│                  │ (1 cliente asignado, sin sidebar)                   │
│ colaborador      │ ColaboradorDashboard standalone (Jira-style)        │
│ cliente          │ ClientPortalDashboard (empresa scoped, portal       │
│                  │  con horas, minutas, casos del cliente)             │
└──────────────────┴─────────────────────────────────────────────────────┘
```

### 1.3 Modelo de datos (relaciones clave)

```
clients (id text PK, client_type: soporte|implementacion)
   │
   ├─→ support_tickets (client_id, ticket_id) UNIQUE     [cara cliente: SOPORTE]
   │      │
   │      ├─→ support_ticket_reopens (ticket_id, iteration_number)
   │      ├─→ support_ticket_subtasks (ticket_id)
   │      ├─→ support_ticket_notes (ticket_id, visibility)
   │      ├─→ ticket_access_log (ticket_id, action, metadata)
   │      └─→ shared_ticket_history (ticket_id, public_token)
   │
   ├─→ tasks (client_id, original_id) UNIQUE             [cara interna: IMPLEMENTACIÓN]
   │      ├─→ task_subtasks (task_id)
   │      └─→ task_dependencies (task_id, depends_on)
   │
   ├─→ support_sprints (client_id) — 14 días default
   │      ↑─referenced by tasks.sprint_id + support_tickets.sprint_id
   │
   ├─→ phases, deliverables, action_items, meeting_minutes,
   │    risks, comments, email_notifications, client_users
   │
   ├─→ business_rules (scope: global|client|case_type)
   ├─→ client_rule_overrides (SLA por cliente)
   ├─→ gerente_client_assignments (user_id ↔ client_id)
   └─→ cliente_company_assignments (user_id ↔ client_id, permission_level)

auth.users (Supabase managed)
   │
   ├─→ profiles (user_id, full_name, email, avatar_url)
   ├─→ user_roles (user_id, role) — múltiples → has_role() resuelve por prioridad
   └─→ sysde_team_members (linked optionally via user_id)
```

### 1.4 Sprint / Backlog flow

```
        ┌──────────┐
        │ Backlog  │  Items sin sprint o en sprint no-activo
        │ (no done)│  + scrum_status != "done"
        └────┬─────┘
             │ assign to sprint
             ▼
        ┌──────────┐
        │  Ready   │  Listo para tomar
        └────┬─────┘
             │ start work
             ▼
        ┌──────────┐
        │   In     │  → kanban ActiveSprintHub
        │ Progress │
        └────┬─────┘
             │ commit
             ▼
        ┌──────────┐
        │   In     │  En sprint asignado
        │  Sprint  │
        └────┬─────┘
             │ complete
             ▼
        ┌──────────┐
        │   Done   │  → contribuye a velocity histórica
        └──────────┘
```

### 1.5 Roles & jerarquía de prioridad

```
ROLE_PRIORITY (más alto = más permisos):
  6 ceo              → read-only TODA la BD via has_role
  5 admin            → CRUD completo, manage-users
  4 pm               → CRUD proyectos/tickets, no users
  3.5 gerente_soporte → ops soporte, edita reincidencias
  3 gerente          → ve 1 cliente asignado
  2 colaborador      → solo sus tasks (assigned_user_id o owner match)
  1 cliente          → portal de su empresa, no admin internals

useAuth() resuelve:
  user_roles WHERE user_id = auth.uid()
  → toma el de MAYOR prioridad
  → si role=cliente, busca cliente_company_assignments
```

---

## 2. Frontend

### 2.1 Stack

**Path:** `/Users/awt/Downloads/sva-erp-deploy/`

| Paquete | Versión | Uso |
|---|---|---|
| react / react-dom | 18.3.1 | UI |
| vite | 5.4.19 (SWC) | Bundler · puerto 8080 · HMR off |
| typescript | 5.8.3 | Tipos (laxos: noImplicitAny=false) |
| tailwindcss | 3.4.17 | Styling + custom HSL vars (sidebar/success/warning/info) |
| @radix-ui/react-* | 1.1–2.2 | Headless UI (dialog, dropdown, tabs, etc.) |
| @tanstack/react-query | 5.83.0 | Cache 5min · refetch-on-focus OFF · retry 1× |
| @supabase/supabase-js | 2.98.0 | Cliente backend |
| react-router-dom | 6.30.1 | Routing |
| recharts | 2.15.4 | Charts (velocity, burndown, CFD) |
| framer-motion | 12.35.1 | Animations (page transitions, sheet drawers) |
| react-hook-form + zod | 7.61.1 / 3.25.76 | Validación forms |
| jspdf + html2canvas | 4.2.0 / 1.4.1 | Export PDF (minutas, reportes) |
| sonner | 1.7.4 | Toast notifications |
| lucide-react | 0.462.0 | 1500+ icons |
| react-grid-layout | 2.2.3 | Dashboard composer |

**Alias `@/`** → `./src/` (tsconfig + vite.config).

### 2.2 Routing top-level

**Entry:** `src/App.tsx` (AuthGate + Router) → `src/pages/Index.tsx` (dispatch por rol)

**Pages** (`src/pages/`):
- `Index.tsx` — hub principal con switch de rol
- `Login.tsx` — auth + quick-access buttons
- `ColaboradorDashboard.tsx` — fullscreen Jira-style
- `TeamScrumDashboard.tsx` — sprints + backlog + analytics
- `TasksDashboard.tsx` — tareas unificadas
- `AdminUsers.tsx` — gestión users
- `MemberProfile.tsx` — perfil team member
- `Report.tsx` — reportes avanzados
- `SharedPresentation.tsx`, `SharedSupportPresentation.tsx`, `SharedTicketHistory.tsx` — públicas via token

### 2.3 Módulos por carpeta

| Carpeta | Archivos | Componentes clave | Patrón |
|---|---|---|---|
| `dashboard/` | 19 | AppSidebar · ExecutiveOverview · CEODashboard · ClientPortalDashboard · ActionQueue · NotificationBell · GerenteMobileDashboard · GerenteSupportDashboard | Card+Chart+Tabs · pill global SLA en header |
| `support/` | 41 | SupportDashboard · TicketDetailSheet (6 tabs) · SupportInbox · SupportCaseTable · OverdueTicketsSheet · ReopensInsightsPanel · ReopenBadge · ReopenReasonDialog · TicketReopensTimeline · SLAByClientPanel · CaseStrategyPanel · NewTicketForm · TicketHistoryTimeline · TicketSLAExplanation | Sheet+Tabs+DataLoader · CustomEvent (`overdue:open`) · pull-based |
| `scrum/` | 17 | SprintBoard (5 columnas Kanban) · BacklogView · SprintManager · SprintPlanner · ActiveSprintHub · SprintAnalytics · SprintInsightsPanel · DailyStandupPanel · TeamWorkloadReport · QuickSprintInitializer | Kanban + Sprint lifecycle |
| `clients/` | 21 | ClientList · ClientDetail (10+ tabs) · CreateClientDialog · ContractsSLATab · ContactsTab · DeliverablesTab · MeetingMinutesTab · ActionItemsTab · RisksTab · FunnelTab · ClientSupportMinutasTab · MinutaPresentation · SharePresentationDialog | Detail view multi-tab |
| `colaborador/` | 12 | MondayGridDashboard · MiSprintCard · MiTablero · MiActividadFeed · FocusCard · EstaSemanaCalendar · TaskDetailSheet · AgenteIACompactCard · HeroBuenosDias | Card deck + activity feed + IA agent |
| `team/` | 31 | TimeTrackingDashboard · TimesheetView · DailyCalendarView · QuickTimer · MemberActivityTimeline · MemberAIAgentPanel · AITimeCapture · ManualTimeEntryDialog · TeamAnalytics · SkillMatrix · RecognitionWall · OnboardingTracker · LearningHub | Time tracking + insights |
| `tasks/` | 11 | TaskViewSwitcher (list/kanban/calendar) · TaskBoard · TaskDetailModal | Multi-view |
| `settings/` | 7 | ConfigurationHub · ActivePolicyPanel · AIStrategyPanel · BusinessRulesTab | Admin forms |
| `policy/` | 3 | ActivePolicyBar (display global v4.5) | Policy engine |

### 2.4 Hooks (38 totales en `src/hooks/`)

| Dominio | Hooks |
|---|---|
| **Auth & Core** | `useAuth` · `useActivityTracker` · `useAuthValidation` · `use-toast` · `use-mobile` |
| **Clients** | `useClients` · `useClientStrategy` · `useClientContracts` |
| **Support** | `useSupportTickets` · `useAllSupportTickets` · `useSupportClients` · `useSupportTicketDetails` · `useTicketReopens` · `useReopenTicket` · `useTicketsSLAStatus` · `useSLASummary` · `useCaseStrategy` · `useCaseCompliance` |
| **Scrum** | `useTeamScrum` · `useScrum` · `useSprintCeremonies` |
| **Team** | `useTeamMembers` (sysdeTeamMembers) · `useMyTeamMember` · `useMemberProfile` · `useMemberAgent` · `useTeamEngagement` · `useDevOps` |
| **Strategy & AI** | `usePolicyAI` · `useAIUsageLogs` · `usePMAnalysis` · `useSVAStrategy` · `usePresentationData` |
| **Rules & Notifications** | `useBusinessRules` · `useNotifications` · `useSavedViews` |
| **Tasks/Time** | `useTaskDetails` · `useColaboradorLayout` · `useWorkTimer` |

### 2.5 Features destacadas

**Sistema de Reincidencias / Inconformidades** (recién añadido):
- Tabla `support_ticket_reopens` con iteración numerada
- Trigger `detect_ticket_reopen()` BEFORE UPDATE detecta `ENTREGADA/APROBADA → activo`
- RPC `set_reopen_metadata(jsonb)` para pasar reason+type del front al trigger via session config
- UI: `ReopenBadge` (1ª/2ª warning/3ª destructive+pulse), `ReopenReasonDialog` (interceptor de cambio estado), `TicketReopensTimeline` (historial visual con edit por gerente_soporte/admin)
- View `support_reopens_summary` con tasa 90d (excluye `historico`)
- Edge function `notify-recurring-reopens` dispara Slack + client_notifications cuando ≥3 vueltas

**SLA jerárquico (Política v4.5 → Override Cliente)**:
- `business_rules` (scope global) define plazos por prioridad
- `client_rule_overrides` permite override por cliente
- `get_tickets_sla_status()` devuelve estado + `sla_source` (policy_v4.5 | client_override)
- UI: `SLAByClientPanel` muestra breakdown, `TicketSLAExplanation` explica por qué cada ticket tiene su etiqueta, pill global de "vencidos" en topbar

**Sprints + Backlog + Scrum** (post-import):
- 122 sprints (1 activo + ≥9 históricos por cada uno de los 6 clientes implementación)
- 5-column Kanban: Backlog → Listo → En Progreso → En Sprint → Hecho
- `BacklogView` con 4 vistas (Lista WSJF, Por cliente, Por responsable, Tabla)
- Click-through a `TicketDetailSheet` o `TaskDetailSheet` por `source`
- `SprintAnalytics` con velocity histórica, CFD, throughput, predictability
- `SprintForecast` (IA) recibe velocity_history + backlog_points

**Portal Cliente vs Vista Interna**:
- `ClientPortalDashboard` = scope estricto a su empresa (horas, minutas, casos visibles)
- `ClientDetail` = vista interna multi-tab con todo
- `canEditInternal=false` oculta `ReopenBadge`, tab Reincidencias, info confidencial
- Public shares con token: `SharedPresentation`, `SharedTicketHistory`

**Activity Tracker + Notifications**:
- `useActivityTracker` registra eventos en `ticket_access_log`
- `NotificationBell` (real-time) lee `client_notifications`
- `MiActividadFeed` por colaborador
- `AITimeCapture` con captura automática de tiempo via IA

**Compartir Reportes**:
- `ShareReportDialog` genera token público
- `MinutaPresentation` renderiza + export PDF (jsPDF + html2canvas)
- `SharePresentationDialog` para tabs específicos

**IA Integrada**:
- `ExecutiveAIChat` (chat asistente CEO/admin)
- `MemberAIAgentPanel` (asistente personal por colaborador)
- `CaseStrategyPanel` (recomendaciones por caso)
- `ClientStrategyPanel` (salud por cliente)
- `AIUsageDashboard` (audit de uso)
- `usePolicyAI` configura settings IA

---

## 3. Backend (Supabase)

**Project ref:** `qorixnxlaiuyxoentrfa` (prod, sva-erp). [Histórico: `rpiczncifaoxtdidfiqc` era el Lovable viejo]

### 3.1 Edge Functions (27 funciones, en `supabase/functions/`)

**AI / Analytics (8):**
- `analyze-career-path` — trayectoria profesional
- `analyze-cv` — evaluación CV
- `analyze-team-activity` — insights actividad colaborador
- `analyze-team-level` — evaluación nivel equipo
- `analyze-team-scrum` — análisis sprint
- `pm-ai-analysis` — análisis para PM
- `mentor-ai` — asesoría
- `executive-ai-chat` — chat ejecutivo

**Notifications (2 — críticas):**
- `notify-critical-ticket` — Slack + Resend cuando ticket crítico se crea
- `notify-recurring-reopens` — Slack cuando ticket cruza 3+ reincidencias

**User Management (3):**
- `manage-users` — CRUD usuarios. Actions: `create`, `update_role`, `delete`, `update_password`, `update_email`, `create_cliente`, `update_cliente_permission`, `remove_cliente_assignment`, `list_cliente_users`, `create_team_access`, `create_bulk_team_access`
- (otros DEPRECATED: `reset-passwords`)

**Ticket Operations (4):**
- `classify-tickets` — clasificación IA automática
- `decrypt-ticket` — descifra contenido CONFIDENCIAL (admin/pm, deja audit)
- `send-notification-email` — envío vía Resend
- (más tickets ops via RPCs)

**Strategy & Reports (6):**
- `sva-strategy` — plan estratégico semanal (cruza clientes/equipo/backlog/horas → asignaciones)
- `forecast-sprint` — pronóstico sprint
- `case-strategy-ai` — estrategia por caso
- `client-strategy-ai` — estrategia por cliente
- `evaluate-case-compliance` — evaluación cumplimiento checklist
- `policy-ai-assistant` — asistente políticas

**Utils (4):**
- `parse-time-entry` — parsing texto → time entries
- `member-agent-chat` — chat agente personal
- `member-agent-weekly-digest` — digest semanal
- `summarize-transcript` — resumen reuniones
- `recommend-team-for-client` — recomendación equipo
- `sync-devops` — sync con Azure DevOps

**Helper compartido:** `supabase/functions/_shared/auth.ts` (requireAuth) y `cors.ts`.

### 3.2 RPCs / SECURITY DEFINER

**Auth & Roles:**
- `has_role(user_id, role)` — usada en TODAS las policies RLS
- `get_user_role(user_id)` — máximo rol del usuario
- `is_cliente_user`, `is_ceo_user`, `is_gerente_soporte_user` — short-circuits booleanos
- `handle_new_user()` — trigger que crea profile + user_role en signup

**SLA & Tickets:**
- `get_tickets_sla_status()` — estado SLA por ticket con `sla_source`
- `get_sla_summary()` — resumen global (overdue, warning, ok counts)
- `assign_ticket_consecutivos()` — trigger BEFORE INSERT, genera `ticket_id`
- `detect_ticket_reopen()` — trigger BEFORE UPDATE, detecta reincidencias
- `set_reopen_metadata(jsonb)` — guarda en session config

**Audit & Utilities:**
- `record_task_history()` — audit trail
- `log_ticket_change()` — audit tickets
- `prevent_locked_time_entry_edit()` — bloquea edición time entries cerrados
- `log_time_entry_changes()` — audit time entries
- `encrypt_sensitive`/`decrypt_sensitive` — cifrado tickets confidenciales (pgcrypto)
- `get_user_email(user_id)`
- `on_ticket_assigned_notify()` — trigger notificación
- `get_cliente_client_id(user_id)` — resolve cliente → client_id

### 3.3 Triggers principales

| Tabla | Trigger | Migración | Función |
|---|---|---|---|
| `support_tickets` | `trg_assign_ticket_consecutivos` | `20260422150000` | BEFORE INSERT, genera `consecutivo_global`, `consecutivo_cliente`, `ticket_id` |
| `support_tickets` | `trg_detect_ticket_reopen` | `20260429140000` | BEFORE UPDATE, detecta reincidencias |
| `support_tickets` | `trg_log_ticket_change` | (varios) | AFTER INSERT/UPDATE/DELETE → ticket_access_log |
| `support_tickets` | `update_*_updated_at` | varios | mantiene updated_at |
| `tasks` / `clients` / `phases` / `support_sprints` | `update_*_updated_at` | varios | timestamps |
| `auth.users` (Supabase) | `on_auth_user_created` → `handle_new_user()` | foundation | crea profile + user_role |

**Race condition fix** (`20260429100000_fix_consecutivo_race_condition.sql`):
- `pg_advisory_xact_lock(hashtext('support_tickets_consec_' || NEW.client_id))` en `assign_ticket_consecutivos` → resuelve duplicados en inserts paralelos

### 3.4 RLS Policies + Roles

**Tablas con RLS strict** (validación role):
- `support_tickets` — read según has_role + scope (cliente solo ve su empresa)
- `support_ticket_reopens` — read solo internal staff (admin/pm/ceo/gerente_soporte/colaborador); no inserts directos (solo trigger); UPDATE solo admin+gerente_soporte
- `business_rules` — admin/pm/gerente read; admin/pm CRUD
- `client_rule_overrides` — admin/pm + gerentes de ese cliente
- `user_roles` — usuario ve propio rol; admin gestiona
- `cliente_company_assignments` — admin/pm/cliente
- `client_notifications` — scope por client_id

**Tablas con RLS abierto** (Allow all SELECT/INSERT/UPDATE/DELETE):
- `clients`, `tasks`, `action_items`, `phases`, `deliverables`, `meeting_minutes`, `client_financials`, `task_history`, `task_subtasks`, `support_sprints`, `sysde_team_members`, `client_team_members`

> ⚠️ **Estado actualizado:** la auditoría 2026-05-03 cerró todas las "Tablas con
> RLS abierto" listadas arriba. La tabla ya no es vigente — ver
> `supabase/migrations/20260503140000_rls_strict_legacy_tables.sql` y
> `20260503142000_drop_open_authenticated_policies.sql`.

**View security:**
- `support_reopens_summary` — `security_invoker=on` → hereda RLS de tabla base

### 3.5 Auth model

**Tablas:**
- `auth.users` (Supabase managed)
- `profiles` (user_id, full_name, email, avatar_url) — sincronizado por trigger
- `user_roles` (user_id, role) — N:1, has_role resuelve por prioridad
- `sysde_team_members` (id, name, email, role, department, user_id NULL) — staff
- `cliente_company_assignments` (user_id, client_id, permission_level: viewer|editor|admin)
- `gerente_client_assignments` (user_id, client_id) — gerente interno

**Flow:** signup → trigger crea profile + user_role default 'gerente' → admin asigna rol superior si aplica → si role=cliente, vincula a cliente_company_assignments.

---

## 4. Base de Datos

### 4.1 Migraciones (95 totales)

**Cronología:**
- **Marzo 2026 (Foundations)** — RLS consolidation, tabla support_tickets, ticket security/encrypt, realtime
- **Abril 2026 sem 1-2 (Scrum + Sprints)** — sprints schema, backlog_rank, scrum_status, story_points
- **Abril 2026 sem 3 (SLA + Polices)** — business_rules, client_rule_overrides, get_tickets_sla_status, get_sla_summary
- **Abril 2026 sem 4 (Reopens + Imports)** — support_ticket_reopens, race condition fix, 3 bulk imports

**Top 10 más recientes:**
| Timestamp | Propósito |
|---|---|
| `20260430260000` | Fix sprint analytics (story_points default + dedupe Aurum) |
| `20260430240000` | Fix `created_at` desde fecha real del dato (no migración) |
| `20260430230000` | Link 5 colaborador users nuevos a sus tasks |
| `20260430220000` | Mapear 309 owners desde títulos CSV |
| `20260430200000` | Clasificar visibility (interna/externa) + cerrar sprints viejos |
| `20260430180000` | Migrate implementation tickets → tasks table |
| `20260430160000` | Recalibrar fechas de sprints |
| `20260430140000` | Import 2099 work items de 6 backlogs |
| `20260430120000` | Import 575 tickets soporte Excel Hellen |
| `20260430090000` | Hardening RLS view reopens (security_invoker) |

> ⚠️ **Estado actualizado:** desde el 2026-05-03 hay 4 migraciones nuevas
> (`20260503140000` … `20260503145000`) que cierran huecos RLS heredados.
> Total actual: **98 migraciones**.

### 4.2 Tablas críticas — schemas

**`support_tickets`** (cara cliente):
```
id uuid PK · client_id text FK · ticket_id text · producto · asunto · tipo
prioridad (Critica,Impacto Negocio | Alta | Media | Baja)
estado (PENDIENTE | EN ATENCIÓN | VALORACIÓN | COTIZADA | POR CERRAR | ENTREGADA | APROBADA | CERRADA | ANULADA)
fecha_registro · fecha_entrega · responsable · notas
consecutivo_global int · consecutivo_cliente int · UNIQUE(client_id, ticket_id)
fuente (cliente|interno|email|api|devops)
is_confidential · descripcion_cifrada (BYTEA)
sprint_id · story_points · effort · scrum_status
ai_classification · ai_risk_level · ai_summary
reopen_count · last_reopen_at · last_reopen_reason
```

**`tasks`** (implementación):
```
id uuid PK · client_id text FK · original_id int · UNIQUE(client_id, original_id)
title · status (completada|en-progreso|bloqueada|pendiente)
owner · due_date text · priority (alta|media|baja)
assignees jsonb · description · visibility (interna|externa)
sprint_id · story_points · business_value · effort · backlog_rank · scrum_status
assigned_user_id uuid · checklist jsonb
```

**`support_sprints`** (14 días default):
```
id uuid PK · client_id text · name · goal · start_date · end_date
status (planificado|activo|completado) · capacity_points int
```

**`support_ticket_reopens`**:
```
id · ticket_id FK CASCADE · iteration_number · UNIQUE(ticket_id, iteration_number)
reopened_from_state · reopened_to_state · reason · reopen_type
(cliente_rechazo|qa_falla|solicitud_relacionada|otro|historico)
responsible_at_reopen · new_responsible · triggered_by_user_id · triggered_by_name
delivered_at · reopened_at · resolved_at · metadata jsonb
```

**`business_rules`**:
```
id · name · scope (global|client|case_type) · rule_type (closure|sla|notice|...)
content jsonb · is_active · created_by · updated_by
```

**`clients`**:
```
id text PK · name · country · industry · status (activo|en-riesgo|pausado|completado)
progress · contact_name · contact_email · contract_start · contract_end
team_assigned text[] · client_type (soporte|implementacion)
nivel_servicio (Base|Premium|Platinum) · ranking_position · core_version · modules
```

### 4.3 Datos en producción (30/04/2026)

| Entidad | Conteo |
|---|---|
| **clients** | 30+ (6 implementación + 22 soporte + variantes) |
| **support_tickets** | ~150 vivos + histórico CMI Factoraje |
| **tasks** | 2108 (6 implementación) |
| **support_sprints** | 122 (6 activos + 109 completados + 7 planificados) |
| **support_ticket_reopens** | 0 reales + listos para futuros |
| **profiles** | ~30 (incluye 5 nuevos colaboradores recién creados) |
| **sysde_team_members** | 22 activos |

**Cliente users en Login.tsx:**
- **Internos** (14): CEO, Carlos Castante (gerente soporte), Admin, PM, Hellen, Fauricio, Olga, Orlando, Carlos Solis, Luis Alfaro, Carlos Quesada, Maria Vargas, Carlos Rico, Bryan Hernandez
- **Implementación clientes** (5): Apex, Arkfin, Aurum, Dos Pinos, AMC
- **Soporte clientes** (8): CFE Panamá, CMI, Coopecar, Credicefi, FIACG, Fundap, Quiero Confianza (ION), SAF UPV

### 4.4 Storage Buckets

| Bucket | Uso |
|---|---|
| `support-ticket-attachments` | Adjuntos de tickets soporte |
| `task-attachments` | Adjuntos de tareas implementación |
| `team-avatars` | Fotos perfil del equipo |
| `team-cvs` | Currículums (analyze-cv) |
| `presentation-media` | Media de minutas/reportes |

> ℹ️ **Bucket adicional descubierto post-2026-05-04:**
> `minute-feedback-media` (audio/video de feedback en minutas, migración
> `20260422200000_support_minutes_feedback.sql`).

---

## 5. Integraciones Externas

| Integración | Variable env | Funciones | Estado |
|---|---|---|---|
| **Slack Webhook** | `SLACK_WEBHOOK_URL` | notify-critical-ticket, notify-recurring-reopens | Opcional (best-effort) |
| **Resend Email** | `RESEND_API_KEY` + `ONCALL_EMAILS` | notify-critical-ticket, send-notification-email | Opcional |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | case-strategy, client-strategy, mentor-ai, executive-chat, etc. | Activo |
| **Lovable AI** | `LOVABLE_API_KEY` | analyze-team-activity, analyze-career-path | Activo |
| **Azure DevOps** | `AZURE_DEVOPS_PAT` | sync-devops | Disponible (no en uso prod) |
| **Supabase Auth** | (interno) | auth.users + GoTrue | Activo |

> ⚠️ **Corrección post-2026-05-04:** la integración real es **Google Gemini**
> (`GEMINI_API_KEY`), no Anthropic ni Lovable. El helper `lovableCompatFetch`
> en `_shared/cors.ts:75-136` apunta a
> `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
> El nombre arrastra la herencia de Lovable.

**CORS** centralizado en `supabase/functions/_shared/cors.ts` con `ALLOWED_ORIGINS` env.

---

## 6. Scripts y Operaciones (`scripts/`, 19 archivos)

### Imports y Seeds
- `import-tickets-from-excel.mjs` — generador SQL del Excel Hellen (574 tickets)
- `import-implementation-backlogs.mjs` — generador SQL de 6 CSVs DevOps (2099 tasks)
- `extract-task-owners.mjs` — parsea títulos para mapear owners SYSDE
- `seed-cliente-users.mjs` — crea cliente users por cada empresa
- `seed-carlos-castante.mjs`, `seed-ceo-user.mjs` — staff específicos

### Smoke Tests
- `smoke-crud-full.mjs` — CRUD E2E (clients, tickets, presentations)
- `smoke-policies.mjs` — RLS validation end-to-end
- `smoke-tickets.mjs` — flujo creación → asignación → cierre
- `smoke-ai-functions.mjs` — invoca todas las edge fn AI
- `smoke-saved-views.mjs` — vistas guardadas

### QA y Stress
- `qa-database.mjs` — health check con score 0-100. Verifica integridad, RLS, distribuciones. **Último: ≥92/100.**
- `stress-test.mjs` — 7 tests con p50/p95/p99:
  - TEST 1: 50 reads concurrentes en support_tickets
  - TEST 2: get_sla_summary RPC concurrente
  - TEST 3: get_tickets_sla_status (heavy, 100+ rows)
  - TEST 4: Burst sequential reads (cache warm-up)
  - TEST 5: Race condition consecutivo_cliente (20 inserts paralelos same client)
  - TEST 6: Mixed workload (30 reads + 10 writes)
  - TEST 7: Update burst (cambios rápidos estado)

### Utility
- `inspect-cliente-links.mjs` — verifica integridad cliente_company_assignments
- `verify-cliente-logins.mjs` — testea logins
- `deploy-fixes.sh` — orquesta deploy edge functions + migraciones

---

## 7. Pruebas

### 7.1 Vitest (frontend)

**Configurado:** `package.json` scripts `test` y `test:watch`. **Tests existentes (3):**
- `src/example.test.ts`
- `src/lib/exportCsv.test.ts`
- `src/lib/ticketStatus.test.ts`

**Cobertura:** baja. Mayoría de testing es smoke/manual via scripts.

### 7.2 Smoke tests

7 scripts en `/scripts/` testean flows reales contra producción usando SERVICE_ROLE_KEY:
- CRUD básico de cada entidad
- RLS validation
- Edge function invocation
- Sesiones cliente

### 7.3 QA Database

`scripts/qa-database.mjs` corre ~30 chequeos categorizados:
- ✓ Integridad referencial (FKs)
- ✓ RLS policies activas
- ✓ Triggers presentes
- ✓ Distribuciones esperadas (estados, prioridades)
- ✓ No huérfanos
- ✓ Helper functions (has_role, etc.)

**Último score conocido: 92/100** (pre-imports) y **≥92/100 post-imports**.

### 7.4 Stress test

`scripts/stress-test.mjs` reporta latencias contra prod. Hallazgos históricos:
- **TEST 5 (race condition):** 9/10 inserts paralelos fallaban con duplicate key — **fix aplicado** con pg_advisory_xact_lock per client. Validación post-fix: 20/20 OK.
- **TEST 1-4 (reads):** p95 < 200ms en queries normales
- **TEST 3 (heavy):** p95 ~ 500ms en get_tickets_sla_status con 2000+ rows

---

## 8. Lo que falta / TODOs

### 8.1 Implementación pendiente
- **Owner mapping incompleto** — 11 colaboradores extra (Walter Gómez, Andrés Gómez, Luis Mangel, Diego García, Soledad Ortega, etc.) sin auth user. Sus tasks aparecen via `owner` text-only. Crear auth users via manage-users.create cuando necesiten login.
- **~1800 tasks sin owner** — sus títulos no traen el patrón `- INITIALS`. Quedan en `owner='—'`. Mejora futura: ML/heurística más permisiva o asignación manual.
- **Sprint dates son placeholder** — anchorados a "última sprint = hoy" + 14 días por sprint. El COO puede ajustar manualmente en UI Scrum si conoce las fechas reales.
- **business_value default = 5** para todas las tasks (sin diferenciación). Cuando el equipo haga planning poker, se actualizan los reales.
- **CSV DevOps de soporte (853 work items sin cliente)** — fue ignorado en este sprint. Esperar otros docs del usuario para enriquecer responsable en support_tickets.

### 8.2 Funcionalidades planificadas (out of scope previas)
- **Sprint Reviews/Retros con datos histórico** — los 109 sprints completados tienen items pero no hay UI específica de retro guiada.
- **Velocity benchmarking inter-cliente** — comparativa entre clientes para planificación de capacity.
- **Notification masiva al equipo** — cuando se carga bulk data ("se cargaron 575 tickets — revisar bandeja").
- **Backfill de reincidencias** — usar `case_actions` históricos de los tickets para detectar reincidencias pre-trigger.
- **Backfill de assignees** desde el CSV DevOps cuando se importe.

### 8.3 Limpieza técnica
- **Tests automáticos:** sólo 3 tests Vitest. Recomendable agregar tests unitarios para hooks críticos (`useAuth`, `useReopenTicket`, `useTeamScrum`) y para mappers (estado/prioridad/tipo).
- **TODOs/FIXMEs en src/:** muy pocos detectados (<10). Saneo pendiente cuando aparezcan.
- **Dependencias deprecadas:** revisar `react-grid-layout` y `react-resizable` (versiones antiguas, posibles security advisories).
- **Documentación inline:** README principal es Lovable-default, recomendable expandirlo con runbooks.
- **Secrets rotation:** SUPABASE_SERVICE_ROLE_KEY y otros secrets quedan en .env local. Acción de usuario pendiente.

### 8.4 Mejoras UX detectadas en la última sesión
- ✅ **Sidebar collapsed mode** — fixed (oculta clientes en `group-data-[collapsible=icon]:hidden`)
- ✅ **Dates "hace 3 horas"** — fixed (UPDATE created_at desde data real)
- ✅ **Click-through al detalle desde Backlog** — fixed (BacklogView+TicketDetailSheet/TaskDetailSheet)
- ✅ **Visibility filter en Scrum** — fixed (toggle Internas/Externas/Todas)
- 🟡 **Real-time updates** — algunas vistas requieren refresh manual (oportunidad de mejora con channels Supabase)

---

## 9. Próximas iteraciones recomendadas

### Prioridad Alta (próximas 2 semanas)
1. **Crear auth users para los 11 colaboradores faltantes** (script batch usando manage-users.create) → ColaboradorDashboard funcional para todo el equipo
2. **Importar el CSV DevOps de soporte** cuando el COO lo facilite — enriquece `responsable` y `tipo` en los 574 tickets
3. **Tests Vitest críticos** — cobertura ≥40% en hooks de autenticación y mutaciones (`useReopenTicket`, `useUpdateSupportTicket`)

### Prioridad Media (1 mes)
4. **Sprint Retro UI** — vista guiada de retrospectiva por sprint completado
5. **Velocity comparativa** — heatmap inter-cliente
6. **Notificación bulk imports** — al equipo cuando se carga data masiva
7. **Doc runbooks** — onboarding nuevo dev, deploy, troubleshooting

### Prioridad Baja (2-3 meses)
8. **Real-time channels** en views críticos (bandeja, sprint board)
9. **Backfill reopens histórico** desde case_actions
10. **Velocity benchmarking** y planificación de capacity asistida por IA

> ✅ **Estado actualizado de "Próximas iteraciones":** la auditoría
> 2026-05-03/04 ejecutó 4 ítems de la checklist Senior Staff Engineer no
> listada aquí: (1) RLS strict migration cerrando 18 tablas con datos
> sensibles, (2) `bun update` (29→22 vulns, todas dev/build-time), (3) lazy
> code splitting (bundle 3.5MB→2.0MB, -41%), (4) `noUnusedLocals` +
> `noUnusedParameters` activos en tsconfig (limpieza de 294 errores). Los
> ítems #1-3 originales de §9.1 siguen pendientes.

---

## 10. Verificación end-to-end

Para validar que toda la plataforma funciona después de cualquier cambio:

```bash
# 1. Type-check
cd /Users/awt/Downloads/sva-erp-deploy
node ./node_modules/typescript/bin/tsc --noEmit

# 2. QA database (debe dar ≥92/100)
SUPABASE_SERVICE_ROLE_KEY=... bun run scripts/qa-database.mjs

# 3. Stress test
SUPABASE_SERVICE_ROLE_KEY=... bun run scripts/stress-test.mjs

# 4. Smoke tests
bun run scripts/smoke-crud-full.mjs
bun run scripts/smoke-policies.mjs

# 5. UI smoke (login admin → recorrer secciones)
#   - / → Resumen Ejecutivo (ActionQueue, KPIs)
#   - /soporte → Bandeja (133+ activos), Explorar (SLA + Reopens), pill rojo
#   - /clients → 6 implementación + 22 soporte
#   - /scrum → 6 sprints activos, backlog filterable
#   - Login Luis Alfaro → ColaboradorDashboard con 56 tasks
```

---

## Critical paths

### Documentación referencia
- Este documento: `docs/PLAN-LEVANTAMIENTO-2026-04-30.md` (este archivo)
- **Documento técnico vivo (sucesor):** [`ARCHITECTURE.md`](../ARCHITECTURE.md) en raíz del repo
- Memoria proyecto: `/Users/awt/.claude/projects/-Users-awt-Downloads-SVA-ERPV1/memory/MEMORY.md`
- Scripts README: `scripts/README.md`
- Pending work tracker: `scripts/PENDING-WORK.md`

### Codebase
- Frontend root: `/Users/awt/Downloads/sva-erp-deploy/src/`
- Backend (edge functions): `/Users/awt/Downloads/sva-erp-deploy/supabase/functions/`
- Migrations: `/Users/awt/Downloads/sva-erp-deploy/supabase/migrations/`
- Scripts: `/Users/awt/Downloads/sva-erp-deploy/scripts/`

### Producción
- Project ref Supabase: `qorixnxlaiuyxoentrfa` (sva-erp)
- Deploy: `/Users/awt/Downloads/sva-erp-deploy/` (remote `awt-spec/dashboard-implementaci-nes` → Vercel auto-deploy)

---

*Documento generado el 2026-04-30 como parte del levantamiento técnico solicitado por el COO.*

*Preservado en el repo el 2026-05-06 con anotaciones de cambios posteriores.*
