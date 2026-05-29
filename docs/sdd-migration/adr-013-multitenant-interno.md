# ADR-013 — Multitenant Interno (Lectura A)

| | |
|---|---|
| **Estado** | **Propuesta — en revisión por AWT** (firma pendiente). Al firmar, cambiar a `Aceptada (2026-05-16)` |
| **Producido** | 2026-05-16 |
| **Decisión origen** | AWT firma "Multitenant Interno (Lectura A) + microservicios" en gate F4→F5 |
| **Prerequisito de** | Sprint 0 del plan F4 — no se puede iniciar scaffolding sin esta ADR firmada |
| **Conflictos con F1-F4 detectados** | Ver §Hallazgos al final — extensiones, no conflictos |
| **Format** | Idéntico a ADR-001 a ADR-012 (`02-decisiones-arquitectonicas.md`) |

---

## Contexto

### Estado actual (single-tenant implícito)
El SVA opera hoy como **single-tenant implícito**: un solo deployment (`qorixnxlaiuyxoentrfa.supabase.co`), una sola base de datos, **85 tablas en schema `public`** (verificado contra ARCH.md §7.1 listado real, 2026-05-16). Los "clientes" del SVA (CFE Panamá, CMI, Apex, Dos Pinos, etc.) son **datos** dentro del sistema — empresas que SYSDE atiende — NO tenants en el sentido arquitectónico.

### Por qué surge la necesidad de multitenant
AWT firma el 2026-05-16:
- Microservicios confirmado (F1-F4 firmadas).
- **Multitenant interno (Lectura A)** — preparar el SVA para soportar **otras organizaciones del Grupo Gurunet** (SYSDE, Lanvine, iGD, Mobtion, Optec, Gurunet/FileMaster) compartiendo el mismo deployment con aislamiento estricto de datos.
- NO es SaaS comercial — no se ofrece el SVA a clientes externos como producto SaaS.

### Definición operativa de "tenant"
Un **tenant** = una organización del Grupo Gurunet operando su propia instancia lógica del SVA. Identificador `tenant_id text` (ej: `sysde`, `lanvine`, `igd`, `mobtion`, `optec`, `gurunet`).

✅ **Firma AWT 2026-05-16:** **solo `sysde` se crea en Sprint 0.** Los demás tenants del Grupo Gurunet (lanvine, igd, mobtion, optec, gurunet) se incorporan **post-migración** según prioridad del Grupo, no son alcance de la migración inicial.

### Roles cross-tenant — `super_admin`

✅ **Firma AWT 2026-05-16:** existe el rol `super_admin` como rol separado de `admin`:

| Rol | Scope | Quién |
|---|---|---|
| `super_admin` | Cross-tenant (lee/escribe todos los tenants) | **Solo AWT y Mafe** |
| `admin` | Dentro de UN tenant — el del JWT | Admins de cada tenant (Carlos Castante en SYSDE, etc.) |

El claim JWT lo distingue:
```json
{
  "app_metadata": {
    "tenant_id": "sysde",
    "super_admin": true        // ← presente solo en AWT y Mafe
  }
}
```

Helper SQL `is_super_admin()` lee del JWT (NO de `user_roles`) — esto evita lookup adicional y queda ligado al ciclo de vida del token.

> ⚠️ El rol `super_admin` **NO se enumera en el enum `app_role`** existente. Se maneja como flag separado en `app_metadata` porque su semántica es "bypass de tenant filter", no "rol dentro de un tenant". Las policies RLS hacen `OR is_super_admin()` para permitir el bypass.

---

## Decisión

Se adopta el patrón **Shared Database, Shared Schema con `tenant_id` como discriminator**, reforzado por RLS estricta.

### Las 4 piezas concretas

1. **Tabla nueva `tenants`** — catálogo de organizaciones del grupo:
   ```sql
   CREATE TABLE public.tenants (
     id text PRIMARY KEY,                    -- 'sysde', 'lanvine', etc.
     name text NOT NULL,                     -- 'SYSDE Internacional'
     parent_org text DEFAULT 'gurunet',      -- todos pertenecen a Grupo Gurunet
     is_active boolean NOT NULL DEFAULT true,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   INSERT INTO public.tenants (id, name) VALUES ('sysde', 'SYSDE Internacional');
   ```

2. **Columna `tenant_id text NOT NULL REFERENCES public.tenants(id)` en ~60 tablas** (ver tabla §Impacto en las tablas más abajo). Default `'sysde'` para todo el backfill — la data actual es 100% SYSDE.

