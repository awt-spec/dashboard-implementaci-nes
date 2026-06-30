# Gap Analysis — Story Mapping vs. Código real

> **Alcance:** `all` (ERP + PORTAL) · **Fecha:** 2026-06-30
> **Fuente de requerimientos:** `docs/story_mapping_requerimientos.csv` (127 funcionalidades)
> **Story maps auditados:** SYSDE Intranet (SVA) + SYSDE Portal de Servicios
> **Método:** evidencia `file:line` verificada en el código (UI montada + hook/edge function + persistencia/RLS). Read-only, sin cambios de código.

---

## 0. Actualización — cierre de las 14 parciales (2026-06-30)

Tras el diagnóstico se implementaron las **14 funcionalidades 🟡** de este informe. Resumen de lo entregado:

| id | Estado nuevo | Qué se implementó |
|---|---|---|
| ERP-008 | ✅ | Diálogo de edición de campos del cliente en `ClientDetail`. |
| ERP-012 | ✅ | Panel "Roles" con listado/búsqueda y conteo de usuarios por rol (`RolesCatalogPanel`). |
| ERP-014 | ✅* | Roles externos (`cliente` + niveles) listados en el catálogo. *Crear tipos de rol nuevos requiere migración del enum `app_role` (fuera de alcance). |
| ERP-016 | ✅ | Búsqueda + filtro por equipo en `SysdeTeamManager`. |
| ERP-029 | ✅ | Filtro por responsable ("Mis tareas") en `TasksDashboard`. |
| ERP-031 | ✅ | Filtro por persona aplicado al calendario de tareas. |
| ERP-032 | ✅ | Filtro por equipo (department) aplicado al calendario. |
| ERP-063 | ✅ | Búsqueda + filtros por tipo/estado en la pestaña de contratos. |
| ERP-066 | ✅ | Selector para asociar paquete facturado a contrato/póliza. |
| ERP-072 | ✅ | Pestaña "Estado general" con tabla consolidada de clientes. |
| ERP-084 | ✅ | Adjuntar archivos a notas de la mesa de discusión. |
| ERP-089 | ✅ | Panel de comentarios pendientes de atender (`PendingCommentsPanel`). |
| ERP-109 | ✅ | Panel de detalle de sesiones de usuario (`SessionsDetailPanel`). |
| PORTAL-013 | ✅ | Adjuntar archivos a comentarios (mismo componente, rol cliente). |

Nueva migración: `supabase/migrations/20260630120000_note_attachments.sql`. Todo verificado con `tsc` y la suite de tests (35 passing). El detalle por funcionalidad de abajo refleja el **diagnóstico original** (pre-cambios).

### Ausentes (❌) — revisión y cierre (2026-06-30)

Al abordar las ausentes se detectó un **falso negativo** del diagnóstico y se cerraron las que eran construibles:

| id | Estado real | Detalle |
|---|---|---|
| ERP-020 a 025 | ✅ (ya existían) | Falso negativo: `SupervisionsAdminPanel` (CRUD de supervisiones persona↔persona y persona↔equipo, con búsqueda) **ya estaba implementado y montado** en `ConfigurationHub`. El agente lo marcó ❌ porque buscó en `src/components/admin/`; el panel vive en `src/components/settings/`. Tablas `user_supervisions`/`team_supervisions` + RLS + helpers ya existían. |
| ERP-030 | ✅ | Filtro "Mis supervisados" en `TasksDashboard` (resuelve supervisados activos del usuario). |
| ERP-033 | ✅ | El mismo filtro aplica al calendario de tareas. |
| PORTAL-014 | ✅ | `ChangePasswordDialog` (supabase.auth.updateUser) en el header del Portal Cliente. |
| ERP-013 | ⛔ Bloqueado | Crear rol interno: requiere convertir el enum `app_role` en tabla + RLS dinámica. Refactor arquitectónico, fuera de alcance. La asignación de roles existentes a usuarios ya existe (ERP-005). |
| ERP-015 | ⛔ Bloqueado | Ver/editar/eliminar tipos de rol: mismo bloqueo arquitectónico que ERP-013. El catálogo de roles (lectura) está cubierto por ERP-012. |

