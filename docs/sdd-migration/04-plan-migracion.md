# SVA — Plan de Migración Strangler Fig (Fase 4)

| | |
|---|---|
| **Producido** | 2026-05-15 |
| **Prerequisitos firmados** | F1 ✓ · F2 (12/12 ADRs) ✓ · F3 (C4 + OpenAPI + eventos) ✓ |
| **Alcance Fase 4** | Estrategia Strangler Fig adaptada al SVA · Roadmap por sprint · Plan de cutover servicio-a-servicio · Feature flags + rollback · Validación de consistencia · Métricas de éxito |
| **Out of scope** | Implementación efectiva (Fase 5) |

---

## 0. Contexto crítico que cambia las reglas del Strangler Fig clásico

El Strangler Fig estándar asume que el monolito viejo y la nueva arquitectura tienen **bases de datos separadas**, por lo que se necesita:
- Migración de datos
- Doble escritura
- Reconciliación / shadow reads
- Rollback complejo si los datos divergen

**En el SVA esto NO aplica** porque, por ADR-004, **mantenemos el mismo Postgres único en Supabase** (`qorixnxlaiuyxoentrfa`). Los nuevos servicios y el monolito viejo escriben a la misma BD.

### Implicaciones

| Tema | Strangler Fig clásico | SVA |
|---|---|---|
| Migración de datos | Compleja (ETL, validación) | **No aplica** — mismo Postgres |
| Doble escritura | Necesaria | **No necesaria** |
| Reconciliación | Necesaria | **No necesaria** |
| Rollback | Complejo | **Trivial** — feature flag en frontend |
| Riesgo de divergencia | Alto | **Cero** |
| Riesgo principal | Inconsistencia de datos | **Inconsistencia de comportamiento** (bug en endpoint nuevo vs SDK directo) |

**El verdadero riesgo del SVA** no es perder datos sino que el endpoint nuevo devuelva **resultados distintos** que el call directo `supabase.from()` actual (por bug, por diferencia en cómo se aplica RLS, etc.). El plan se concentra en mitigar eso.

---

## 1. Resumen del approach

```
                       ┌────────────────────────────────────────────┐
                       │ Sprint 0 — Foundation (1-2 sem)            │
                       │ Scaffolding repos · CI/CD · Feature flags  │
                       │ Refactor previo: forzar todo via hooks     │
                       └─────────────────────┬──────────────────────┘
                                             │
                                             ▼
                       ┌────────────────────────────────────────────┐
                       │ Sprint 1 — auth-service (2-3 sem)          │
                       │ Implementar + cutover + 7d monitoring      │
                       └─────────────────────┬──────────────────────┘
                                             │
                                             ▼
                       ┌────────────────────────────────────────────┐
                       │ Sprint 2 — ai-gateway (1-2 sem)            │
                       │ Es proxy puro · cutover rápido             │
                       └─────────────────────┬──────────────────────┘
                                             │
                                             ▼
                       ┌────────────────────────────────────────────┐
                       │ Sprint 3 — core-service: tickets (3-4 sem) │
                       │ Subdominio más crítico · 70% del valor     │
                       └─────────────────────┬──────────────────────┘
                                             │
                                             ▼
                       ┌────────────────────────────────────────────┐
                       │ Sprint 4-7 — core-service: resto (6-10 sem)│
                       │ Sprints · Clients · Team · Reporting · Pub │
                       └─────────────────────┬──────────────────────┘
                                             │
                                             ▼
                       ┌────────────────────────────────────────────┐
                       │ Sprint 8 — Cleanup (1-2 sem)               │
                       │ Eliminar fallbacks · deprecar SDK Supabase │
                       │ en frontend (excepto Auth + Storage)       │
                       └────────────────────────────────────────────┘
```

**Total estimado: 15-22 semanas (~4-5 meses) hasta migración completa.** Primer servicio en prod (auth) en 4-5 semanas desde el kick-off.

> ⚠️ **Nota sobre urgencia.** AWT indicó "muy urgente" en gate F1→F2. Esto NO significa "2 semanas" — significa que **no podemos parar 6 meses sin entregar valor**. El plan entrega valor incrementalmente: cada sprint cierra con algo en producción y observable. Si en S4 (~10 semanas) tickets ya migró, ya tenés 80% del valor aunque scrum/team/reporting tarden 2 meses más.

---

## 2. Strangler Fig adaptado al SVA

### 2.1 Topología en cada fase

#### Fase A — Hoy
```
Frontend (SPA) ──► Supabase PostgREST (.from)
            └────► Supabase Edge Functions (manage-users, classify-tickets, ...)
            └────► Supabase Auth (signInWithPassword)
            └────► Supabase Storage
```

#### Fase B — Durante migración (sprint N en curso)
```
Frontend (SPA)
  ├── feature_flag "use_new_auth"  ──► auth-service NEW ──► Supabase (RLS via JWT)
  │                                 ╲                    ╱
  │                                  ╲ fallback         ╱
  │                                   ▼                ╱
  └── feature_flag OFF              ──► Supabase directo (legacy)
       Supabase Auth + manage-users edge fn
```

Cada servicio nuevo tiene:
- Su flag dedicado: `use_new_auth`, `use_new_ai`, `use_new_tickets`, etc.
- Default OFF al desplegar — solo devs/QA con override pueden probar.
- Rollout gradual: 10% → 50% → 100% de users, observando Sentry.

