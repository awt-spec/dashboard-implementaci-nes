# SVA — Diagnóstico para Migración a Microservicios

**Fase 1 — Inventario read-only**

| | |
|---|---|
| **Producido** | 2026-05-14 |
| **Codebase analizado** | `/Users/awt/Downloads/sva-erp-deploy/` (rama `main`, HEAD `cb1b05b`) |
| **Backend en producción** | Supabase project `qorixnxlaiuyxoentrfa.supabase.co` |
| **Frontend en producción** | Vercel · alias `sysdesupport.com` |
| **Volumen actual** | 29 clientes · ~150 tickets vivos · 2,099 tasks · 122 sprints · 30 colaboradores |
| **Alcance Fase 1** | Inventario exhaustivo. Cero modificación de código. |
| **Restricción** | Sistema en producción con clientes activos — no hay ventana de downtime |

> 🚨 **Hallazgo crítico a destacar antes de cualquier otra cosa:** la base de código tiene **238 llamadas `supabase.from()`** directas desde el frontend a tablas Postgres vía PostgREST. Esto significa que el SDK de Supabase ES el contrato API actual. Migrar a backend propio requiere reemplazar cada una de esas llamadas. No es trivial. Ver §3.2 y §5.1.

> 🚨 **Hallazgo crítico #2:** la función `send-notification-email` corre con `SERVICE_ROLE_KEY` y **no implementa `requireAuth`** (`supabase/functions/send-notification-email/index.ts`). Si su endpoint público se invoca sin JWT, cualquiera puede dispararla. Verificar con DevOps si está realmente expuesta o solo invocada desde otros servicios. **Pendiente confirmar con AWT.**

---

## 1. Resumen ejecutivo

El SVA está implementado como un **modular monolith frontend + Supabase BaaS**: una sola SPA React (276 archivos TS/TSX, code-split por rol vía `React.lazy`) consume directamente la API REST autogenerada por PostgREST sobre Postgres (80+ tablas), más 27 Edge Functions Deno para operaciones con secretos (IA, email, Slack) o lógica que requiere bypass de RLS.

No existe un backend propio (Node, Python o Go). La "lógica de negocio" se reparte entre:

1. **Triggers SQL** en Postgres (consecutivos de tickets, detección de reincidencias, audit logs, encriptación pgcrypto).
2. **Funciones SQL `SECURITY DEFINER`** (15+ helpers de autorización + cálculos como `get_tickets_sla_status` con jerarquía override/policy).
3. **Edge Functions Deno** (27, agrupables en 7 dominios funcionales).
4. **Hooks de React + componentes** que arman queries y mutaciones contra PostgREST (238 puntos de acoplamiento al SDK).

Esto produce **vendor lock-in fuerte con Supabase**: RLS es la única capa de autorización efectiva, PostgREST es el único contrato API, y las queries se construyen en TypeScript del frontend en lugar de en una capa de servicio. Cualquier migración hacia microservicios requiere primero introducir una capa intermedia que abstraiga el acceso a datos.

El sistema funciona bien en producción a la escala actual (29 clientes, 30 usuarios concurrentes en peak observado), pero **no es portable**: no hay forma de cambiar Supabase por otro proveedor sin reescribir el 80% del frontend.

---

## 2. Inventario del backend (Supabase)

### 2.1 Edge Functions (27 activas, 1 deprecada)

> Notas:
> - `lovableCompatFetch` y `aiTool` viven en `supabase/functions/_shared/cors.ts`. **El código local ya está migrado de Google Gemini a Anthropic Messages API native** (commit `05967e8` del 2026-05-06), pero el binario desplegado en producción puede seguir siendo el de Gemini si no se ha hecho `supabase functions deploy`. Pendiente confirmar deploy con AWT.
> - Auth column: "requireAuth" = `_shared/auth.ts` valida JWT. "requireRole(X)" = además valida `user_roles.role` contra lista X.