**Resultado tras esta corrida:** de las 11 ❌ originales, 9 quedan ✅ (6 ya existían, 3 nuevas) y 2 (ERP-013/015) quedan bloqueadas por la arquitectura de roles basada en enum.

### Refactor de roles — fase 1 (2026-06-30)

Se destrabaron **ERP-013/015** a nivel de gestión con un catálogo de roles gestionable:

| id | Estado | Detalle |
|---|---|---|
| ERP-013 | ✅ (gestión) | Crear roles personalizados desde el panel "Roles" (tabla `public.roles`). |
| ERP-015 | ✅ (gestión) | Ver/editar/eliminar roles personalizados; los de sistema quedan protegidos. |

- Migración `supabase/migrations/20260630130000_roles_catalog.sql`: tabla `roles` (key/label/description/scope/is_system/is_active), RLS (lectura authenticated, escritura admin), trigger que protege los roles de sistema, semilla de los 7 roles del enum.
- Hook `useRoles` + `RolesCatalogPanel` reescrito con CRUD.
- **Pendiente (fase 2):** la APLICACIÓN de permisos en RLS para roles personalizados (RBAC dinámico) — hoy la RLS sigue basada en el enum `app_role` + `has_role` para los roles de sistema. Crear un rol personalizado lo deja definido y gestionable, pero su enforcement de permisos requiere construir el modelo de `role_permissions` y consultar permisos en vez de roles hardcodeados.

### Refactor de roles — fase 2: RBAC dinámico (2026-06-30)

Se construyó el modelo de permisos que da enforcement a los roles personalizados:

- Migración `supabase/migrations/20260630140000_rbac_permissions.sql`:
  - `permissions` (catálogo módulo+acción, sembrado desde la matriz que estaba hardcodeada en `RBACPermissionsTab`).
  - `role_permissions` (rol→permiso, sembrado para admin/pm/gerente).
  - `user_custom_roles` (asignar roles personalizados a usuarios; los de sistema siguen en `user_roles`/enum).
  - Funciones `has_permission(user, key)` y `get_my_permissions()` que resuelven roles de sistema **+** personalizados.
- Hooks `usePermissions`: catálogo, matriz por rol (toggle), permisos efectivos del usuario (`useMyPermissions` / `useHasPermission`), asignación de roles personalizados.
- `RBACPermissionsTab` ahora es una **matriz editable y persistida** (antes estática), cubriendo todos los roles del catálogo.
- `RolesCatalogPanel`: diálogo para asignar roles personalizados a usuarios + conteo real por rol.

**Fase 3 (iniciada):** migración incremental de políticas RLS al patrón aditivo (abajo).

**Cobertura final del Story Mapping:** 127/127 funcionalidades implementadas. Los roles personalizados ya se crean, configuran (permisos) y asignan a usuarios con enforcement en la app.

### Refactor de roles — fase 3: bridge RLS (2026-06-30)

Inicio de la migración de políticas RLS a `has_permission`, con un patrón **aditivo** y seguro:

- Migración `supabase/migrations/20260630150000_rbac_rls_bridge_config.sql`.
- Patrón: `USING (has_role(admin) OR has_role(pm) OR has_permission('config.catalogos'))`. Es estrictamente más permisivo — los roles de sistema mantienen su acceso exacto y los roles personalizados con el permiso ganan acceso a nivel de base de datos. Nunca quita acceso.
- Tablas migradas (catálogos de configuración, escritura `admin`/`pm`): `products`, `product_modules`, `product_versions`, `version_modules`, `sva_teams`, `sva_team_holidays`, `sva_team_members`, `policy_templates`, `policy_template_packages`, `client_categories`.
- Nuevo permiso `config.catalogos` (módulo "Configuración") sembrado y concedido a admin/pm para reflejar el estado actual; visible/editable en la matriz RBAC.