#### Fase C — Post-migración total
```
Frontend ──► api.sva.sysde.com (3 servicios)
            ╲
             ╲► Supabase Auth (sigue) — solo signInWithPassword + token refresh
             ╲► Supabase Storage (sigue)
             ╲
              ► Edge functions retiradas excepto sync-devops (puede vivir donde mejor convenga)
```

### 2.2 Reglas durante la transición

1. **Cero deploy de schema-breaking changes a Postgres** entre sprints. Si una migración SQL necesita correr, se aplica primero, se valida que el SDK viejo Y el endpoint nuevo siguen funcionando, después se libera.
2. **Cada endpoint nuevo debe responder con el mismo shape de data** que el call directo `supabase.from()` que reemplaza. Esto se valida con un **shadow test**: en CI, comparar `result_from_new_endpoint` vs `result_from_supabase_direct` para los mismos params. Diferencia → bug.
3. **No se elimina ningún edge function en uso hasta que su reemplazo está en producción al 100% y estable por 7 días.**
4. **La RLS no se modifica durante la transición.** Si necesita cambiar, se aplica como hotfix planificado fuera del ciclo de migración.

---

## 3. Roadmap por sprint (rangos, no fechas exactas)

| Sprint | Duración | Alcance | Hito visible |
|---|---|---|---|
| **S0** | 1-2 sem | Foundation: scaffolding 2 repos · CI/CD · feature flags · refactor previo del frontend para forzar hooks · primer deploy de cada servicio (esqueleto + `/healthz`) | 3 servicios devolviendo 200 OK en `/healthz` |
| **S1** | 2-3 sem | auth-service completo (10 endpoints) · cutover gradual de `manage-users` y `useAuth` | Login + admin users funcionando via backend nuevo (100% users) |
| **S2** | 1-2 sem | ai-gateway completo (20 endpoints) · cutover de las 17 funciones IA | Todas las llamadas IA pasan por `api.sva.sysde.com/v1/ai/*` |
| **S3** | 3-4 sem | core-service · subdominio `/v1/tickets/*` completo (~14 endpoints + reopens + SLA + decrypt + compliance + policy) | Bandeja tickets, SupportDashboard, TicketDetailSheet funcionando via API |
| **S4** | 2 sem | core-service · subdominio `/v1/sprints/*` (~6 endpoints) | TeamScrumDashboard, BacklogView via API |
| **S5** | 2-3 sem | core-service · subdominio `/v1/clients/*` (~8 endpoints) + `/v1/public/*` | ClientList, ClientDetail, MinutaPresentation, SharedPresentation via API |
| **S6** | 2 sem | core-service · subdominio `/v1/team/*` (~5 endpoints) | TimeTrackingDashboard, MemberProfile via API |
| **S7** | 1-2 sem | core-service · subdominio `/v1/reporting/*` (~3 endpoints) + cleanup de hooks residuales | CEODashboard, ExecutiveOverview via API |
| **S8** | 1-2 sem | Cleanup: deprecar edge functions migradas · remover `supabase.from()` y `supabase.rpc()` del frontend (queda solo `.auth` y `.storage`) · doc final | Repo backend retira el último edge function. Frontend `grep "supabase.from" → 0` |

**Total: 15-22 semanas.**

> Las duraciones son **rangos honestos** con un equipo de 1-3 devs. Si SYSDE asigna 4+ devs dedicados, S3-S7 pueden paralelizarse parcialmente (subdominios independientes entre sí) → total puede bajar a 12-15 semanas.

---

## 4. Detalle por sprint

### 4.1 Sprint 0 — Foundation

**Objetivo:** dejar todo el andamiaje para que las siguientes fases solo sean "implementar dominios", no "instalar herramientas".

#### Subtareas

| # | Tarea | Días estimados | Notas |
|---|---|---|---|
| 0.1 | Crear repo `sva-frontend` extraído del actual `sva-erp-deploy` | 1 | Mantiene `main` apuntando al deploy actual de Vercel; nuevo repo lo reemplaza progresivamente |
| 0.2 | Crear repo `sva-backend` monorepo Turborepo con 3 apps esqueleto (Hono `/healthz`) | 1 | `apps/auth-service`, `apps/ai-gateway`, `apps/core-service` |
| 0.3 | Setup CI/CD (GitHub Actions) en cada repo: tsc, vitest, deploy a Vercel | 1 | Vercel preview por PR |
| 0.4 | Crear 3 proyectos Vercel + 1 proxy `api-router` con `vercel.json` rewrites | 0.5 | DNS `api.sva.sysde.com` apunta al proxy |
| 0.5 | Setup Sentry (1 proyecto frontend + 1 proyecto backend con tags por servicio) | 0.5 | Free tier OK al arranque |
| 0.6 | Implementar `packages/auth-middleware` (`requireAuth`, `requireRole`, `canAccessClient`) con JWT validation HS256 | 2 | Tests al 80% |
| 0.7 | Implementar `packages/shared` (error types, role enum, constants) | 1 | |
| 0.8 | Implementar `packages/contracts` con los 3 OpenAPI YAMLs (importados de Fase 3) | 0.5 | Source of truth |
| 0.9 | Setup pipeline de generación de clients TS: `openapi-typescript` por servicio | 1 | Publish a GitHub Packages como `@sva-backend/{auth,ai,core}-client` |
| 0.10 | **Refactor previo crítico en frontend:** consolidar todo `supabase.from()` que está en componentes (58 archivos) → mover a hooks (`src/hooks/`) | 5-8 | Esto es la deuda del diagnóstico §5.1. Sin esto, S1-S7 toman 3× más |
| 0.11 | Implementar **feature flags** en el frontend (sencillo: env vars + `useFeatureFlag` hook) | 1 | Flags: `use_new_auth`, `use_new_ai`, `use_new_tickets`, etc. |
| 0.12 | Configurar secrets en cada Vercel project: `SUPABASE_*`, `ANTHROPIC_API_KEY`, `SUPABASE_JWT_SECRET`, `SENTRY_DSN`, `ALLOWED_ORIGINS` | 0.5 | |
| 0.13 | Smoke test de los 3 servicios: `curl https://api.sva.sysde.com/v1/{auth,ai,...}/healthz` devuelve 200 | 0.5 | Gate de cierre de S0 |