| # | Función | Propósito | Tablas que toca | Servicios externos | Secrets | Auth |
|---|---|---|---|---|---|---|
| 1 | `analyze-career-path` | Plan de carrera IA por miembro | `sysde_team_members`, `team_member_certifications`, `team_career_paths`, `ai_usage_logs` | Anthropic vía shim | (auto) | `requireAuth` + `canAccessMember` |
| 2 | `analyze-cv` | Parser de CV con IA | `sysde_team_members`, `clients`, `ai_usage_logs` | Anthropic | (auto) | `requireAuth` + `canAccessMember` |
| 3 | `analyze-team-activity` | Insights de actividad de un usuario | `user_activity_log`, `user_sessions`, `clients`, `ai_usage_logs` | Anthropic | (auto) | `requireAuth` + `canActOnUser` |
| 4 | `analyze-team-level` | Resumen agregado del equipo | `sysde_team_members`, `team_member_skills`, `scrum_work_items`, `support_tickets`, +2 | Anthropic | (auto) | `requireRole([admin, pm, gerente])` |
| 5 | `analyze-team-scrum` | Forecast de sprint y workload | — | Anthropic | (auto) | `requireRole([admin, pm, gerente])` |
| 6 | `case-strategy-ai` | Estrategia IA por ticket (tool-use) | `support_tickets`, `clients`, `client_contracts`, `client_slas`, `client_financials`, `ticket_access_log`, +3 | Anthropic `aiTool` con prompt caching | (auto) | `requireRole([admin, pm, gerente, colaborador])` + rate limit |
| 7 | `classify-tickets` | Clasificación automática IA | `support_tickets`, `ai_usage_logs` | Anthropic | (auto) | `requireRole([admin, pm, gerente])` |
| 8 | `client-strategy-ai` | Estrategia IA por cliente (tool-use) | `clients`, `client_contracts`, `client_slas`, `client_financials`, `support_tickets`, +2 | Anthropic `aiTool` con prompt caching | (auto) | `requireRole([admin, pm, gerente])` + rate limit |
| 9 | `decrypt-ticket` | Descifra `descripcion_cifrada` con pgcrypto | `support_tickets`, `ticket_access_log` | — | `ENCRYPTION_KEY` | `requireRole([admin, pm])` |
| 10 | `evaluate-case-compliance` | Valida cumplimiento normativo del caso | `support_tickets`, `business_rules`, `client_rule_overrides`, `case_compliance` | Anthropic | (auto) | `requireRole([admin, pm, gerente])` |
| 11 | `executive-ai-chat` | Chat ejecutivo sobre portafolio | `clients`, `support_tickets`, `support_sprints`, `deliverables`, `business_rules`, +2 | Anthropic | (auto) | `requireRole([admin, pm, gerente, colaborador])` + rate limit |
| 12 | `forecast-sprint` | Predice fin de backlog por velocity | — | Anthropic `aiTool` | (auto) | `requireRole([admin, pm, gerente])` |
| 13 | `manage-users` | CRUD usuarios + role + cliente perms (10 actions) | `user_roles`, `sysde_team_members`, `profiles`, `cliente_company_assignments` | — | (auto) | `requireAuth` + check role inline (admin / admin+pm) |
| 14 | `member-agent-chat` | Chat mentor por colaborador | `sysde_team_members`, `member_ai_agents`, `team_member_skills`, `time_tracking_goals`, `tasks`, `support_tickets`, `member_ai_conversations` | Anthropic | (auto) | `requireAuth` + `canAccessMember` |
| 14 | `member-agent-weekly-digest` | Digest semanal del miembro | `sysde_team_members`, `time_tracking_goals`, `work_time_entries`, `tasks`, `support_tickets`, `member_ai_digests` | Anthropic | (auto) | `requireAuth` + `canAccessMember` |
| 15 | `mentor-ai` | Mentor técnico según rol/carrera | `sysde_team_members`, `team_member_skills`, `team_career_paths`, `learning_enrollments`, `learning_courses`, `mentor_conversations` | Anthropic | (auto) | `requireAuth` + `canAccessMember` (opcional) |
| 16 | `notify-critical-ticket` | Notifica ticket crítico → Slack + email | `support_tickets`, `clients`, `client_notifications`, `ticket_access_log` | Slack webhook, Resend API | `SLACK_WEBHOOK_URL`, `RESEND_API_KEY`, `ONCALL_EMAILS`, `ERP_BASE_URL`, `EMAIL_FROM` | `requireAuth` |
| 17 | `notify-recurring-reopens` | Notifica ticket con ≥3 reincidencias | `support_tickets`, `clients`, `client_notifications`, `ticket_access_log` | Slack webhook | `SLACK_WEBHOOK_URL`, `ERP_BASE_URL` | `requireAuth` |
| 18 | `parse-time-entry` | Parser texto libre → time entry | `tasks`, `support_tickets`, `clients`, `ai_usage_logs` | Anthropic | (auto) | `requireAuth` (user, sin role check) |
| 19 | `pm-ai-analysis` | Análisis ejecutivo full portfolio | `clients`, `client_contracts`, `client_slas`, `client_financials`, `support_tickets`, `tasks`, `sysde_team_members`, `pm_ai_analysis` | Anthropic | (auto) | `requireRole([admin, pm, gerente])` |
| 20 | `policy-ai-assistant` | Asistente de cumplimiento normativo | `support_tickets`, `case_compliance`, `business_rules`, `policy_ai_settings` | Anthropic | (auto) | `requireRole([admin, pm, gerente])` |
| 21 | `recommend-team-for-client` | Recomienda equipo según skills/capacity | `sysde_team_members`, `team_member_skills`, `team_member_capacity`, `clients` | Anthropic | (auto) | `requireRole([admin, pm, gerente])` |
| 22 | `reset-passwords` | **DEPRECADA — devuelve 410 Gone** | — | — | — | — |
| 23 | `send-notification-email` | Procesa cola de emails vía Resend | `user_notifications` | Resend API, Supabase REST (auto-call) | `EMAIL_FROM`, `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 🚨 **Sin auth** — service role |
| 24 | `summarize-transcript` | Resume reunión a JSON estructurado | `ai_usage_logs` | Anthropic | (auto) | `requireAuth` |
| 25 | `sva-strategy` | Plan estratégico semanal del equipo | `support_tickets`, `tasks`, `clients`, `client_contracts`, `client_slas`, `sysde_team_members`, `work_time_entries`, `support_sprints`, `pm_ai_analysis` | Anthropic | (auto) | `requireRole([admin, pm, gerente])` |
| 26 | `sync-devops` | Sync bidireccional con Azure DevOps | `devops_sync_mappings`, `support_tickets`, `support_sprints` | Azure DevOps REST API 7.1 | `AZURE_DEVOPS_PAT` | `requireRole([admin, pm, gerente])` |

> **Observación:** las únicas funciones que no se invocan desde el frontend son `send-notification-email` (procesa cola), `notify-critical-ticket` y `notify-recurring-reopens` (post-mutación del frontend desde `useSupportTickets`, `useReopenTicket`), y `reset-passwords` (deprecada). **No existen triggers `pg_net` que llamen edge functions** — confirmado con `grep`. Toda invocación es client-initiated o via cron externo (que no veo configurado).

### 2.2 RPCs SQL custom (15 funciones `SECURITY DEFINER`)

| RPC | Tipo | Propósito | Migración origen |
|---|---|---|---|
| `has_role(user_id, role)` | Helper | True si usuario tiene rol exacto. Base de toda RLS. | `20260320221601` |
| `get_user_role(user_id)` | Helper | Devuelve un rol cualquiera | `20260320221601` |
| `is_staff_user(user_id)` | Helper | True si es staff interno (no cliente) | `20260503140000` |
| `is_cliente_user`, `is_ceo_user`, `is_gerente_soporte_user` | Helpers | Shortcuts por rol específico | varias |
| `user_can_see_client(client_id, user_id)` | Helper | Encapsula visibility scoping cliente↔gerente↔staff | `20260503140000` |
| `get_cliente_client_id(user_id)` | Helper | Devuelve cliente asignado a user con rol=cliente | `20260423130000` |
| `has_cliente_permission(user_id, client_id, level)` | Helper | Chequea viewer/editor/admin | `20260423130000` |
| `get_tickets_sla_status()` | RPC pública | Estado SLA por ticket con jerarquía override→policy v4.5 | `20260428180000` |
| `get_sla_summary()` | RPC pública | Resumen global SLA (overdue/warning/ok counts) | `20260428140000` |
| `set_reopen_metadata(jsonb)` | RPC pública | Pasa metadata al trigger via session config | `20260429140000` |
| `bump_shared_ticket_history_view(p_token)` | RPC pública anónima | Incrementa contador de views públicas (token-based) | `20260422190000` |
| `encrypt_sensitive(text, key)` / `decrypt_sensitive(bytea, key)` | Helpers | Wrappers sobre `pgp_sym_encrypt/decrypt` con validación de key length | `20260422160000` |
| `handle_new_user()` | Trigger function | Crea profile al crear `auth.users` | `20260320221601` |
| `record_task_history()` | Trigger function | Audit trail de cambios en tasks | `20260312041646` |
| `assign_ticket_consecutivos()` | Trigger function | Genera `consecutivo_global`, `consecutivo_cliente`, `ticket_id`. **Usa `pg_advisory_xact_lock` per client** | `20260422150000` + race fix `20260429100000` |
| `detect_ticket_reopen()` | Trigger function | Inserta en `support_ticket_reopens` cuando estado pasa de ENTREGADA/APROBADA → activo. Lee metadata de `set_reopen_metadata`. | `20260429140000` |
| `log_ticket_change()` | Trigger function | Inserta en `ticket_access_log` en cada CRUD | `20260422160000` |
| `on_ticket_assigned_notify()` | Trigger function | Crea `client_notifications` cuando responsable cambia | `20260423110000` |
| `handle_confidential_ticket()` | Trigger function | Cifra `descripcion` automáticamente cuando `is_confidential=true` | `20260422160000` |
| `prevent_locked_time_entry_edit()` | Trigger function | Bloquea edit/delete de time entries en semanas cerradas | `20260419161827` |
| `log_time_entry_changes()` | Trigger function | Audit trail a `time_entry_audit_log` | `20260419161827` |
| `update_updated_at()` | Trigger function | Mantiene `updated_at` automáticamente | `20260309013541` |

**Total: 22 funciones SQL (15 helpers/RPCs + 7 trigger functions).** Todas con `SECURITY DEFINER` y `SET search_path = public`.

⚠️ **Riesgo de migración:** la lógica de `detect_ticket_reopen`, `assign_ticket_consecutivos`, `handle_confidential_ticket` y `get_tickets_sla_status` son **lógica de negocio core** que vive solo en SQL. Migrar a microservicios requiere reimplementarla en el servicio correspondiente o seguir teniendo "trigger logic in DB" (split brain con la app).

### 2.3 Triggers principales

| Tabla | Trigger | Tipo | Función |
|---|---|---|---|
| `auth.users` | `on_auth_user_created` | AFTER INSERT | `handle_new_user()` |
| `support_tickets` | `trg_assign_ticket_consecutivos` | BEFORE INSERT | Genera consecutivos + ticket_id |
| `support_tickets` | `trg_detect_ticket_reopen` | BEFORE UPDATE | Detecta reincidencias |
| `support_tickets` | `trg_handle_confidential_ticket` | BEFORE INSERT/UPDATE | Cifra/descifra |
| `support_tickets` | `trg_log_ticket_change` | AFTER INSERT/UPDATE/DELETE | Audit log |
| `support_tickets` | `trg_on_ticket_assigned_notify` | AFTER UPDATE | Crea notificación |
| `tasks` | `trg_record_task_history` | AFTER INSERT/UPDATE | Audit trail |
| `work_time_entries` | `trg_prevent_locked_time_entry_edit` | BEFORE UPDATE/DELETE | Bloqueo semanal |
| `work_time_entries` | `trg_log_time_entry_changes` | AFTER * | Audit log |
| Múltiples tablas | `update_*_updated_at` | BEFORE UPDATE | Timestamp |

### 2.4 Vistas

- `support_reopens_summary` — única vista activa. Agregado (cliente × responsable × producto) con tasa 90d. Usa `WITH (security_invoker=on)` para heredar RLS de la tabla base (`20260430090000`).

### 2.5 Políticas RLS — modelo de autorización

**Patrón canónico tras auditoría 2026-05-03** (`20260503140000_rls_strict_legacy_tables.sql`):

```sql
-- SELECT: staff todo, gerente solo su cliente, cliente solo su empresa
CREATE POLICY "Scoped select tabla" ON public.tabla FOR SELECT USING (
  is_staff_user()
  OR EXISTS (SELECT 1 FROM gerente_client_assignments g
             WHERE g.user_id = auth.uid() AND g.client_id = tabla.client_id)
  OR EXISTS (SELECT 1 FROM cliente_company_assignments c
             WHERE c.user_id = auth.uid() AND c.client_id = tabla.client_id)
);