**Batch 2** (`20260630160000_rbac_rls_bridge_batch2.sql`) — mismo patrón aditivo en:

| Tabla(s) | Permiso nuevo | Roles sistema con acceso (sin cambio) |
|---|---|---|
| `task_types`, `reopen_reasons` | `config.catalogos_admin` | admin |
| `user_supervisions`, `team_supervisions` | `equipo.supervisiones` | admin |
| `billed_packages` (insert/update) | `comercial.paquetes_facturados` | admin, pm |

`billed_packages` DELETE se mantiene admin-only (igual que hoy; pm tampoco borra).

**Batch 3** (`20260630170000_rbac_rls_bridge_batch3.sql`) — tablas de datos de cliente cuyo estado final (políticas `rls_insert_admin_pm`/`rls_update_admin_pm` de `harden_rls`) se confirmó **no sobrescrito** por migraciones posteriores: `client_contracts`, `client_slas`, `client_team_members`, `client_dashboard_config`, `client_rule_overrides`. Permiso `cliente.gestionar_datos` (admin, pm). INSERT/UPDATE bridgeados; DELETE queda admin-only.

**Total bridged en fase 3: 20 tablas.**

### Gating en el frontend por permiso (2026-06-30)

Cierre del círculo end-to-end para roles personalizados en el shell de admin/pm:
- `ConfigurationHub`: cada sección de catálogo acepta un `permission`; se muestra si el rol de sistema coincide **o** el usuario tiene ese permiso (`useMyPermissions`). Mapeo: productos/SVA/plantillas/categorías → `config.catalogos`; tipos de tarea/motivos → `config.catalogos_admin`; supervisiones → `equipo.supervisiones`.
- `AppSidebar`: el ítem "Configuración" aparece también para quien tenga cualquier permiso de configuración.
- Verificado con `tsc`, tests (35/35) y **build de producción** (`vite build`) OK.

**Límite conocido:** los roles `colaborador`, `cliente` y `ceo` se enrutan a shells dedicados (`Index.tsx`) y no pasan por el sidebar de admin; un rol personalizado es aditivo y no cambia el shell de aterrizaje. El gating por permiso aplica para usuarios en el shell admin/pm/gerente_soporte (el caso común de roles personalizados de staff). Extender el acceso a config desde los shells dedicados es una decisión de ruteo a hacer con verificación en runtime.

**Backlog (requiere verificación contra base real):**
- `quotes` y `support_tickets`/`support_ticket_notes`: el control de escritura es por `is_staff_user()` / `NOT is_cliente_user()` (ya abierto a todo el staff), no `has_role` — un bridge por permiso no aporta sin antes redefinir su modelo de acceso. Mezclan políticas del rol `cliente`.
- `clients`, `client_financials`, `client_contacts`: tienen **múltiples overrides** de RLS en migraciones sucesivas; determinar el estado final exacto y bridgearlo requiere verificar contra la base.
- Grupo operativo de `harden_rls_phase2` (`phases`, `deliverables`, `tasks`, `action_items`, `risks`, `comments`, `meeting_minutes`, …): quedaron en `admin/pm` (rls_*_admin_pm) salvo overrides posteriores; conviene confirmar el estado final tabla por tabla antes de bridgear.
- `business_rules`, `policy_ai_settings`, `gerente_client_assignments`, `cliente_company_assignments`: políticas por rol-cliente / reglas finas a migrar una a una con verificación.

El patrón aditivo ya está probado en 20 tablas; replicarlo en estas requiere un entorno con la base levantada para confirmar el estado final de cada política antes de redefinirla.

---

## 1. Resumen ejecutivo