#### Criterios de aceptación S0

- [ ] `git clone sva-frontend && npm install && npm run dev` levanta la SPA local apuntando a Supabase de staging.
- [ ] `git clone sva-backend && pnpm install && pnpm dev` levanta los 3 servicios local.
- [ ] `curl https://auth.sva.sysde.com/healthz` → 200 OK.
- [ ] `curl https://ai.sva.sysde.com/healthz` → 200 OK.
- [ ] `curl https://api.sva.sysde.com/v1/healthz` → 200 OK (core).
- [ ] Sentry recibe error de test desde frontend Y desde cada servicio.
- [ ] CI pasa: tsc + vitest + build en ambos repos.
- [ ] **Refactor previo completado**: `grep -r "supabase.from\|supabase.rpc" src/components/` devuelve 0 resultados en el frontend.

### 4.2 Sprint 1 — `auth-service`

**Objetivo:** reemplazar Supabase Auth direct + `manage-users` edge fn.

#### Subtareas

| # | Tarea | Días | Notas |
|---|---|---|---|
| 1.1 | Implementar `POST /v1/auth/login` y `POST /v1/auth/refresh` (wrappers sobre `supabase.auth.signInWithPassword` + admin client) | 1 | |
| 1.2 | Implementar `GET /v1/auth/me` (replica lógica `useAuth.tsx:49-86` — fetch user_roles, profiles, cliente_company_assignments) | 1.5 | Replica el ROLE_PRIORITY |
| 1.3 | Implementar `POST/PATCH/DELETE /v1/auth/users` (admin) — reemplaza `manage-users` actions `create`, `update_role`, `update_password`, `update_email`, `delete` | 2 | |
| 1.4 | Implementar `POST /v1/auth/cliente-users` + `GET` + `DELETE` — reemplaza actions `create_cliente`, `update_cliente_permission`, `remove_cliente_assignment`, `list_cliente_users` | 2 | |
| 1.5 | Implementar middleware `requireAuth`, `requireRole`, `canAccessClient` (ya en `packages/auth-middleware`) + tests | 1 | |
| 1.6 | Tests unitarios servicio (Vitest) — 70% coverage | 2 | |
| 1.7 | **Shadow test** en CI: comparar resultados de `POST /v1/auth/login` vs `supabase.auth.signInWithPassword` directo con mismos params | 1 | |
| 1.8 | Frontend: refactor `src/hooks/useAuth.tsx` para detectar `use_new_auth=true` → llamar API vs Supabase SDK | 1 | |
| 1.9 | Frontend: refactor `AdminUsers.tsx`, `SystemUsersTab.tsx`, `ClientUsersTab.tsx` para usar `coreApi.users.*` cuando flag activo | 2 | |
| 1.10 | **Cutover gradual:** | | |
|  | • Día 1-2: flag ON solo para 1 user (dev) en prod. Monitorear Sentry. | | |
|  | • Día 3-5: flag ON para 10% de users (admin/pm que dieron OK). | | |
|  | • Día 6: flag ON 100% si Sentry limpio. | | |
| 1.11 | Monitoreo post-cutover 7 días | 7d | Si 0 errores → cerrar sprint |
| 1.12 | Marcar `manage-users` edge fn como `@deprecated` (sigue funcionando, banner en logs) | 0.5 | |

#### Criterios de aceptación S1

- [ ] 10/10 endpoints de `auth-service` implementados y documentados con OpenAPI vivo.
- [ ] Tests pasan, coverage ≥ 70% en `services/`.
- [ ] Shadow test pasa: para 100 calls de prueba, 100% match entre endpoint nuevo y Supabase directo.
- [ ] Performance: `POST /v1/auth/login` p95 < 500ms; `GET /v1/auth/me` p95 < 200ms.
- [ ] Sentry: 0 errores únicos en 7 días post-cutover al 100%.
- [ ] Feature flag `use_new_auth` está ON para todos los users en producción.
- [ ] `manage-users` edge fn marcada como deprecada con banner pero sigue viva (fallback).

#### Rollback S1

Si Sentry detecta tasa de error > 0.5% en 1h post-cutover:
1. `vercel env update USE_NEW_AUTH=false` (o equivalente desde Dashboard).
2. Frontend lee el flag al siguiente refresh — vuelve a Supabase directo.
3. Tiempo a rollback: **< 5 minutos**.

### 4.3 Sprint 2 — `ai-gateway`

**Objetivo:** consolidar las 17 funciones IA en un servicio.

#### Por qué es rápido (1-2 sem)
- Las funciones IA ya son **HTTP endpoints** (`supabase.functions.invoke`). Solo cambia la URL.
- Anthropic ya está integrado (commit `05967e8`).
- No tocan estado transaccional — son pure functions.
- El shape de respuesta `{ result, usage }` ya está bien definido en `_shared/cors.ts`.

#### Subtareas