3. **Helper SQL `current_tenant()` SECURITY DEFINER**:
   ```sql
   CREATE OR REPLACE FUNCTION public.current_tenant()
   RETURNS text
   LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = public
   AS $$
     SELECT COALESCE(
       auth.jwt() -> 'app_metadata' ->> 'tenant_id',
       'sysde'  -- fallback histórico — alertable en logs
     );
   $$;
   ```
   El `tenant_id` viaja en el JWT como `app_metadata.tenant_id` (set por trigger `handle_new_user` extendido o por `manage-users` endpoint en `auth-service`).

4. **RLS reforzada** — toda policy de tabla con `tenant_id` agrega cláusula `AND tabla.tenant_id = current_tenant()` a las existentes. **No se elimina ninguna policy actual.** Las policies actuales (scope cliente/gerente/staff) **siguen vigentes como segunda línea de defensa** — la primera línea ahora es tenant_id.

---

## Impacto en las 87 tablas (totales post-ADR-13)

Inventario real consolidado desde F1 (grep `CREATE TABLE` en las 98 migraciones de `supabase/migrations/`). Clasificación por categoría:

### Categoría A — Llevan `tenant_id NOT NULL` (83 tablas, post-firma AWT)

| Bounded context | Tablas | Justificación |
|---|---|---|
| **Auth** (5) | `profiles`, `sysde_team_members`, `cliente_company_assignments`, `gerente_client_assignments`, **`user_roles`** ← firma AWT | Cada user pertenece a UN tenant; sus roles también. |
| **Tickets** (13) | `support_tickets`, `support_ticket_reopens`, `support_ticket_subtasks`, `support_ticket_notes`, `support_ticket_tags`, `support_ticket_attachments`, `support_ticket_dependencies`, `ticket_access_log`, `case_compliance`, `shared_ticket_history`, `client_rule_overrides`, `support_data_updates`, **`business_rules`** ← firma AWT | Data operacional + política normativa por tenant. Cada tenant del Grupo Gurunet puede tener su propia v4.5. |
| **Scrum** (10) | `support_sprints`, `tasks`, `task_history`, `task_subtasks`, `task_dependencies`, `task_tags`, `task_attachments`, `sprint_dailies`, `sprint_retrospectives`, `sprint_reviews` | Idem tickets — sprints y tasks son por cliente/tenant. |
| **Clients** (12) | `clients`, `client_contracts`, `client_slas`, `client_financials`, `client_contacts`, `client_team_members`, `phases`, `deliverables`, `action_items`, `meeting_minutes`, `risks`, `comments` | Los clientes que cada tenant atiende son distintos. CFE es de SYSDE; Lanvine podría tener otros. |
| **Team** (18) | `team_member_skills`, `team_member_certifications`, `team_member_capacity`, `team_career_paths`, `team_onboarding`, `team_kudos`, `team_member_badges`, `team_time_off`, `learning_enrollments`, `work_time_entries`, `time_entry_audit_log`, `time_weekly_locks`, `time_tracking_goals`, `member_ai_agents`, `member_ai_conversations`, `mentor_conversations`, `member_ai_digests`, **`work_goals`** ← agregada en v3 desde ARCH.md §7.1 (ver Apéndice) | Cada tenant tiene su propio equipo, horas, skills y goals. Catálogos globales (`learning_courses`, `team_badges`) se separan en B. |
| **AI** (3) | `ai_usage_logs`, `pm_ai_analysis`, **`policy_ai_settings`** ← firma AWT | `ai_usage_logs` para billing por tenant. `pm_ai_analysis` outputs IA por portafolio. `policy_ai_settings` configura prompts/modelos por tenant. |
| **Notifications** (4) | `email_notifications`, `client_notifications`, `user_notifications`, `mentions` | Notificaciones y menciones son tenant-scoped. |
| **Integrations** (3) | `devops_sync_mappings`, `devops_sync_logs`, `devops_connections` | Cada tenant configura su propia conexión a Azure DevOps. |
| **Cross-cutting** (15) | `user_saved_views`, `user_activity_log`, `user_sessions`, `client_dashboard_config`, `colaborador_dashboard_layouts`, `communication_threads`, `thread_messages`, `message_reactions`, `shared_presentations`, `shared_support_presentations`, `presentation_data`, `presentation_feedback`, `support_minutes`, `support_minutes_feedback`, `support_presentation_feedback` | UI state, comms y sharing son tenant-scoped. |

**Subtotal: 83 tablas con `tenant_id`** (= 5+13+10+12+**18**+3+4+3+15).

> Notas:
> - `mentions` se movió de Cross-cutting → Notifications (afinidad funcional). El conteo total no cambia.
> - `work_goals` agregada en v3 al subgrupo Team (proviene de ARCH.md §7.1 DevOps/Misc — única tabla del listado oficial que faltaba en ADR-13 v1/v2).