El ERP de SVA **ya cubre la gran mayoría del Story Mapping**: de 127 funcionalidades, **102 están completas (80%)**, 14 parciales y 11 ausentes. El núcleo vivo del negocio —solicitudes de servicio (tickets), cotizaciones, mesa de discusión, contratos/pólizas, catálogos SVA, productos/versiones, registro de tiempos y todo el bloque de IA del prototipo— está **implementado de punta a punta**. El Portal del cliente (rol `cliente` en el mismo SPA) está prácticamente completo (16/18).

Los **3 huecos más grandes para AWT** son:

1. **Supervisiones sin interfaz (ERP-020 a 025, 6 ❌):** las tablas `user_supervisions` / `team_supervisions`, sus helpers SQL y RLS ya existen, pero **no hay ninguna pantalla** para crear, buscar o eliminar supervisiones. Es backend listo, UI ausente.
2. **Gestión de roles de acceso sin CRUD (ERP-012/013/014/015):** los roles viven como enum + RLS; no existe pantalla para listar, crear ni editar roles internos/externos. Solo se asignan roles ya existentes a usuarios.
3. **Tareas de supervisados y vistas de calendario por equipo/supervisado (ERP-030, 033 ❌; ERP-029, 031, 032 🟡):** el módulo de tareas funciona a nivel personal/por-cliente, pero no filtra "mis tareas" por usuario ni muestra tareas de supervisados en calendario.

> Nota de contexto del propio Story Mapping: varios de estos huecos (supervisiones, reportes legacy) figuran en el video como funcionalidad "no usada" del sistema actual, por lo que su prioridad de cierre debe validarse contra el negocio antes de invertir.

---

## 2. Cobertura por etapa

| Sistema | Etapa | Total | ✅ | 🟡 | ❌ | % impl. |
|---|---|---|---|---|---|---|
| ERP | Administración de actores del sistema | 25 | 13 | 4 | 8 | 52% |
| ERP | Gestión de los equipos de trabajo | 13 | 8 | 3 | 2 | 62% |
| ERP | Configuración de los productos de software | 9 | 9 | 0 | 0 | 100% |
| ERP | Configuración de SVA (Customer Success) | 15 | 15 | 0 | 0 | 100% |
| ERP | Gestión de contratos y facturación | 10 | 7 | 3 | 0 | 70% |
| ERP | Seguimiento a las solicitudes de servicio | 17 | 15 | 2 | 0 | 88% |
| ERP | Funcionalidades generales | 2 | 2 | 0 | 0 | 100% |
| ERP | Nuevas funcionalidades del prototipo | 18 | 17 | 1 | 0 | 94% |
| **ERP** | **Subtotal** | **109** | **86** | **13** | **10** | **79%** |
| PORTAL | Solicitud del servicio | 4 | 4 | 0 | 0 | 100% |
| PORTAL | Dashboard | 3 | 3 | 0 | 0 | 100% |
| PORTAL | Seguimiento a una solicitud de servicio | 6 | 5 | 1 | 0 | 83% |
| PORTAL | Funcionalidades generales | 4 | 3 | 0 | 1 | 75% |
| PORTAL | Nuevas funcionalidades del prototipo | 1 | 1 | 0 | 0 | 100% |
| **PORTAL** | **Subtotal** | **18** | **16** | **1** | **1** | **89%** |
| | **TOTAL** | **127** | **102** | **14** | **11** | **80%** |

---

## 3. Detalle de funcionalidades 🟡 parciales y ❌ ausentes

> Las ✅ implementadas (102) no se detallan aquí; ver §4 para el resumen por bloque.

### ERP — Administración de actores del sistema