| # | Tarea | Días | Notas |
|---|---|---|---|
| 2.1 | Implementar `POST /v1/ai/case-strategy` + `/v1/ai/client-strategy` (las que ya usan `aiTool`) | 1 | |
| 2.2 | Implementar `POST /v1/ai/exec-chat` + `/v1/ai/pm-analysis` + `/v1/ai/sva-strategy` | 1 | |
| 2.3 | Implementar `POST /v1/ai/classify-tickets` + `/v1/ai/evaluate-compliance` + `/v1/ai/policy-assistant` | 1 | |
| 2.4 | Implementar `POST /v1/ai/forecast-sprint` + `/v1/ai/analyze-team-*` (4 endpoints) | 1 | |
| 2.5 | Implementar `POST /v1/ai/member-*` + `/v1/ai/mentor` + `/v1/ai/analyze-cv` + `/v1/ai/analyze-career-path` | 1.5 | |
| 2.6 | Implementar `POST /v1/ai/summarize-transcript` + `/v1/ai/parse-time-entry` + `/v1/ai/recommend-team` | 1 | |
| 2.7 | Rate limiting con Upstash Redis o Vercel KV (tabla §5.3 del diseño) | 0.5 | |
| 2.8 | Logging a `ai_usage_logs` con shape unificado (mismo de antes) | 0.5 | |
| 2.9 | Tests: contract test contra los OpenAPI specs | 1 | |
| 2.10 | Frontend: refactor `src/hooks/use{CaseStrategy, ClientStrategy, PMAnalysis, SVAStrategy, MemberAgent, PolicyAI}.ts` para usar `aiApi.*` cuando flag activo | 1 | |
| 2.11 | **Cutover:** flag-on gradual mismo patrón S1 (1 user → 10% → 100% en 5 días) | 5d | |
| 2.12 | Monitoreo 7 días | 7d | |
| 2.13 | Marcar las 17 edge functions IA como `@deprecated` | 0.5 | |

#### Criterios de aceptación S2

- [ ] 20/20 endpoints implementados.
- [ ] Shadow test: para cada endpoint, llamar al endpoint nuevo Y la edge function vieja con mismo input — comparar `result`. Tolerancia: `usage.total_tokens` puede variar ±20% (no determinístico). El `result` debe ser semánticamente equivalente.
- [ ] Performance: p95 < 5s para tool-use (case-strategy, client-strategy); p95 < 3s para chat (exec-chat).
- [ ] Rate limit hits: ≤ 2% del tráfico (si más, ajustar quotas).
- [ ] Costo Anthropic: monitorear en `ai_usage_logs` — debe estar dentro del rango histórico ± 20%.

### 4.4 Sprint 3 — `core-service` / subdominio Tickets (el más crítico)

**Objetivo:** migrar el dominio más usado del SVA. Es el sprint más largo porque concentra ~50% del tráfico y la lógica más compleja (reopens, SLA, decrypt, compliance, classify).

#### Subtareas

| # | Tarea | Días | Notas |
|---|---|---|---|
| 3.1 | Implementar `/v1/tickets` GET/POST/{id} GET/PATCH/DELETE — CRUD básico | 3 | El POST debe respetar el trigger BD `assign_ticket_consecutivos` |
| 3.2 | Implementar lógica de transiciones de estado — incluyendo detección automática de reopen y validación `BUSINESS_RULE_VIOLATION` | 2 | Sigue usando `set_reopen_metadata` + trigger BD |
| 3.3 | Implementar `/v1/tickets/{id}/reopens` + `/v1/tickets/{id}/reopen` (atajo) | 1.5 | |
| 3.4 | Implementar `/v1/tickets/{id}/subtasks` (CRUD) | 1 | |
| 3.5 | Implementar `/v1/tickets/{id}/notes` (CRUD) | 1 | |
| 3.6 | Implementar `/v1/tickets/{id}/decrypt` (port de `decrypt-ticket` edge fn — usa pgcrypto + audit) | 1 | |
| 3.7 | Implementar `/v1/tickets/sla-status`, `/v1/tickets/sla-summary`, `/v1/tickets/reopens-summary` — wrappers sobre RPCs SQL | 1 | |
| 3.8 | Tests unitarios + integration tests (contra Supabase staging) — 70% coverage | 3 | |
| 3.9 | **Shadow tests críticos:** crear ticket nuevo, transicionar a ENTREGADA, reopen — comparar resultado backend nuevo vs SDK directo | 2 | |
| 3.10 | Frontend: refactor `useSupportTickets.ts` (el más complejo del repo) | 3 | Mantiene compat con `useAllSupportTickets`, `useCreateSupportTicket`, `useUpdateSupportTicket`, `useDeleteSupportTicket`, `useDecryptTicket` |
| 3.11 | Frontend: refactor `useReopenTicket.ts`, `useTicketReopens.ts`, `useTicketsSLAStatus.ts`, `useSLASummary.ts`, `useSupportTicketDetails.ts`, `useTicketHistory.ts`, `useCaseStrategy.ts`, `useCaseCompliance.ts` | 2 | 8 hooks afectados |
| 3.12 | Frontend: validar que `SupportDashboard`, `TicketDetailSheet`, `OverdueTicketsSheet`, `SupportInbox`, `TeamScrumDashboard` funcionan idéntico | 2 | |
| 3.13 | **Cutover:** flag-on gradual (1 user → 1 cliente piloto → 50% → 100% en 7 días) — más lento porque es alto impacto | 7d | |
| 3.14 | Monitoreo 14 días post-cutover (más largo que otros sprints — es el dominio core) | 14d | |
| 3.15 | Deprecar edge fns: `decrypt-ticket`, `evaluate-case-compliance`, `policy-ai-assistant` (las migradas también a ai-gateway en S2 son IA, no aplican acá) | 0.5 | |