### Categoría B — Catálogos globales SIN `tenant_id` (3 tablas)

| Tabla | Justificación |
|---|---|
| `learning_courses` | Catálogo de cursos compartibles entre tenants del grupo (ej: curso de Compliance v4.5, curso de Onboarding general). `learning_enrollments` (categoría A) sí lleva tenant_id. |
| `team_badges` | Catálogo de badges/reconocimientos compartibles. `team_member_badges` (categoría A) sí lleva tenant_id. |
| `tenants` | El propio catálogo de tenants. Solo super_admin puede leerla/escribirla. |

**Subtotal: 3 tablas globales.**

> ✅ **Firma AWT 2026-05-16:** `business_rules` movida de Categoría B → **Categoría A** (lleva `tenant_id`). Seed inicial: todos los rows actuales reciben `tenant_id='sysde'`. Esto significa que cada tenant del Grupo Gurunet **puede tener su propia política normativa**, no comparten una global. Si en el futuro AWT define una base v4.5 compartida, se replica como seed en cada tenant nuevo.

### Categoría C — ~~Pendiente decisión de AWT~~ (0 tablas tras firma AWT)

✅ **Firma AWT 2026-05-16:** las 2 tablas pendientes pasan a **Categoría A**:
- `user_roles` → A. Un user, un tenant, sus roles. Si un dev de SYSDE necesita acceso a Lanvine, es OTRO user con otro JWT.
- `policy_ai_settings` → A. Cada tenant configura sus propios prompts/modelos.

La vista `support_reopens_summary` **no es tabla** — se reescribe para filtrar `WHERE tenant_id = current_tenant()` manteniendo `security_invoker=on`. No cuenta en el inventario de tablas.

**Subtotal: 0 tablas con decisión pendiente.**

### Categoría D — Managed by Supabase (1 tabla)

| Tabla | Tratamiento |
|---|---|
| `auth.users` | No la tocamos directamente. El `tenant_id` se almacena en `auth.users.raw_app_meta_data` (jsonb) → expuesto al JWT como `app_metadata.tenant_id`. El campo se setea via `supabase.auth.admin.updateUserById(id, { app_metadata: { tenant_id } })` desde `auth-service` o trigger `handle_new_user`. |

---

### Resumen impacto tablas (post-firma AWT 2026-05-16)

| Categoría | Tablas | Acción |
|---|---|---|
| A — Lleva `tenant_id` | **83** | Migration: `ALTER TABLE x ADD COLUMN tenant_id text NOT NULL DEFAULT 'sysde'` + `REFERENCES tenants(id)`. **+3 desde Cat B/C: business_rules, user_roles, policy_ai_settings. +1 desde ARCH.md §7.1: work_goals.** |
| B — Catálogo global | **3** | `learning_courses`, `team_badges`, `tenants`. Sin cambios estructurales. Documentar como "shared catalog". |
| C — Pendiente | **0** | Resuelto en firma AWT 2026-05-16. |
| D — Supabase managed | **1** | `auth.users` — set tenant_id via `app_metadata` en JWT. |
| **Total clasificado** | **87 tablas** | Reconciliación: 85 listadas en ARCH.md §7.1 + 1 (`auth.users` schema auth) + 1 (`tenants` nueva a crear en Sprint 0). Verificación: 83+3+0+1=87. |

---

## Impacto en RLS

### Helpers SQL nuevos (3)

```sql
-- 1. Lee tenant del JWT
CREATE FUNCTION public.current_tenant() RETURNS text ...

-- 2. Boolean check
CREATE FUNCTION public.is_same_tenant(_tenant_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT _tenant_id = public.current_tenant();
$$;

-- 3. Super-admin check (para operaciones cross-tenant)
CREATE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;
```

### Helpers SQL existentes a extender (5)

| Helper actual | Cambio |
|---|---|
| `has_role(_user_id, _role)` | Sin cambio en la firma, pero el `user_roles` filter implícitamente respeta tenant porque `user_roles.tenant_id = current_tenant()` (categoría A). |
| `is_staff_user(_user_id)` | Idem — implícito por tenant. |
| `is_cliente_user()`, `is_ceo_user()`, `is_gerente_soporte_user()` | Idem — implícito. |
| `user_can_see_client(_client_id text, _user_id uuid)` | Agregar AND check: `clients.tenant_id = current_tenant()`. Ya filtraba por scope cliente/gerente; ahora también filtra por tenant. |
| `get_cliente_client_id(_user_id)` | Idem — implícito porque `cliente_company_assignments.tenant_id = current_tenant()`. |

### Policies a modificar (~30)