| id | acción | estado | evidencia | qué falta |
|---|---|---|---|---|
| ERP-008 | Ver, editar o eliminar un cliente | 🟡 | `ClientDetail.tsx:61` | UI de edición directa de campos del cliente (nombre, país, industria); hoy solo se editan fases/estado |
| ERP-012 | Buscar roles de acceso | 🟡 | `SystemUsersTab.tsx:368` | Pantalla de búsqueda/listado de roles; solo hay conteo en estadísticas |
| ERP-013 | Crear un rol de acceso para usuarios internos | ❌ | ninguna | UI CRUD de roles internos; hoy solo existen como enum `app_role` en migración |
| ERP-014 | Crear un rol de acceso para usuarios externos | 🟡 | `20260423130000_cliente_role.sql:10` | UI CRUD del rol externo; tabla + RLS creadas pero sin componente |
| ERP-015 | Ver, editar o eliminar un rol | ❌ | ninguna | UI CRUD de roles; solo enum + políticas RLS en BD |
| ERP-016 | Buscar equipos de trabajo | 🟡 | `SysdeTeamManager.tsx:26` | Búsqueda explícita; hoy solo listado con filtro implícito |
| ERP-020 | Buscar supervisiones de usuarios | ❌ | ninguna | UI; tablas + RLS en `20260521130000_supervisions.sql` pero sin componente |
| ERP-021 | Crear una supervisión de un usuario | ❌ | ninguna | UI; helpers SQL (`is_user_supervisor_of`, `get_supervisors_of_user`) existen, sin pantalla |
| ERP-022 | Eliminar una supervisión de un usuario | ❌ | ninguna | UI; RLS admin-only existe, sin pantalla |
| ERP-023 | Buscar supervisiones de equipos | ❌ | ninguna | UI; tabla `team_supervisions` + RLS existen, sin componente |
| ERP-024 | Crear una supervisión de un equipo | ❌ | ninguna | UI; tabla + helpers existen, sin componente |
| ERP-025 | Eliminar una supervisión de un equipo | ❌ | ninguna | UI; RLS existe, sin componente |

### ERP — Gestión de los equipos de trabajo

| id | acción | estado | evidencia | qué falta |
|---|---|---|---|---|
| ERP-029 | Buscar tareas propias | 🟡 | `TaskTable.tsx`, `useClients.ts:158` | Filtro por usuario actual (`useMyTasks`); hoy busca por cliente/estado, no por propietario |
| ERP-030 | Buscar tareas de supervisados | ❌ | ninguna | Hook + UI + RLS para listar tareas filtrando por supervisado |
| ERP-031 | Tareas de una persona en calendario | 🟡 | `TaskCalendar.tsx`, `useClients.ts:217` | Filtro por usuario individual; el calendario es global/por-cliente |
| ERP-032 | Tareas de un equipo en calendario | 🟡 | `TimeOffCalendar.tsx`, `useTimeTracking.ts:34` | Calendario de tareas por equipo; lo existente es de *time tracking*, no de tareas |
| ERP-033 | Tareas de supervisados en calendario | ❌ | ninguna | Hook + calendario + RLS para tareas de supervisados |

### ERP — Gestión de contratos y facturación

| id | acción | estado | evidencia | qué falta |
|---|---|---|---|---|
| ERP-063 | Buscar pólizas o contratos | 🟡 | `ClientList.tsx:29`, `ContractsSLATab.tsx:36` | Búsqueda/filtrado especializado de contratos (tipo, vigencia, tarifa); hoy se llega vía el cliente |
| ERP-066 | Crear paquete para asociarlo a póliza/contrato | 🟡 | `BilledPackagesTab.tsx:46`, `useBilledPackages.ts:58` | Flujo de asociación paquete→póliza activa integrado |
| ERP-072 | Consultar el estado general de los clientes | 🟡 | `CEODashboard.tsx`, `ExecutiveOverview.tsx` | Vista consolidada única de estado de todos los clientes; hoy disperso en dashboards |

### ERP — Seguimiento a las solicitudes de servicio

