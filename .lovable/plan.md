

El usuario quiere un documento de arquitectura nivel "arquitecto experto" — más profundo que el anterior. Debe incluir patrones, decisiones técnicas, trade-offs, capas, flujos secuenciales, modelo de datos completo con relaciones, seguridad, observabilidad, escalabilidad, y diagramas múltiples.

## Plan: Arquitectura Empresarial Detallada de Sysde Support

Voy a generar **4 artefactos** en `/mnt/documents/` con nivel de arquitecto de software senior.

### 1. `Sysde_Architecture_v2.md` — Documento técnico ejecutivo (~25-30 páginas)

**Capítulo 1 — Visión y contexto (C4 nivel 1)**
- Propósito de la plataforma, stakeholders, dominios de negocio (Implementación, Soporte, Equipo Interno)
- Diagrama de contexto: usuarios externos (gerentes cliente vía link público) + internos (admin/pm/colaborador) + sistemas externos (Azure DevOps, Lovable AI Gateway)

**Capítulo 2 — Arquitectura lógica (C4 nivel 2: Containers)**
- SPA React (Vite) → Supabase JS Client → PostgREST/Auth/Realtime/Storage
- Edge Functions Deno (BFF para IA + integraciones)
- AI Gateway como dependencia externa con fallback
- Patrón: **JAMstack + BaaS + serverless functions** (no servidor propio)

**Capítulo 3 — Arquitectura de componentes (C4 nivel 3)**
Por cada módulo: componentes React + hooks TanStack Query + tablas Supabase + edge functions involucradas. Módulos:
- Auth/RBAC, Implementación, Soporte, Scrum unificado, Team Hub, Time Tracking, AI Agents, Engagement, Admin

**Capítulo 4 — Modelo de datos completo**
- Agrupado por bounded context (DDD)
- Tablas con PK/FK lógicas (aunque sin FKs físicas en muchos casos — anotar deuda técnica)
- Convenciones: `client_id text` como tenant key, `original_id` para idempotencia, JSONB para configs flexibles
- Diagrama ERD por dominio

**Capítulo 5 — Seguridad y RBAC**
- 4 roles + tabla `user_roles` + función `has_role()` SECURITY DEFINER (anti-recursión RLS)
- Patrones RLS observados: "public allow all" (deuda) vs "role-gated" (correcto)
- **Hallazgo crítico**: muchas tablas tienen RLS permisiva (`USING true`) — riesgo documentado
- Flujo de sesión: sessionStorage flag + auto-signOut en pestaña nueva (decisión de UX)

**Capítulo 6 — Integraciones externas**
- **Azure DevOps**: bidireccional pull/push, mapping `devops_sync_mappings`, logs `devops_sync_logs`, secret `AZURE_DEVOPS_PAT`
- **Lovable AI Gateway**: 17 edge functions, modelos Gemini/GPT, manejo de 429/402, logs en `ai_usage_logs`

**Capítulo 7 — Patrones y convenciones**
- Single Source of Truth (Supabase)
- TanStack Query como cache layer (invalidaciones por mutación)
- `.maybeSingle()` siempre, `null` nunca `undefined`
- Optimistic updates donde aplica
- Multi-tenancy por `client_id`

**Capítulo 8 — Calidad, observabilidad, deuda técnica**
- Logs: `ai_usage_logs`, `devops_sync_logs`, `user_activity_log`, `user_sessions` (heartbeat 60s)
- Tests: Vitest configurado, cobertura mínima
- Deuda: RLS permisiva, sin FKs físicas, sin migrations versionadas localmente
- Roadmap de hardening sugerido

**Capítulo 9 — Decisiones arquitectónicas (ADRs cortos)**
- ADR-001: Por qué Supabase BaaS en vez de backend propio
- ADR-002: Edge Functions Deno vs API REST tradicional
- ADR-003: AI Gateway centralizado vs OpenAI directo
- ADR-004: Roles en tabla separada (anti privilege escalation)
- ADR-005: Multi-tenancy lógica vía `client_id` (no schemas separados)

### 2. `Sysde_C4_Context.mmd` — Diagrama C4 nivel 1 (contexto)
### 3. `Sysde_C4_Containers.mmd` — Diagrama C4 nivel 2 (containers)
### 4. `Sysde_DataFlow_Sequences.mmd` — Diagramas de secuencia de 4 flujos críticos:
- Login + carga de rol
- Pull WSJF item → sprint con sync DevOps
- Chat agente IA con contexto
- Compartir minuta con cliente externo

### Tareas
1. Inspeccionar rápidamente edge functions, hooks clave (`useScrum`, `useDevOps`, `useTimeTracking`) y `AppSidebar` para confirmar nombres
2. Generar los 4 archivos en `/mnt/documents/`
3. QA: renderizar los 3 `.mmd` a PNG y revisar legibilidad
4. Emitir tags `<lov-artifact>` para descarga

Sin cambios de código ni DB.