-- INSERT/UPDATE/DELETE: solo staff con privilegio
```

**Tablas con RLS confidencial estricto** (`client_financials`, `email_notifications`, `ai_usage_logs`): SELECT solo admin/pm/ceo, sin colaborador. Migración `20260503145000`.

🚨 **Riesgo:** la RLS **es** la capa de autorización en producción. No existe autorización en una capa intermedia. Si la migración a microservicios introduce un backend que conecta con `SERVICE_ROLE_KEY`, **se pierde toda RLS** y la autorización debe reimplementarse en código del backend. Esto es trabajo significativo y propenso a errores.

### 2.6 Secrets / env vars de Edge Functions

| Secret | Usado por | Crítico |
|---|---|---|
| `ANTHROPIC_API_KEY` | 17 funciones (vía `_shared/cors.ts`) | ✅ |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auto-inyectados por Supabase | ✅ |
| `ENCRYPTION_KEY` | `decrypt-ticket`, `handle_confidential_ticket` (trigger) | ✅ (≥16 chars, simétrica) |
| `SLACK_WEBHOOK_URL` | `notify-critical-ticket`, `notify-recurring-reopens` | Best-effort |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ONCALL_EMAILS`, `ERP_BASE_URL` | `notify-critical-ticket`, `send-notification-email` | Best-effort |
| `AZURE_DEVOPS_PAT` | `sync-devops` | Opcional |
| `ALLOWED_ORIGINS` | `_shared/cors.ts` (todas) | ✅ (CORS) |