| id | acción | estado | evidencia | qué falta |
|---|---|---|---|---|
| ERP-084 | Adjuntar archivo a un comentario de la mesa de discusión | 🟡 | `20260521200000.sql:8-42` (columnas + RLS) | UI para subir/gestionar el adjunto en comentarios; columnas y RLS listas, falta el front |
| ERP-089 | Consultar comentarios pendientes de atender | 🟡 | `SupportInbox.tsx:32`, `useSupportTickets.ts:99` | Vista/hook específico de "comentarios sin respuesta"; hoy filtra tickets en estado PENDIENTE, no comentarios |

### ERP — Nuevas funcionalidades del prototipo

| id | acción | estado | evidencia | qué falta |
|---|---|---|---|---|
| ERP-109 | Registrar inicio y detalle de sesión de un usuario | 🟡 | `useAuth.tsx`, `Login.tsx`, `20260419161827` (audit log de tiempos) | Tabla dedicada de auditoría de login/sesiones; la auth funciona pero no hay histórico de sesiones como tal |

### PORTAL

| id | acción | estado | evidencia | qué falta |
|---|---|---|---|---|
| PORTAL-013 | Adjuntar archivo a un comentario en la mesa de discusión | 🟡 | `QuoteApprovalCard.tsx:62` (descarga de adjuntos de quote) | UI para que el cliente anexe archivos a sus comentarios; hoy solo descarga adjuntos de cotización |
| PORTAL-014 | Cambiar contraseña | ❌ | ninguna | UI para que el cliente cambie su propia contraseña (no existe en `ClientPortalDashboard` ni perfil) |

---

## 4. Bloques 100% implementados (resumen)

- **Configuración de productos de software (ERP-039 a 047):** productos, módulos, versiones y asociación módulo↔versión — CRUD completo (`ProductsAdminPanel.tsx` + `useProducts.ts` + `products_catalog.sql`).
- **Configuración de SVA / Customer Success (ERP-048 a 062):** equipos SVA + días no laborales, catálogo de motivos de cambios/incidencias, categorías de clientes, plantillas de póliza y paquetes — CRUD completo.
- **Seguimiento a solicitudes (ERP-073 a 091, salvo 084/089):** búsqueda, alta/edición de tickets, adjuntos, subtareas, reaperturas, mesa de discusión (notas), cotizaciones con adjuntos, auth + autorización por rol/RLS.
- **Nuevas funcionalidades del prototipo (ERP-092 a 108):** SLA por cliente, notas internas, board Scrum/Kanban, estrategia IA por caso, alerta de reaperturas, info 360 del cliente, captura IA de tiempos, cierre semanal de tiempos, minutas IA (crear/compartir), dashboard de colaborador, chat IA ejecutivo, análisis IA de casos/Scrum/equipos, agente IA personal — todas con UI que invoca su Edge Function.
- **Portal del cliente (PORTAL-001 a 012, 015–018):** búsqueda y alta de solicitudes (requerimiento/corrección/consulta), dashboard (cotizaciones pendientes, estado, pendientes de cerrar), detalle/edición, mesa de discusión, auth + autorización por `permission_level`, notificaciones en tiempo real y minutas compartidas.

---

## 5. Hallazgos ➕ (extras en código, fuera del Story Mapping)

- **Forecast de sprint / ceremonias Scrum con IA** (`forecast-sprint`, `useSprintCeremonies.ts`) — más allá del board pedido en ERP-095/106.
- **Recomendación de equipo para un cliente** (`recommend-team-for-client`) y **análisis de carrera/CV/mentoría** (`analyze-career-path`, `analyze-cv`, `mentor-ai`) — capacidades de RRHH no mapeadas explícitamente.
- **Sincronización con DevOps** (`sync-devops`) — integración externa no presente en el mapa.
- **Digest semanal del agente de miembro** (`member-agent-weekly-digest`) y **cifrado de tickets** (`decrypt-ticket`) — funcionalidades de soporte no listadas.

---

*Generado por la skill `gap-storymapping`. Evidencia recolectada mediante 7 auditorías paralelas sobre el código (`src/` + `supabase/`). Las citas `file:line` corresponden al estado del repo en la rama `claude/repository-access-rtwj65`.*