Todas las policies que actualmente usan `is_staff_user()`, `user_can_see_client()`, `has_role()` siguen vigentes. **No se reescriben.** Solo se agrega una **policy adicional** que exige `tenant_id = current_tenant()`. Esto significa que cada tabla con tenant_id va a tener:

- Policy original (`Scoped select tabla` por rol/cliente/staff) — mantenida.
- Policy nueva (`Tenant isolation tabla`) — nueva, con `USING (tenant_id = current_tenant())`.

Postgres aplica policies como **AND** entre ellas para SELECT/UPDATE/DELETE (el resultado es la intersección), excepto en INSERT donde es OR para múltiples policies del mismo comando. **Cuidado en INSERT:** las policies de INSERT tienen que combinar tenant + rol en UNA sola policy, no dos separadas. Esto se valida en shadow tests con 2 tenants seed.

### Policies nuevas a crear (83, una por tabla en categoría A)

```sql
-- Plantilla
CREATE POLICY "Tenant isolation support_tickets" ON public.support_tickets
  FOR ALL
  USING (tenant_id = public.current_tenant() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant() OR public.is_super_admin());
```

### Total impacto RLS

| Acción | Cantidad |
|---|---|
| Policies nuevas creadas | **83** (una por tabla categoría A) |
| Policies modificadas | **0** — se mantienen como están |
| Policies eliminadas | **0** |
| Helpers nuevos | **3** |
| Helpers modificados | **0** (la lógica nueva es implícita porque `user_roles`, `gerente_client_assignments`, etc. también filtran por tenant) |

---

## Impacto en los 3 OpenAPIs firmados (F3)

### `contracts/auth-service/openapi.yaml`

| Endpoint | Cambio |
|---|---|
| `POST /v1/auth/login` | Response `LoginResponse.user` agrega field `tenant_id: string`. JWT incluye `app_metadata.tenant_id` (custom claim). |
| `GET /v1/auth/me` | Response `User` agrega `tenant_id: string`. |
| `POST /v1/auth/users` (admin) | Request `CreateUserRequest` agrega `tenant_id: string` (default = tenant del admin que llama; super-admin puede setear otro). |
| `POST /v1/auth/cliente-users` (admin/pm) | Idem — `tenant_id` se hereda del cliente al que se asigna. |
| **Nuevo endpoint** | `POST /v1/auth/tenants` — CRUD de tenants. Solo `super_admin`. |
| **Nuevo endpoint** | `GET /v1/auth/tenants` — lista tenants visibles (admin ve solo el suyo; super_admin ve todos). |
| Schema `User` | Agrega `tenant_id` obligatorio. |
| Schema nuevo `Tenant` | `{ id, name, parent_org, is_active, created_at }`. |
| Schema `AppRole` | Agrega valor `super_admin` (rol nuevo cross-tenant). |

### `contracts/ai-gateway/openapi.yaml`

| Cambio | Detalle |
|---|---|
| Headers | Agregar `X-Tenant-Id` opcional en request (debugging). Si no se manda, se infiere del JWT. Si se manda distinto al del JWT → 403 `FORBIDDEN_TENANT`. |
| Endpoints | **Sin cambios estructurales** — el `tenant_id` se propaga por JWT a las queries internas que el AI service hace para construir el contexto. |
| Tabla `ai_usage_logs` | Ahora persiste `tenant_id` → permite reportes de costo IA por tenant. |
| Rate limits | Continúan siendo por user, pero ahora **también por tenant** (ej: 10k tokens/día/tenant) para evitar que un tenant consuma toda la quota del proveedor. |
| `ErrorEnvelope.error.code` | Agrega `FORBIDDEN_TENANT` (mismatch entre header y JWT). |

### `contracts/core-service/openapi.yaml`

| Cambio | Detalle |
|---|---|
| Auth implícita | Todas las queries derivan tenant_id del JWT. Cero cambio en URL paths. |
| Headers de respuesta | Agregar `X-Tenant-Id` echo (debugging cross-service). |
| Endpoints `GET /v1/{tickets,sprints,clients,team,reporting}/*` | Devuelven solo data del tenant del JWT. RLS hace el filtro. |
| Endpoints públicos `/v1/public/*` | El **token** público del recurso incluye tenant_id encriptado. Al validar el token, el servicio setea `current_tenant()` via session config o reconstruye el JWT temporal. |
| Endpoint nuevo (super_admin) | `GET /v1/admin/cross-tenant/summary` — reportes consolidados del Grupo Gurunet. |
| `ErrorEnvelope.error.code` | Agrega `FORBIDDEN_TENANT`. |

### Catálogo de eventos (`contracts/events/README.md`)