#### Criterios de aceptación S3

- [ ] 100% de endpoints del subdominio Tickets implementados.
- [ ] Coverage ≥ 70% en `apps/core-service/src/modules/tickets/`.
- [ ] Shadow tests al 100% match (excluyendo `updated_at` por timing).
- [ ] Performance: p95 < 250ms para `GET /v1/tickets`; p95 < 400ms para `POST/PATCH`.
- [ ] Smoke test post-cutover: crear ticket → asignar → cambiar estado → reopen — todo OK.
- [ ] Sentry: 0 errores nuevos en 14 días.
- [ ] `ai_usage_logs` no muestra anomalías por cambio de path de classify-tickets.

#### Rollback S3 (más detallado por ser crítico)

Si Sentry detecta:
- `INTERNAL_ERROR` rate > 0.5% en 1h, O
- `BUSINESS_RULE_VIOLATION` rate > 5% en 1h (puede indicar regresión en lógica de reopens), O
- p95 > 1s sostenido por 30 min:

1. Toggle `USE_NEW_TICKETS=false` en Vercel env vars del frontend.
2. Vercel rebuilds (~30s) y deploy automático.
3. **Tiempo a rollback: ~5 minutos.** El frontend vuelve a hablar directo con PostgREST.
4. Edge functions affected (`decrypt-ticket`, etc.) siguen activas porque no se eliminaron.

### 4.5 Sprints 4-7 — Resto del core-service

Estructura idéntica a S3 pero por subdominios menos críticos:

| Sprint | Subdominio | Duración | Endpoints aprox | Frontend hooks afectados |
|---|---|---|---|---|
| **S4** | Sprints / Tasks | 2 sem | 8 | `useTeamScrum`, `useScrum`, `useSprintCeremonies`, `useTaskDetails` |
| **S5** | Clients / Public | 2-3 sem | 12 (8 client + 4 public) | `useClients`, `useClientContracts`, `useClientStrategy`, `usePresentationData` |
| **S6** | Team & People | 2 sem | 5 | `useTeamMembers`, `useMyTeamMember`, `useMemberProfile`, `useMemberAgent`, `useTeamEngagement`, `useTeamSkills`, `useTimeTracking`, `useTimeAudit` |
| **S7** | Reporting + cleanup | 1-2 sem | 3 reporting + cleanup | `usePMAnalysis`, `useSVAStrategy`, `useAIUsageLogs` + remover residuos |

Cada uno con cutover gradual 5-7 días + monitoreo 7-14 días.

### 4.6 Sprint 8 — Cleanup final

**Objetivo:** retirar el camino legacy.

#### Subtareas

| # | Tarea | Días |
|---|---|---|
| 8.1 | Verificar que ningún flag `use_new_*` está en `false` en prod | 0.5 |
| 8.2 | Frontend: eliminar todo `supabase.from(...)` y `supabase.rpc(...)` — `grep` retorna 0 | 2 |
| 8.3 | Frontend: eliminar todos los hooks legacy (los que ya migraron a `apiClient`) | 2 |
| 8.4 | Frontend: simplificar `src/integrations/supabase/client.ts` para exponer solo `auth` + `storage` | 0.5 |
| 8.5 | Backend: eliminar deploy de las 17 edge fns IA (`reset-passwords`, `decrypt-ticket`, etc.) | 0.5 |
| 8.6 | Conservar Edge fns: solo `sync-devops` (porque vive bien donde está) | 0.5 |
| 8.7 | Documentar el nuevo estado en `ARCHITECTURE.md` y actualizar `README.md` | 1 |
| 8.8 | Retirar feature flags muertas del frontend | 0.5 |
| 8.9 | Stress test final + smoke test E2E con Playwright | 2 |
| 8.10 | Post-mortem / lessons learned doc | 1 |

#### Criterios de aceptación S8

- [ ] `grep -r "supabase\.from\|supabase\.rpc" sva-frontend/src` → 0 resultados.
- [ ] Solo `sync-devops` queda como edge function activa.
- [ ] Bundle del frontend pesa menos (sin SDK de PostgREST en runtime — solo auth/storage del SDK).
- [ ] Playwright E2E: 5/5 flows críticos passing.
- [ ] Stress test (`scripts/stress-test.mjs` adaptado): mantiene p95 < 300ms para reads, p99 < 1s.

---

## 5. Plan de cutover — template aplicable a cualquier servicio

Cada cutover sigue esta secuencia:

### 5.1 Pre-cutover (1-2 días antes)

| Check | Cómo verificar | Pasa si... |
|---|---|---|
| OpenAPI spec 100% implementado | `pnpm openapi-validate` en CI | Exit 0 |
| Tests al 70% en lógica de dominio | `pnpm test --coverage` | Coverage report ≥ 70% |
| Shadow tests passing | Job CI corre 50+ scenarios contra prod | 100% match (con tolerancia documentada por endpoint) |
| Performance p95 dentro de objetivo | Vercel Analytics + Sentry transaction trace | Confirmar con métricas reales 24h |
| Documentación de rollback escrita | PR review | Aprobado por 2 devs |
| Plan comunicado a stakeholders | Mensaje a Slack #sva-dev + email a COO | Acuse de recibo |

### 5.2 Cutover gradual (5-7 días)