### 2.7 Storage buckets

| Bucket | Public | Uso |
|---|---|---|
| `support-ticket-attachments` | ✅ | Adjuntos de tickets soporte |
| `task-attachments` | ✅ | Adjuntos de tareas implementación |
| `team-avatars` | ✅ | Fotos perfil del equipo |
| `team-cvs` | ❌ Private | Currículums (solo `analyze-cv` con service role) |
| `presentation-media` | ✅ | Media en minutas |
| `minute-feedback-media` | ✅ | Audio/video feedback minutas |

### 2.8 Migraciones — cadencia

| Periodo | Cantidad | Tema dominante |
|---|---|---|
| Marzo 2026 | 12 | Foundations (clients, tasks, profiles, user_roles, has_role) |
| Abril 2026 | 82 | Scrum, sprints, support tickets, SLA, reincidencias, imports masivos |
| Mayo 2026 | 4 | RLS strict, cleanup de policies legacy `USING(true)` |

**Total: 98 migraciones**. La cadencia indica desarrollo intenso reciente. La mayor parte del schema actual se estabilizó en abril.

---

## 3. Inventario del frontend (React SPA)

### 3.1 Páginas (12 archivos en `src/pages/`)

| Página | Ruta | Auth | Rol/Dominio |
|---|---|---|---|
| `Login.tsx` | `/` (auth gate) | Anónimo | Bootstrap |
| `Index.tsx` | `/` (logged) | Sí | **Hub principal** — switch por rol → renderiza dashboard correspondiente |
| `ColaboradorDashboard.tsx` | embebido | Sí | colaborador (fullscreen Jira-style) |
| `TeamScrumDashboard.tsx` | embebido | Sí | admin/pm/gerente_soporte — backlog + sprints |
| `TasksDashboard.tsx` | embebido | Sí | tasks unificadas |
| `AdminUsers.tsx` | embebido | Sí | admin — gestión users |
| `MemberProfile.tsx` | `/team/:memberId` | Sí | Perfil colaborador |
| `Report.tsx` | `/report` | Sí | Reporte ejecutivo PDF |
| `SharedPresentation.tsx` | `/shared/:token` | **Anónimo** | Presentación cliente (snapshot) |
| `SharedSupportPresentation.tsx` | `/shared-support/:token` | **Anónimo** | Presentación soporte |
| `SharedTicketHistory.tsx` | `/historial-caso/:token` | **Anónimo** | Historial ticket público |
| `NotFound.tsx` | `*` | — | 404 |

> **Patrón crítico:** `Index.tsx:120-263` hace `switch(role)` y renderiza un dashboard completo. No hay router anidado. Todo el routing post-login está en estado local + `localStorage`. Esto impacta directamente la separación frontend/backend: el frontend no es modularizable por dominio sin reescribir el dispatch principal.

### 3.2 Acoplamiento al SDK Supabase (`@supabase/supabase-js`)

| Métrica | Valor | Interpretación |
|---|---|---|
| Archivos que importan `supabase` client | **102** | 37% del total de archivos TS/TSX (276) |
| Archivos con calls directos a Supabase | **80** | 29% del total |
| `supabase.from(...)` — queries PostgREST directas | **238** | La superficie de migración más grande |
| `supabase.rpc(...)` — llamadas a funciones SQL | **4** (`get_sla_summary`, `get_tickets_sla_status`, `bump_shared_ticket_history_view`, `set_reopen_metadata` con cast `as any`) | Bajo — fácil de reemplazar por endpoints REST |
| `supabase.functions.invoke(...)` — edge functions | **38** llamadas a 23 functions distintas | Medio — son ya "endpoints" |
| `supabase.auth.*` | 5 | Bajo — concentrado en `useAuth.tsx` |
| `supabase.storage.*` | 12 | Bajo — uploads de attachments |
| `supabase.channel(...)` — Realtime | **0** | Realtime no se usa en el SVA |