Cada evento agrega field `tenant_id` en el payload `data.tenant_id` para que los consumers puedan rutear/filtrar. Schema bump de v1 → v2 NO requerido porque agregar campo opcional al envelope `data` es compatible (regla en `events/README.md §4`).

---

## Estimación Sprint 0 (post-ADR-13)

| Tarea | Story Points | Días/persona | Notas |
|---|---|---|---|
| Migration: crear tabla `tenants` + seed `sysde` | 2 | 0.5 | |
| Funciones SQL `current_tenant()`, `is_same_tenant()`, `is_super_admin()` | 5 | 2 | + tests |
| Migration: agregar `tenant_id text NOT NULL DEFAULT 'sysde'` a 83 tablas (categoría A) | 8 | 3 | Idempotente. Backfill automático. |
| Migration: agregar 83 policies "Tenant isolation X" | 13 | 5 | Plantilla repetitiva pero alta atención al detalle por INSERT semantics. |
| Migration: modificar `auth.users.raw_app_meta_data` para incluir `tenant_id='sysde'` en todos los users existentes | 2 | 0.5 | Una sola UPDATE masiva. |
| Trigger `handle_new_user()` extendido — setea `tenant_id` en `app_metadata` | 3 | 1 | Toma el tenant del user que creó (admin que invitó). |
| Adaptar `auth-service` (cuando exista) middleware para validar `X-Tenant-Id` vs JWT | 3 | 1 | En Sprint 1 cuando se escriba el servicio. |
| Update OpenAPI specs (3 archivos) | 3 | 1 | |
| Update catálogo eventos `events/README.md` v1 — agregar `tenant_id` al payload | 1 | 0.25 | |
| Tests: crear tenant seed `qa-multi-tenant` + shadow tests con 2 tenants | 8 | 3 | **Crítico — sin esto el riesgo de leakage es alto.** |
| Doc operativo: "Cómo crear un nuevo tenant" (runbook) | 2 | 0.5 | En `sva-backend/docs/runbooks/`. |
| Code review intensivo (2 devs revisan cada PR de RLS) | — | +20% sobrecarga | Política, no tarea. |
| **Subtotal** | **50 SP** | **~18 días/persona** | Asume 1 dev senior dedicado. |

### Cómo se integra al cronograma F4 (18-22 semanas firmado)

Sprint 0 original (F4 §4.1): **1-2 semanas** = 5-10 días/persona.

Sprint 0 con ADR-13: **5-10 días originales + 18 días/persona ADR-13** = **23-28 días/persona** = **~5 semanas con 1 dev** o **~3 semanas con 2 devs**.

El ajuste de cronograma firmado por AWT (15-22 → 18-22 sem) **absorbe estos ~18 días extra**. Cronograma final:

| Sprint | F4 original | F4 + ADR-13 |
|---|---|---|
| S0 Foundation | 1-2 sem | **3-5 sem** ← incluye multitenant |
| S1 auth-service | 2-3 sem | 2-3 sem (sin cambio — patrón ya está) |
| S2 ai-gateway | 1-2 sem | 1-2 sem |
| S3-S7 core-service por subdominio | 9-12 sem | 9-12 sem |
| S8 Cleanup | 1-2 sem | 1-2 sem |
| **Total** | **14-22 sem** | **17-26 sem** (rango firmado 18-22) |

El rango 18-22 sem firmado por AWT es realista solo si hay **≥2 devs trabajando S0 en paralelo** o si algunas tareas de S1 se solapan con final de S0.

---

## Alternativas consideradas

### Lectura B — SaaS comercial puro (descartada por AWT)

**Patrón:** tenant-per-database. Cada tenant tiene su propio Supabase project (`qorixnxlaiuyxoentrfa-sysde`, `qorixnxlaiuyxoentrfa-lanvine`, etc.) o su propio schema en un Postgres compartido. Onboarding self-service con UI.

**Pro:** aislamiento absoluto a nivel infraestructura. Cero riesgo de leakage por bug en RLS.

**Contra (razón de descarte):**
- 6× operaciones (4 backups, 4 monitorings, 4 migrations por tenant).
- AWT confirmó "NO es SaaS comercial" — el SVA es para uso interno del Grupo Gurunet, no se vende a externos.
- Onboarding self-service requiere portal de signup, billing, webhook providers — overhead significativo sin retorno.

### Lectura C — Híbrido schema-per-tenant (descartada)

**Patrón:** un solo Supabase, pero un schema Postgres por tenant: `sysde.support_tickets`, `lanvine.support_tickets`, etc. RLS sigue siendo por rol pero el aislamiento de tenant es por `SET search_path`.

**Pro:** aislamiento más fuerte que tenant_id column. Las queries `SELECT * FROM support_tickets` físicamente no pueden leer otro tenant.