| Día | % users con flag ON | Quién monitorea | Si OK pasa a... |
|---|---|---|---|
| Día 1 | 1 user (dev/QA en prod) | Dev owner del servicio | Día 2 |
| Día 2 | 1 cliente piloto (interno o el de menor riesgo) | Dev owner + 1 backup | Día 3 |
| Día 3 | 10% de users (excluyendo CEO/admin) | Dev owner + observa Sentry hourly | Día 5 |
| Día 5 | 50% | Dev owner + AWT informado | Día 7 |
| Día 7 | 100% | Dev owner | Cierre cutover |

**En cualquier paso, si Sentry detecta degradación → rollback inmediato.**

### 5.3 Post-cutover (7-14 días)

- **Día 1-7:** Sentry check diario. Métricas en Vercel Analytics. Cualquier user puede reportar via Slack.
- **Día 7:** post-mortem mini si hubo issues. Documentar lessons learned.
- **Día 14:** marcar el camino viejo (`supabase.from(...)` en hooks afectados) como `@deprecated` con comentario.

---

## 6. Feature flags — implementación

### 6.1 Mecanismo elegido

**Vercel Environment Variables** + un hook `useFeatureFlag` en el frontend.

```ts
// src/lib/feature-flags.ts
export const FLAGS = {
  use_new_auth: import.meta.env.VITE_FLAG_USE_NEW_AUTH === "true",
  use_new_ai: import.meta.env.VITE_FLAG_USE_NEW_AI === "true",
  use_new_tickets: import.meta.env.VITE_FLAG_USE_NEW_TICKETS === "true",
  use_new_sprints: import.meta.env.VITE_FLAG_USE_NEW_SPRINTS === "true",
  use_new_clients: import.meta.env.VITE_FLAG_USE_NEW_CLIENTS === "true",
  use_new_team: import.meta.env.VITE_FLAG_USE_NEW_TEAM === "true",
  use_new_reporting: import.meta.env.VITE_FLAG_USE_NEW_REPORTING === "true",
} as const;

export function useFeatureFlag(name: keyof typeof FLAGS): boolean {
  return FLAGS[name];
}
```

```ts
// Uso en un hook
import { useFeatureFlag } from "@/lib/feature-flags";

export function useSupportTickets() {
  const useNewBackend = useFeatureFlag("use_new_tickets");
  return useQuery({
    queryKey: ["tickets"],
    queryFn: () => useNewBackend
      ? coreApi.tickets.list()
      : supabase.from("support_tickets").select("*"),
  });
}
```

### 6.2 Por qué env vars y no LaunchDarkly / Posthog

- **Costo cero.**
- **Rollback en 5 min** vía Vercel CLI o Dashboard.
- **No requiere SDK adicional** que aumente bundle.
- **Suficiente para rollout binario por % de users:** Vercel permite distintos values por dominio (`sva.sysde.com` vs `staging.sva.sysde.com`). Para % gradual usamos un hash del user_id + threshold.

```ts
// Rollout gradual sin servicio externo
function isInRollout(userId: string, percentage: number): boolean {
  const hash = simpleHash(userId);
  return (hash % 100) < percentage;
}

// Override con env var: si VITE_FLAG_USE_NEW_TICKETS_ROLLOUT=50, 50% de users ven el flag ON
```

### 6.3 Limitaciones reconocidas

- Cambiar el % requiere redeploy (~30s en Vercel). Para emergencias, mejor usar `false` total.
- No hay UI para "encender flag a este user específico" — se hace con env var override en una preview branch.
- Si crece la complejidad de flags, **migrar a PostHog/Posthog feature flags** en Fase 5+ (no antes).

---

## 7. Validación de consistencia (shadow tests)

### 7.1 Patrón

Cada endpoint nuevo tiene un test que **ejecuta el endpoint Y el call directo a Supabase**, y compara los resultados:

```ts
// tests/shadow/tickets.shadow.test.ts
describe("Shadow: GET /v1/tickets", () => {
  it("returns same result as supabase.from('support_tickets').select()", async () => {
    const auth = await loginAs("admin@sysde.com");
    
    const fromApi = await coreApi.tickets.list(
      { client_id: "cfe", limit: 50 },
      { auth }
    );
    
    const fromSdk = await supabase
      .from("support_tickets")
      .select("*")
      .eq("client_id", "cfe")
      .limit(50);
    
    // Comparar ignorando timing fields
    expect(normalize(fromApi.items)).toEqual(normalize(fromSdk.data));
  });
  
  it("respects RLS for cliente role", async () => {
    const auth = await loginAs("cliente.cfe@sysde.com");
    
    const fromApi = await coreApi.tickets.list({}, { auth });
    
    // Cliente CFE solo debe ver tickets de CFE
    expect(fromApi.items.every(t => t.client_id === "cfe")).toBe(true);
  });
});
```

### 7.2 Scope mínimo de shadow tests por servicio

| Servicio | Scenarios obligatorios |
|---|---|
| `auth-service` | login admin, login cliente, /me admin, /me cliente, create user, update role, list cliente users |
| `ai-gateway` | (no aplica shadow strict — outputs no determinísticos. En su lugar: schema validation + estructura) |
| `core-service / tickets` | list as admin, list as gerente (con scope), list as cliente, create ticket, transition state, reopen, decrypt confidencial |
| `core-service / sprints` | list, create, start, complete, list tasks |
| `core-service / clients` | list, detail, create, share token |
| `core-service / team` | list members, time entries por week |
| `core-service / public` | acceso anónimo con token válido, token expirado |

### 7.3 Ejecución

- **En CI:** automatizado pre-merge.
- **Antes de cutover:** ejecutar contra producción (con flag de "shadow mode" que no escribe).
- **Post-cutover:** automático cada noche durante 30 días — alertar si divergence > 1%.