**Distribución por carpeta:**

| Carpeta | Archivos con client | Comentario |
|---|---|---|
| `src/hooks/` | 36 / 38 | Casi todos los hooks tocan Supabase — capa de servicio implícita |
| `src/components/` | 58 / 200+ | 🚨 **Anti-pattern: 58 componentes hablan directo con Supabase** sin pasar por hooks |
| `src/pages/` | 6 / 12 | OK — pages delegan a hooks/components |
| `src/lib/` | 1 / 8 | OK |
| `src/integrations/` | 1 / 1 | El `client.ts` único |

**Veredicto:** la capa de hooks (`src/hooks/`) **podría** funcionar como contrato API estable si todos los componentes pasaran por ella. Hoy NO es así — hay 58 componentes que se saltan los hooks y arman queries inline. Migrar el frontend a consumir microservicios requiere primero **forzar todo acceso a Supabase a pasar por hooks** (refactor previo).

### 3.3 Tablas Postgres referenciadas directamente desde frontend (40 distintas)

```
action_items, business_rules, client_contacts, client_contracts,
client_dashboard_config, client_financials, client_notifications,
client_rule_overrides, client_slas, client_team_members, clients,
comments, communication_threads, deliverables, email_notifications,
gerente_client_assignments, learning_courses, learning_enrollments,
meeting_minutes, member_ai_conversations, message_reactions, phases,
policy_ai_settings, presentation_data, presentation_feedback, profiles,
risks, shared_presentations, shared_support_presentations,
shared_ticket_history, support_data_updates, support_minutes,
support_minutes_feedback, support_reopens_summary, support_sprints,
support_ticket_attachments, support_ticket_dependencies,
support_ticket_notes, support_ticket_subtasks, support_ticket_tags
```

**40 tablas / 80+ existentes = 50% del schema** está expuesto directamente al frontend. Las otras 40 son tocadas solo desde edge functions o triggers.

### 3.4 Edge Functions invocadas desde frontend (23 de 27)

Las 4 **no invocadas** desde el frontend (corren server-side o están deprecadas):
- `notify-critical-ticket` — se invoca desde `useSupportTickets.ts` post-INSERT (NO confundido — sí es client-initiated en realidad). 🟡 **Inconsistencia con grep anterior — revisar.**
- `notify-recurring-reopens` — invocada desde `useReopenTicket.ts` post-mutación.
- `send-notification-email` — referenciada solo desde migration `20260423110000_user_notifications.sql` (probablemente cron externo o no-cron — pendiente confirmar).
- `reset-passwords` — DEPRECADA.

🚨 **Hallazgo:** las notificaciones críticas se disparan **desde el browser después de una mutación**. Si la pestaña se cierra entre el INSERT y la llamada a la edge function, **la notificación se pierde**. No hay `pg_net` ni cola persistente. Esto es deuda técnica importante para producción.

### 3.5 Lógica de negocio embebida en frontend (a migrar a backend)

Estas piezas están escritas en TypeScript del frontend y deberían vivir en un servicio:

| Lógica | Archivo | Riesgo |
|---|---|---|
| Cálculo de WSJF (`business_value / effort`) | `src/hooks/useTeamScrum.ts:40-43` | Bajo — cálculo puro |
| Mapping de estados ticket → estado normalizado | `src/lib/ticketStatus.ts` | Bajo — tiene 23 tests |
| Sanitización de payload tickets (campos pre/post migración) | `src/hooks/useSupportTickets.ts:222-277` | Medio — hay fallback heurísticos |
| Retry con regeneración de `ticket_id` si trigger BD no existe | `src/hooks/useSupportTickets.ts:301-352` | 🚨 **Alto — frontend genera ticket_id si trigger falla**. Esto rompe el invariante de consecutivos únicos si dos clientes lo intentan en paralelo |
| Detección de transiciones de estado que disparan reopens | `src/components/support/TicketDetailSheet.tsx` | Medio — el dialog de motivo se monta basado en lógica del front |
| Mapeo prioridad → SLA (fallback si BD no responde) | varios | Bajo |
| Cálculo de tiempo restante SLA (cliente-side, complementario a `get_tickets_sla_status`) | `src/hooks/useTicketsSLAStatus.ts` | Bajo — solo display |

### 3.6 Frontend → Backend wire map (top calls)

Las 5 funciones más invocadas desde el frontend (basado en grep de `supabase.functions.invoke`):

| Edge function | Invocaciones | Contexto |
|---|---|---|
| `executive-ai-chat` | varias en `ExecutiveAIChat`, `MemberAIAgentPanel` | AI / Reporting |
| `case-strategy-ai` | en `CaseStrategyPanel`, `TicketDetailSheet` | AI / Tickets |
| `classify-tickets` | en `SupportDashboard`, batch UI | Tickets |
| `manage-users` | en `AdminUsers`, `SystemUsersTab`, `ClientUsersTab` | Auth |
| `decrypt-ticket` | en `TicketDetailSheet` (botón "ver descifrado") | Tickets / Auth |

---

## 4. Mapa de dominios (bounded contexts)