**Contra (razón de descarte):**
- Cada migration corre N veces (una por schema). Para 6 tenants potenciales del Grupo Gurunet, esto es 6× la carga de migraciones.
- PostgREST no soporta multi-schema cleanly — habría que hacer un proxy de schema-routing en el backend.
- Reportes cross-tenant (super_admin) requieren UNIONs explícitas en lugar de queries naturales.
- El beneficio "aislamiento físico de schema" no justifica el costo cuando RLS strict (Lectura A) ya da aislamiento adecuado, y el deployment es interno con código revisado.

### Lectura A (elegida) — Shared schema + tenant_id column + RLS reforzada

**Pro:**
- Mínimo cambio de infraestructura — el deployment, backup, monitoreo siguen siendo uno.
- Migraciones corren una sola vez.
- Reportes cross-tenant son queries naturales con role `super_admin`.
- Patrón estándar de la industria — bien documentado, herramientas de auditoría disponibles.

**Contra:**
- Riesgo de leakage si un bug en RLS o en `current_tenant()`. Mitigación: shadow tests con 2 tenants seed obligatorios.
- Cada query agrega una condición más (`AND tenant_id = X`) → impacto leve en índices.

---

## Consecuencias

### Se vuelve más fácil

- **Onboarding de nuevo tenant del Grupo Gurunet:** ~5 minutos. `INSERT INTO tenants ...` + crear primer admin user con `app_metadata.tenant_id = nuevo_tenant`.
- **Reportes cross-tenant (super_admin):** un solo Postgres con queries naturales — el C-level del Grupo Gurunet puede ver consolidados de todas las orgas.
- **Migraciones:** una sola corrida cubre todos los tenants. Mantiene la cadencia actual.
- **Costo:** sin overhead operacional adicional. Sigue siendo el mismo proyecto Supabase.
- **Disaster recovery:** un solo backup, un solo plan de recuperación.

### Se vuelve más difícil

- **Disciplina de RLS:** cualquier nuevo endpoint o RPC debe verificarse contra el patrón "filtrar por tenant_id". Política: PRs que tocan RLS requieren 2 reviewers.
- **Índices:** todos los índices compuestos de las 83 tablas deben empezar con `tenant_id` para queries eficientes (ej: `(tenant_id, client_id, fecha_registro)` en lugar de `(client_id, fecha_registro)`). Esto puede requerir DROP+CREATE de índices existentes en una migración separada — **bullet de cuidado en Sprint 0**.
- **Test surface:** los shadow tests duplican (un set por tenant) — esto agrega ~1.5× el tiempo de CI.
- **Queries cross-tenant:** super_admin necesita bypass explícito via `is_super_admin()` en cada policy — código defensivo.

### Riesgo aceptado

**Leakage entre tenants por bug en RLS o en `current_tenant()`.** Mitigaciones obligatorias:

1. **Shadow tests con 2 tenants seed** (`sysde` + `qa-multi-tenant`) — cualquier deploy de schema debe pasar tests que verifiquen "user de SYSDE no puede leer data de qa-multi-tenant y viceversa".
2. **2 reviewers obligatorios en PRs que toquen RLS o helpers SQL.**
3. **Alerta en logs si `current_tenant()` devuelve el fallback `'sysde'`** porque significa que el JWT no tiene el claim — bug crítico.
4. **Auditoría trimestral** de policies por un tercero (puede ser AWT o un dev externo) — checklist documentado en `sva-backend/docs/runbooks/multitenant-audit.md`.

---

## Hallazgos — conflictos / extensiones con F1-F4