---

## 8. Métricas de éxito por sprint

### 8.1 Métricas técnicas (medibles automáticamente)

| Métrica | Cómo se mide | Threshold OK |
|---|---|---|
| Disponibilidad servicio | Vercel uptime monitor | ≥ 99.9% en 7d post-cutover |
| Error rate | Sentry `error_rate` | < 0.5% en cualquier hora |
| Latency p50 / p95 / p99 | Vercel Analytics + Sentry transactions | p95 < 300ms (reads), < 800ms (mutations); p99 < 2s |
| Shadow test match rate | CI job nightly | ≥ 99% match |
| Test coverage en lógica de dominio | Vitest coverage | ≥ 70% |
| Rate limit hits | Service log | < 2% del tráfico |

### 8.2 Métricas de negocio (medibles por sprint)

| Métrica | Antes | Después |
|---|---|---|
| Tiempo de implementación de feature nueva | TBD baseline | -20% target post-S7 |
| Defectos reportados por mes | TBD baseline (de Sentry actual) | No empeorar |
| Cobertura de tests global | 0% en hooks | ≥ 60% en hooks migrados |
| Bundle size frontend | ~600 KB inicial post-lazy | < 700 KB post-migración |
| Costo Anthropic mensual | TBD baseline (post-Fase 1 Anthropic migration) | No empeorar > 15% |

### 8.3 Métricas de proceso

- **Promedio de tiempo de cutover por servicio:** target 7 días (incluye rollout + monitoreo).
- **Cantidad de rollbacks ejecutados:** target ≤ 1 por sprint (rollbacks son señal de mala preparación).
- **PRs reviewed en < 24h:** ≥ 90%.

---

## 9. Riesgos del rollout y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | Refactor previo (S0.10) toma más que 5-8 días por descubrimiento de mayor acoplamiento que el medido | Media | Alto (atrasa todo) | Time-box: si en día 8 no se cerró, AWT decide entre extender vs migrar componentes-de-uno-en-uno paralelo a S1 |
| 2 | Trigger BD `assign_ticket_consecutivos` se comporta distinto desde backend vs frontend (different connection user) | Baja | Alto | Test específico en S3 para race condition con `pg_advisory_xact_lock` |
| 3 | RLS evalúa distinto cuando el backend hace queries con JWT del user vs frontend directo (improbable pero posible si hay extension lib) | Baja | Alto | Shadow tests específicos para casos de RLS (gerente con asignación, cliente externo, ceo) |
| 4 | Rate limit en `ai-gateway` mal calibrado bloquea a users legítimos | Media | Medio | Empezar con limits 2× generosos en S2; ajustar después de 7 días |
| 5 | `set_reopen_metadata` RPC se llama desde el backend pero el session config no llega al trigger (cambio de connection) | Media | Alto | Probar exhaustivamente en S3.9 antes del cutover; tener fallback que pase metadata vía columna temporal si falla |
| 6 | Costos Anthropic suben porque el backend no cachea bien el system prompt | Baja | Medio | Validar en S2: `usage.cache_read_input_tokens > 0` desde la 2da call |
| 7 | Vercel rate limits o cold starts en Edge Functions degradan UX | Baja | Medio | Probar en S0 con carga simulada de 100 req/s; fallback a Serverless Functions si necesario |
| 8 | Equipo se queda sin bandwidth para mantener ambos paths (legacy + nuevo) durante 4-5 meses | Alta | Alto | Mitigación organizacional: AWT debe proteger el equipo de feature requests durante este período. Si urge una feature, **se implementa en el path nuevo, no en el legacy.** |
| 9 | El frontend tiene componentes que no usan hooks y se omiten en el refactor S0.10 | Media | Medio | Grep automatizado en CI: `grep -r "supabase.from\|supabase.rpc" src/components/` → falla build si > 0 después de S0 |
| 10 | Schema cambios necesarios para nuevo feature mientras se migra → conflicto entre dev y migración | Media | Alto | Política congelamiento de schema durante S2-S7 excepto hotfixes. Features que requieren schema esperan a S8+ |

---

## 10. Plan de comunicación con stakeholders

| Audiencia | Frecuencia | Contenido | Canal |
|---|---|---|---|
| AWT (COO + decisor técnico) | Semanal | Sprint status, riesgos abiertos, decisiones pendientes | Email + Slack |
| Equipo de desarrollo | Diario | Stand-up: qué se hizo, qué se hará, blockers | Slack #sva-dev |
| Users internos (PMs, gerentes) | Antes de cada cutover | Heads-up: "el día X migramos auth — si ves comportamiento raro, avisar a #sva-dev" | Email |
| Clientes externos | Solo si cutover requiere mantenimiento (no aplicable aquí — zero downtime) | — | — |
| C-level | Mensual | KPIs progreso, % migrado, costos | Email |

---

## 11. Pre-mortem — "¿qué puede ir mal y cómo lo detectamos?"

| Falla imaginaria | Síntoma | Cómo detectarla | Reacción |
|---|---|---|---|
| Frontend pierde sesión al hacer login via auth-service nuevo | Users reportan "me sacó al login al recargar" | Sentry: spike de errores `UNAUTHORIZED` en frontend | Rollback `use_new_auth` |
| `coreApi.tickets.create` falla con duplicate consecutivo | Errores 409 `DUPLICATE_KEY` en logs | Service log + Sentry | Investigar trigger BD; mientras tanto rollback |
| `ai-gateway` devuelve respuestas con shape distinto al esperado | Frontend muestra "undefined" en lugar de análisis | Sentry frontend error spike | Rollback `use_new_ai` |
| RLS no permite a un gerente ver SU cliente porque backend pasa JWT mal | Gerente reporta "no veo mi cliente" | Sentry + reporte manual | Investigar JWT propagation; rollback servicio afectado |
| Costos Anthropic se duplican porque cache no funciona | Billing dashboard | Alert sobre `ai_usage_logs.cache_read_input_tokens / input_tokens` ratio | Investigar prompt building; rollback si urgente |
| Vercel rate-limit/quota de Edge Functions excedida | Errores 429 desde el frontend | Vercel dashboard + alert | Subir plan o mover a Serverless Functions |