> Aplicando DDD sobre el inventario anterior, propongo **7 bounded contexts** + 1 contexto técnico cross-cutting.

### 4.1 Tabla maestra

| # | Contexto | Edge fns | Tablas principales | Eventos a publicar (hipótesis) | Dependencias |
|---|---|---|---|---|---|
| **1** | **Auth & Users** | `manage-users`, `decrypt-ticket`*, `reset-passwords` (dep) | `auth.users`, `profiles`, `user_roles`, `sysde_team_members`, `cliente_company_assignments`, `gerente_client_assignments` | `user.created.v1`, `role.assigned.v1`, `cliente_assignment.changed.v1` | Es la **raíz**. Todos los demás dependen de él. |
| **2** | **Tickets & Support** | `classify-tickets`, `evaluate-case-compliance`, `policy-ai-assistant`, `decrypt-ticket`* | `support_tickets`, `support_ticket_reopens`, `support_ticket_subtasks`, `support_ticket_notes`, `support_ticket_tags`, `support_ticket_attachments`, `support_ticket_dependencies`, `ticket_access_log`, `case_compliance`, `business_rules`, `client_rule_overrides`, `shared_ticket_history` | `ticket.created.v1`, `ticket.status_changed.v1`, `ticket.reopened.v1`, `ticket.assigned.v1`, `ticket.classified.v1` | Auth (roles), Clients (client_id), AI (clasificación) |
| **3** | **Scrum & Sprints** | `forecast-sprint`, `analyze-team-scrum` | `support_sprints`, `tasks`, `task_history`, `task_subtasks`, `task_dependencies`, `task_tags`, `task_attachments`, `sprint_dailies`, `sprint_retrospectives`, `sprint_reviews` | `sprint.started.v1`, `sprint.completed.v1`, `task.assigned.v1`, `task.completed.v1` | Auth, Clients, Tickets (cuando ticket→task) |
| **4** | **Clients** | — | `clients`, `client_contracts`, `client_slas`, `client_financials`, `client_contacts`, `client_team_members`, `phases`, `deliverables`, `action_items`, `meeting_minutes`, `risks`, `comments` | `client.created.v1`, `contract.renewed.v1`, `deliverable.approved.v1`, `minute.published.v1` | Auth |
| **5** | **Team & People** | `analyze-career-path`, `analyze-cv`, `analyze-team-activity`, `analyze-team-level`, `member-agent-chat`, `member-agent-weekly-digest`, `mentor-ai`, `recommend-team-for-client`, `parse-time-entry` | `sysde_team_members`, `team_member_skills`, `team_member_certifications`, `team_member_capacity`, `team_career_paths`, `team_onboarding`, `team_kudos`, `team_time_off`, `learning_courses`, `learning_enrollments`, `work_time_entries`, `time_entry_audit_log`, `time_weekly_locks`, `time_tracking_goals`, `member_ai_agents`, `member_ai_conversations`, `mentor_conversations` | `member.skill_added.v1`, `time_entry.recorded.v1`, `cv.analyzed.v1` | Auth, AI |
| **6** | **AI / LLM Gateway** | `executive-ai-chat`, `case-strategy-ai`, `client-strategy-ai`, `pm-ai-analysis`, `sva-strategy`, `summarize-transcript` + helpers en `_shared/cors.ts` | `ai_usage_logs`, `pm_ai_analysis`, `policy_ai_settings` | `ai.call.completed.v1` (para audit/billing) | Cross-cutting — depende de Tickets, Sprints, Clients, Team (los lee como contexto) |
| **7** | **Notifications & Integrations** | `notify-critical-ticket`, `notify-recurring-reopens`, `send-notification-email`, `sync-devops` | `email_notifications`, `client_notifications`, `user_notifications`, `mentions`, `devops_sync_mappings`, `devops_sync_logs`, `devops_connections` | (consume eventos de otros — no publica) | Tickets, Auth, Sprints |
| **+** | **(Cross-cutting técnico)** | — | `user_saved_views`, `user_activity_log`, `user_sessions`, `client_dashboard_config`, `colaborador_dashboard_layouts`, `communication_threads`, `thread_messages`, `message_reactions`, `shared_presentations`, `shared_support_presentations`, `presentation_data`, `presentation_feedback`, `support_minutes`, `support_minutes_feedback`, `support_presentation_feedback` | — | Es UI state + sharing → podría ser un servicio "Workspace" si vale la pena, o dividirse entre los demás. **Pendiente confirmar con AWT.** |

*`decrypt-ticket` toca data de Tickets pero su propósito es **autorización + auditoría** → más natural en Auth/Users.

### 4.2 Áreas ambiguas (requieren decisión de AWT)

| Caso | Opción A | Opción B | Mi recomendación |
|---|---|---|---|
| `parse-time-entry` | Team & People (impacta horas) | AI Gateway (es solo parsing) | **A** — la persistencia es en Team. |
| `decrypt-ticket` | Tickets (data) | Auth & Users (autorización + audit) | **B** — patrón de autorización idéntico a `manage-users`. |
| `shared_presentations` y `shared_*_history` (links públicos con token) | Clients (es presentación) | Cross-cutting (es sharing genérico) | **A** — el contenido siempre es de un cliente. |
| `business_rules` + `client_rule_overrides` (política SLA v4.5) | Tickets (es donde se aplica) | Clients (es contrato del cliente) | **A** — la política es la regla, vive donde se evalúa. |
| `case_compliance` (estado de cumplimiento por ticket) | Tickets | Reporting | **A** — es estado mutable del ticket. |