> Por instrucción del prompt AWT del 2026-05-16: reportar conflictos sin resolverlos unilateralmente. **6 hallazgos** (el #1 original "staffing Sprint 0" se reclasificó a §Checklist para AWT como decisión pendiente #7 — no es hallazgo, es gate).

### Hallazgo 1 — F3 §4.1 `sva-frontend.src/lib/api/generated/` ahora propaga `tenant_id`
El client TypeScript autogenerado desde los OpenAPI specs (F3 §8 "Generación del frontend client desde OpenAPI") ahora incluye `tenant_id` en los responses de `auth-service`. El frontend debe:
- Cachear `tenant_id` en el `AuthProvider` (mismo lugar que `role` actualmente).
- Mostrarlo en topbar (ej: badge "SYSDE" / "LANVINE") para que el usuario sepa en qué tenant está operando.
- Esto es **trabajo extra en Sprint 1** del frontend (~1-2 días).

### Hallazgo 2 — F1 §5.3 + ADR-009 — `auth-service` con SERVICE_ROLE debe filtrar tenant_id en código
F1 §5.3 identifica que `manage-users` corre con bypass RLS via `SERVICE_ROLE_KEY`. ADR-009 mantiene este patrón. Con multitenant, **el bypass RLS pierde la protección de tenant_id**. Mitigación: cada endpoint de `auth-service` que use `adminClient` debe agregar `.eq("tenant_id", ctx.tenantId)` explícitamente en código. Esto **NO es opcional** — es regla obligatoria. Documentar en `packages/auth-middleware/README.md` con ejemplos.

### Hallazgo 3 — Función `get_tickets_sla_status()` requiere update
F3 §6.3 documenta el endpoint `GET /v1/tickets/sla-status` que invoca la RPC SQL `get_tickets_sla_status()`. Esta RPC actualmente NO filtra por tenant_id (porque solo existe SYSDE). Post-ADR-13: la RPC debe ser:
- Reescrita para hacer `WHERE t.tenant_id = current_tenant()` en sus subqueries internas.
- O reemplazada por query directa desde `core-service` que filtre en la capa de servicio.

Recomendación: **mantener la RPC pero modificarla para usar `current_tenant()`**. Sprint 3 del cronograma original (subdominio Tickets) absorbe este cambio.

### Hallazgo 4 — Catálogo de eventos requiere bump menor
F3 `events/README.md` define schemas v1 sin `tenant_id`. Agregar `data.tenant_id` es **campo opcional nuevo → compatible** (no requiere bump major). Pero el campo debe estar **presente** desde el primer evento publicado post-ADR-13 para que consumers puedan routear/filtrar. Documentar en eventos `README.md §4` como "campo agregado en v1 después de ADR-13 — siempre poblado por productores post-2026-05-16".

### Hallazgo 5 — La función `bump_shared_ticket_history_view(p_token)` es anonymous + sin auth
F3 §6.4 lista endpoints públicos `/v1/public/*` y la RPC `bump_shared_ticket_history_view`. Esta RPC es invocada por el front anonymous (sin JWT) cuando alguien abre el link público. **Con multitenant, el endpoint público debe deducir el tenant_id del token**, no del JWT (que no existe). Solución: el token `shared_ticket_history.token` (que se genera al crear el share) **debe incluir tenant_id encriptado**. Esto agrega complejidad al token format — **decisión técnica que cierro en Sprint 3 (Tickets)**, no en Sprint 0.

### Hallazgo 6 — `ai_usage_logs` schema may not have `cost_usd` / `latency_ms`
WS-2 me pide hacer queries de baseline de IA. Hallazgo del análisis de F1: el schema actual de `ai_usage_logs` NO se documentó exhaustivamente (no listamos sus columnas). **Antes de Sprint 0 hay que verificar con `\d ai_usage_logs`** si tiene `latency_ms`, `cost_usd`, `status`, `error_message`. Si faltan, hay que agregarlas en una migration separada (no es parte de ADR-13 pero es prerequisito para tracking de costos por tenant). **WS-2 cubrirá este pre-flight.**

---

## Checklist para AWT (firma)

### Firmas ya recibidas el 2026-05-16 (incorporadas al ADR)

- [x] **Lista inicial de tenants:** solo `sysde` en Sprint 0. Resto post-migración.
- [x] **Categoría C resuelta:** `user_roles` → A, `policy_ai_settings` → A.
- [x] **`business_rules`:** por tenant (Categoría A), seed `tenant_id='sysde'` para rows existentes.
- [x] **Rol `super_admin`:** existe como rol cross-tenant separado, claim JWT `super_admin=true`, solo AWT y Mafe.
- [x] **Hallazgos 1-6:** aprobados en bloque por AWT como extensiones (no conflictos).

### Decisiones aún pendientes (NO bloquean WS-2)

7. **Staffing Sprint 0** (ex-hallazgo #1 reclasificado a gate). ¿1 dev dedicado o ≥2 en paralelo?
   - **1 dev:** cronograma real **20-26 semanas** (excede rango firmado).
   - **2+ devs:** cronograma **18-22 semanas** (rango firmado se cumple).
   - **Impacto:** AWT decide después de firma de ADR-13. No bloquea WS-2 ni Sprint 0 técnicamente, pero define el rango realista del cronograma global.

---

## Referencias

- `02-decisiones-arquitectonicas.md` — ADRs 001-012 (template y contexto)
- `01-diagnostico.md` §4 — bounded contexts e inventario de tablas
- `03-diseno-arquitectura.md` §6 — endpoints OpenAPI afectados
- `04-plan-migracion.md` §4.1 — Sprint 0 original
- `contracts/auth-service/openapi.yaml` — cambios pendientes
- `contracts/ai-gateway/openapi.yaml` — cambios pendientes
- `contracts/core-service/openapi.yaml` — cambios pendientes
- `contracts/events/README.md` — schema bump del envelope

---

## Apéndice — Tablas faltantes del inventario inicial

### Reconciliación de conteo con ARCH.md §7.1

| Fuente | Conteo declarado | Conteo del listado real |
|---|---|---|
| ARCH.md §7.1 header | "82 totales" | — |
| ARCH.md §7.1 listado explícito | — | **85 entradas** |
| ADR-13 v1 (inicial) subtotales nominales | 70 (62+4+3+1) | — |
| ADR-13 v1 listado real intra-categorías | — | ~84 |
| ADR-13 v2 (post-firmas AWT) | 86 | 86 |
| ADR-13 v3 (post-fix conteo + work_goals + ARCH.md housekeeping) | **87** | **87** |

**El conteo nominal "70" del ADR-13 v1 estaba mal**: los subtotales de cada categoría tenían error de cuenta vs los listados detallados. **El conteo "86" del v2 también tenía bug**: Team estaba en 17, debía ser 18 al incluir `work_goals`. La reconciliación correcta de tablas únicas reales clasificadas es **87** (= 83 cat A + 3 cat B + 0 cat C + 1 cat D). Verificación: 83+3+0+1=87 ✅.

Reconciliación con ARCH.md §7.1:
- ARCH.md §7.1 lista **85** entradas en `public.*` schema (header oficial actualizado en v3 — antes decía "82" por bug documental).
- ADR-13 agrega `auth.users` (schema `auth.*`, categoría D, managed by Supabase) → +1.
- ADR-13 propone crear tabla nueva `tenants` (categoría B, a crear en Sprint 0) → +1.
- Total real: 85 + 1 + 1 = **87 tablas únicas clasificadas** post-Sprint 0.

> ✅ **Resuelto en v3 (2026-05-16):** ARCH.md §7.1 header actualizado de "82 totales" → "85 totales" como housekeeping. Verificación añadida en footer del documento original.

### Tabla faltante en ADR-13 v1 que SÍ está en ARCH.md §7.1

| # | Tabla | Origen ARCH.md | Categoría asignada en ADR-13 v2 | Justificación |
|---|---|---|---|---|
| 1 | `work_goals` | §7.1 DevOps/Misc | **A — lleva tenant_id** | Goals operativos del equipo SYSDE / del tenant. Cada org del Grupo Gurunet tiene sus propios goals. → Subgrupo `Team` de Categoría A, sumando 1 → Team pasa de 17 a **18**. |

**Solo 1 tabla faltaba realmente** del listado §7.1 (no las 12 implicadas por el delta nominal 82-70). Las otras 11 tablas que el delta sugería **ya estaban clasificadas** en mi ADR pero distribuidas en grupos cuyos subtotales nominales tenían error de cuenta. En v3 `work_goals` queda incorporada al subgrupo Team de Categoría A (Team: 17 → 18).

### Reclasificación final post-Apéndice

| Categoría | Antes (ADR v1) | Después (ADR v2 post-firma + work_goals) |
|---|---|---|
| A — Lleva tenant_id | 62 (nominal v1) / ~80 (real v1) / 82 (v2) | **83** (Team sube de 17 a 18 por `work_goals`) |
| B — Catálogo global | 4 | 3 (business_rules movida a A) |
| C — Pendiente | 3 | 0 (todas resueltas) |
| D — Supabase managed | 1 | 1 |
| **Total** | 70 (v1 nominal) / 84 (v1 real) / 86 (v2) | **87** únicas, todas clasificadas. Verificación: 83+3+0+1=87. |

> ✅ El total final 87 = 85 (ARCH.md §7.1 listado) + 1 (`auth.users` schema auth) + 1 (`tenants` tabla nueva a crear en Sprint 0). Es coherente con la realidad post-Sprint 0.

### Notas sobre tablas marginales

- `support_reopens_summary` — es **vista** (no tabla). No cuenta en el inventario. Se reescribe en Sprint 0 para filtrar por `current_tenant()`, mantiene `security_invoker=on`.
- `cv_analyses` — mencionada por error en ADR-13 v1 (no existe en ARCH.md §7.1 ni en migraciones). Removida del inventario.

---

## Estado de firma

| | |
|---|---|
| Producido por | Claude (CTO senior B2B fintech mode) |
| Versión actual | v3 (post-fix conteo Cat A + work_goals incorporada + ARCH.md §7.1 actualizado) |
| Aprobado por AWT | ☐ Pendiente firma final tras revisión de ajustes |
| Fecha de firma final | — |
| Próximo paso si firma | Pasa a WS-2 (baseline KPIs IA) |