---

## 12. Decisiones pendientes para AWT

Antes de empezar Fase 5, necesito tu firma sobre:

1. **Equipo asignado.** ¿Cuántos devs van a trabajar dedicados? El plan asume 1-3. Si SYSDE asigna 4+ devs, los sprints S3-S7 se pueden paralelizar y el total baja a 12-15 semanas en lugar de 15-22.

2. **Política de freeze de features durante la migración.** Item 10 en §9 (riesgos). ¿Aceptás que durante S2-S7 NO se implementan features nuevas en el path legacy? Si una feature urge, se implementa en el path nuevo (lo que puede atrasar 1-2 días el sprint correspondiente).

3. **Plan de comunicación con users internos.** Item §10. ¿OK con heads-up por email antes de cada cutover, o preferís otro canal?

4. **Owner técnico del rollout.** ¿Quién decide los rollbacks en horario fuera de oficina? Necesitamos UN owner principal con autoridad para `vercel env update` sin esperar approval.

5. **Rate limits iniciales de `ai-gateway`.** Propuse:
   - case-strategy / client-strategy: 10/hr/user
   - exec-chat: 50/hr/user
   - classify-tickets: 5/hr/user (batch)
   - analyze-*: 20/hr/user
   - parse-time-entry: 100/hr/user

   ¿Aceptás o conoces casos donde un user legítimo va a chocar con estos límites?

6. **Política de retención de feature flags.** Una vez que un flag está al 100% por 30 días, ¿lo eliminamos del código o lo dejamos un tiempo más por si rollback de emergencia?

---

## 13. Resumen ejecutivo del cronograma

| Hito | Cuándo (semana desde kick-off) | Qué cambia para el user final |
|---|---|---|
| **Inicio** | S0 | Nada — todo el trabajo es invisible |
| **Auth en producción** | S1 fin (~6 sem) | Login y admin users via backend nuevo. Apariencia idéntica |
| **IA en producción** | S2 fin (~8 sem) | Llamadas IA via backend nuevo. Apariencia idéntica, posiblemente más rápido |
| **Tickets en producción** | S3 fin (~12 sem) | El dominio más crítico migrado. Apariencia idéntica |
| **Sprints en producción** | S4 fin (~14 sem) | Scrum migrado |
| **Clients en producción** | S5 fin (~17 sem) | Implementación migrada |
| **Team + Reporting migrados** | S7 fin (~21 sem) | Todo el SVA via backend nuevo |
| **Cleanup completo** | S8 fin (~22 sem) | Edge functions desactivadas, frontend libre de PostgREST |

**Para el COO:** "el SVA va a estar 100% migrado a microservicios en 4-5 meses, con valor entregable cada 2-3 semanas. Cero downtime durante todo el proceso. Cualquier servicio puede revertirse en 5 minutos si algo va mal."

---

## ✋ Gate Fase 4 → Fase 5

Lo entregado: este documento (cronograma + plan de cutover + feature flags + shadow tests + riesgos).

**Preguntas para tu firma:**

1. ¿Apruebas el **orden de sprints** (Auth → AI → Tickets → Sprints → Clients → Team → Reporting → Cleanup)?
2. ¿Te suena el **cronograma 15-22 semanas** con 1-3 devs?
3. ¿Apruebas la **política de feature freeze** durante migración?
4. ¿Quién es el **owner técnico del rollout** con autoridad de rollback?
5. ¿Son razonables los **rate limits iniciales** de ai-gateway?
6. ¿Aceptás los **6 criterios de aceptación** definidos por sprint (coverage 70%, shadow tests match ≥99%, p95 latencies, error rate < 0.5%, Sentry 7d limpio, smoke E2E)?

---

**3 caminos para responderme:**

### Camino 1 — "Apruebo todo, sigue a Fase 5 (ejecución)"
Genero el resumen ejecutivo final (`00-resumen-ejecutivo.md`) que consolida todo, más opcionalmente comienzo el scaffolding del Sprint 0 en nuevos repos.

### Camino 2 — "Ajustá X antes de avanzar"
Cambios al cronograma, prioridades, rate limits, etc.

### Camino 3 — "Profundizá Z"
Ej: detalle más profundo del Sprint 3 (Tickets) que es el más complejo, o más detalle del refactor previo S0.10.

⏸️ **No avanzo a Fase 5 hasta tu firma.**

---

## Referencias cruzadas

| Documento | Estado |
|---|---|
| `01-diagnostico.md` | ✅ |
| `02-decisiones-arquitectonicas.md` | ✅ |
| `03-diseno-arquitectura.md` | ✅ |
| `contracts/auth-service/openapi.yaml` | ✅ |
| `contracts/ai-gateway/openapi.yaml` | ✅ |
| `contracts/core-service/openapi.yaml` | ✅ |
| `contracts/events/README.md` | ✅ |
| **`04-plan-migracion.md`** | **Este** |
| `00-resumen-ejecutivo.md` | Pendiente — consolida los anteriores |