### 4.3 ¿Cuántos microservicios al final?

- **Caso "puro DDD":** 7 microservicios + 1 (cross-cutting workspace) = **8 servicios**.
- **Caso "transición pragmática":** colapsar Tickets + Scrum (comparten muchos consumidores y `client_id` como FK) = **6 servicios**.
- **Caso "mínimo viable para empezar":** extraer solo Auth + AI Gateway (los más independientes) en Fase 1, dejar el resto en monolito = **3 servicios** (Auth, AI Gateway, "Core" monolítico).

**Mi recomendación para arrancar:** el **caso mínimo viable** primero. Strangler fig parte de los servicios menos acoplados al núcleo transaccional (`Auth` y `AI Gateway`). Cuando esos estén estables, separar `Notifications & Integrations` que ya tiene dependencia outbound (Slack/Resend/DevOps) y baja acoplamiento de datos.

---

## 5. Riesgos identificados

### 5.1 🚨 Acoplamiento masivo frontend ↔ Supabase

- **238 llamadas `supabase.from()`** directas en 80 archivos frontend.
- **40 tablas** accedidas vía PostgREST autogenerado.
- 58 componentes (no hooks) que se saltan la abstracción de la capa de hooks.

**Mitigación previa requerida:** antes de migrar a microservicios, refactorizar para que **todo acceso a Supabase pase por hooks** (`src/hooks/`). Esto convierte el archivo del hook en el "contrato API local" y permite reemplazarlo por un cliente HTTP autogenerado sin tocar componentes.

**Estimación honesta:** este refactor previo es 2-3 semanas para un dev senior dedicado, tocando ~58 componentes. Sin esto, la migración a microservicios es 3-4× más larga.

### 5.2 🚨 Lógica de negocio en triggers SQL y RPCs

Las siguientes invariantes están **solo** en Postgres:

- Generación de `consecutivo_global` y `consecutivo_cliente` (con advisory lock por client).
- Detección de reincidencias (trigger lee metadata vía session config).
- Cifrado automático de campos confidenciales.
- Cálculo de SLA con jerarquía override→policy.
- Audit logs (ticket_access_log, task_history, time_entry_audit_log).

**Decisión de diseño obligatoria (Fase 2):** ¿estos triggers se mantienen en Postgres y los microservicios escriben con `INSERT` confiando en ellos, o se reimplementan en código del servicio? Cada opción tiene trade-offs significativos.

### 5.3 🚨 Autorización solo en RLS

No hay capa de autorización en código. Toda la autorización está en `CREATE POLICY` con `has_role()`, `is_staff_user()`, `user_can_see_client()`. Si un microservicio conecta con `SERVICE_ROLE_KEY` (bypass RLS), pierde toda autorización y debe reimplementarla.

**Implicación:** el primer microservicio debe ser **Auth/Users**, que expone `requireRole`, `canAccessClient`, etc. como middleware/decorador para los demás servicios.

### 5.4 🚨 Notificaciones client-initiated

`notify-critical-ticket` y `notify-recurring-reopens` se invocan desde `useSupportTickets.ts` y `useReopenTicket.ts` **después** de la mutación al frontend. Si el browser cierra, la notificación se pierde. **No hay cola persistente ni `pg_net` configurado.**

**Solución natural post-migración:** event bus (RabbitMQ/Kafka/Redis Streams). El servicio Tickets publica `ticket.created.v1` con `priority=critica`; Notifications consume y dispara Slack/email.

### 5.5 🚨 `send-notification-email` sin auth

`supabase/functions/send-notification-email/index.ts` no llama `requireAuth`. Si el endpoint está públicamente accesible, cualquiera con la URL puede dispararlo. **Pendiente confirmar con AWT** si el endpoint está restringido al service role only o públicamente expuesto.

### 5.6 Vendor lock-in con Supabase

Toda la lógica vive en:
- Postgres triggers + RPCs (no portables sin reescribir)
- PostgREST autogenerado (Supabase-specific)
- Edge Functions Deno (portables a Deno Deploy o Cloudflare Workers con cambios menores)
- Supabase Auth (GoTrue, portable, hay un release self-hosted)
- Supabase Storage (Postgres + S3-compatible, portable con esfuerzo)

**Veredicto:** la migración a microservicios **reduce** el lock-in (porque el frontend deja de hablar directo a PostgREST), pero la BD seguirá siendo Postgres administrado por algún proveedor.

### 5.7 Sin Realtime channels — oportunidad

Hay **0 usos de `supabase.channel()`**. La UI hace polling/refresh manual o invalidación de cache via TanStack Query. Esto es deuda de UX (bandeja de tickets no se actualiza en tiempo real cuando alguien más asigna o cierra un ticket).

**Decisión Fase 2:** ¿la nueva arquitectura incluye WebSocket/SSE en el API Gateway o se mantiene polling? Aporta mucha UX pero suma complejidad.

### 5.8 Origen Lovable — deuda específica

El proyecto nació en [Lovable](https://lovable.dev). Residuos detectados:
- `vite.config.ts:4` importa `lovable-tagger` (solo dev mode)
- `index.html:9` `<meta name="author" content="Lovable">`
- Comentario histórico en `_shared/cors.ts:42-45` sobre "Lovable AI Gateway"
- Variable env legacy `LOVABLE_API_KEY` mencionada en `scripts/README.md` (ya migrado)

No bloquea la migración pero es housekeeping pendiente.

### 5.9 Sin Realtime, sin pg_cron, sin observabilidad

- **No hay cron jobs** configurados (no `pg_cron`, no Vercel Cron, no GitHub Actions scheduled).
- **No hay observabilidad agregada** (Sentry/Datadog/Logtail). Solo logs de Supabase Dashboard.
- **No hay tracing distribuido** — será obligatorio en arquitectura de microservicios.

### 5.10 Test coverage — 0% en lógica de servicio

`bun run test` corre 35 tests Vitest, **todos en `src/lib/`** (exportCsv, ticketStatus). Cero tests de hooks, mutaciones, componentes, RLS policies, edge functions. La red de seguridad para refactor es virtualmente nula.

**Antes de migrar a microservicios** habría que cubrir al menos:
- Hooks de mutación (`useReopenTicket`, `useSupportTickets`).
- Función SQL `get_tickets_sla_status` con casos de override.
- Trigger `detect_ticket_reopen` (test que verifica que dispara correctamente).

---

## 6. Resumen de hallazgos para Fase 2

### Lo que tenemos a favor

- ✅ Schema Postgres bien definido, idempotente, RLS recientemente endurecida.
- ✅ Edge Functions ya separadas en helpers compartidos (`_shared/auth.ts`, `_shared/cors.ts`).
- ✅ Frontend con code-split agresivo por rol (lazy routes).
- ✅ TanStack Query como capa de cache server-state — ya hay disciplina de invalidación.
- ✅ Migración Anthropic completada en código (commit `05967e8`) → AI Gateway es candidato natural a primer microservicio.
- ✅ Documentación maestra (`ARCHITECTURE.md`, 1500 líneas) escrita hace 10 días — base sólida para SDD/specs.

### Lo que tenemos en contra

- ❌ 238 puntos de acoplamiento al SDK Supabase en el frontend.
- ❌ Lógica core (consecutivos, reopens, encriptación, SLA) solo en Postgres.
- ❌ Autorización **solo** en RLS — no hay layer code.
- ❌ Notificaciones críticas dependen del browser.
- ❌ 0% test coverage en hooks y lógica de servicio.
- ❌ Sin staging environment (todo es prod).

### Áreas que requieren decisión de AWT antes de Fase 2

1. **¿El mapeo de bounded contexts refleja correctamente cómo entiendes el negocio?**
   - ¿Tickets + Scrum se mantienen separados o se colapsan?
   - ¿`parse-time-entry` queda en Team o en AI Gateway?
   - ¿Las "presentaciones públicas con token" forman un servicio propio o se distribuyen?

2. **¿Cuántos servicios al final?**
   - **3** (Auth + AI Gateway + Core monolítico) — pragmático, riesgo bajo.
   - **6-7** (separación completa) — purista, más esfuerzo.

3. **¿La BD se mantiene única o se va a "database per service"?**
   - Mismo Postgres con schemas separados (mantenibilidad).
   - Postgres distinto por servicio (purismo, alta complejidad operativa para un equipo pequeño).

4. **¿`send-notification-email` realmente no tiene auth?** — verificar urgentemente.

5. **¿Hay restricción de proveedor cloud?** — SYSDE tiene presencia en Azure (BCR), ¿la nueva infra debe ir ahí o es libre?

6. **¿Cuál es la urgencia real?** — ¿es estratégico hacia un release Q3 2026, o es un proyecto sin deadline duro?

---

## 7. Pregunta a AWT (gate Fase 1 → Fase 2)

> ✋ **El mapeo de bounded contexts en §4 refleja correctamente cómo entiendes el negocio?**
>
> En particular:
> - ¿Confirmas que **Tickets** y **Scrum/Sprints** deben ser servicios separados, o los colapsamos en uno solo (`Work Items`) dado que ambos comparten el concepto de "trabajo asignable a un cliente"?
> - ¿Las áreas ambiguas de §4.2 (parse-time-entry, decrypt-ticket, shared_presentations, business_rules, case_compliance) — coincides con mi recomendación o ajustarías?
> - ¿Hay algún dominio que falte (ej. Facturación, Contratos, CRM separado)?
>
> Y dos preguntas operativas:
> - ¿`send-notification-email` está realmente sin auth o el endpoint está cerrado a nivel de Supabase project settings? (riesgo §5.5)
> - ¿Restricción de hosting (Azure, AWS, multi-cloud, mantener Supabase)?
>
> **No avanzo a Fase 2 (decisiones arquitectónicas) hasta que confirmes.**

---

## Referencias cruzadas

| Tema | Documento |
|---|---|
| Resumen ejecutivo | (pendiente — `00-resumen-ejecutivo.md`) |
| AI-readiness score | (pendiente — `02-ai-readiness-score.md`) |
| Workflow de agentes SDD | (pendiente — `03-workflow-agentes.md`) |
| Diagramas C4 + flujo SDD | (pendiente — `04-diagrama-flujo.md`) |
| Reglas de gobernanza | (pendiente — `05-gobernanza-y-reglas.md`) |
| Plan de migración Strangler Fig | (pendiente — `06-plan-adopcion.md`) |
| Métricas de éxito | (pendiente — `07-metricas-exito.md`) |
| Riesgos y mitigaciones expandidos | (pendiente — `08-riesgos-y-mitigaciones.md`) |
| Documentación maestra del sistema actual | `/ARCHITECTURE.md` (1500 líneas, escrita 2026-05-04) |

---

*Fin Fase 1. Documento producido sin modificar código de producción. Próximo paso: esperar feedback de AWT sobre §7 antes de iniciar Fase 2.*
