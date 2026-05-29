# Gap Analysis — Story Mapping vs Código real

**Sistema:** ERP + PORTAL (todo el alcance)
**Fecha:** 2026-05-21
**Fuente requerimientos:** `docs/story_mapping_requerimientos.csv` (127 funcionalidades)
**Repo auditado:** `sva-erp-deploy/` rama `main`
**Metodología:** Evidencia file:line obligatoria; clasificación estricta de 3 capas (UI + hook/edge fn + tabla/RLS).

---

## 1. Resumen ejecutivo

De **127 funcionalidades** del Story Mapping, **79 están implementadas (62%)**, **16 parciales (13%)** y **32 ausentes (25%)**. La cobertura efectiva (Implementadas + mitad de las Parciales) ronda el **68%**.

**Los 3 huecos más grandes para AWT:**

1. **Configuración de SVA (Customer Success) — 12 de 15 ausentes.** No hay CRUD propio de catálogos: **motivos** de cambios/incidencias, **categorías** de clientes, **plantillas** de pólizas, **paquetes** de plantilla, ni **equipos SVA** como entidad separada (sólo `teams` generales). Hoy todo eso vive como enums duros o reglas globales en `BusinessRulesPanel`, no como catálogos editables.
2. **Cotizaciones de servicio — 4 ausentes (ERP-085 a 088 + PORTAL-005).** No hay tabla `quotes` ni componente de cotización formal. Es el ciclo comercial que falta cerrar dentro de la solicitud de servicio (la solicitud existe; lo que falta es el documento cotización que el cliente aprueba antes de ejecutar).
3. **Catálogos de productos/módulos/versiones — 8 parciales + 1 ausente.** No hay tabla `products`/`modules`/`versions`. Se administra inline en `clients.core_version` y `clients.modules[]` desde `ClientTechStack`. Funciona para registrar qué tiene cada cliente, pero no permite mantener un catálogo maestro reutilizable ni asociar módulos a versiones.

**Hueco menor pero visible:** supervisiones formales de usuarios/equipos (ERP-020 a 025), audiencias de notificaciones (ERP-010/011) y tipos de tarea como catálogo (ERP-026 a 028). El sistema asume jerarquías implícitas por rol (`gerente`, `gerente_soporte`) y notificaciones por evento global.

**Fortalezas:** todo lo que sea **gestión de solicitudes/tickets**, **board Scrum/Kanban**, **tareas + tiempos**, **contratos + SLA**, **funcionalidades IA del prototipo** y **portal del cliente externo (rol `cliente`)** está implementado al 100% o muy cerca.

---

## 2. Cobertura por etapa

| Sistema | Etapa | Total | ✅ Impl. | 🟡 Parcial | ❌ Ausente | % Impl. |
|---|---|---|---|---|---|---|
| PORTAL | Solicitud del servicio | 4 | 4 | 0 | 0 | **100%** |
| PORTAL | Dashboard | 3 | 2 | 0 | 1 | 67% |
| PORTAL | Seguimiento a solicitud | 6 | 3 | 3 | 0 | 50% |
| PORTAL | Funcionalidades generales | 4 | 4 | 0 | 0 | **100%** |
| PORTAL | Nuevas (prototipo) | 1 | 1 | 0 | 0 | **100%** |
| ERP | Admin. de actores | 25 | 17 | 0 | 8 | 68% |
| ERP | Gestión de equipos de trabajo | 13 | 10 | 0 | 3 | 77% |
| ERP | Configuración de productos | 9 | 0 | 8 | 1 | 0% |
| ERP | Configuración de SVA | 15 | 0 | 3 | 12 | **0%** ⚠ |
| ERP | Contratos y facturación | 10 | 6 | 1 | 3 | 60% |
| ERP | Seguimiento a solicitudes | 17 | 13 | 0 | 4 | 76% |
| ERP | Funcionalidades generales | 2 | 2 | 0 | 0 | **100%** |
| ERP | Nuevas (prototipo) | 18 | 17 | 1 | 0 | **94%** |
| **TOTAL** | | **127** | **79** | **16** | **32** | **62%** |

**Lectura rápida:** todo lo `Nuevas (prototipo)` y `Generales` está casi terminado; **el déficit está concentrado en los catálogos administrativos del lado SVA y en cotizaciones**.

---

## 3. Detalle por funcionalidad (sólo 🟡 y ❌)

> Las 79 ✅ se omiten para no inflar el reporte. Para cualquiera de ellas la evidencia file:line está en el detalle de §5.

### 3.1 PORTAL

| ID | Acción usuario | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| PORTAL-005 | Consultar cotizaciones pendientes de aprobar | ❌ | ninguna | No existe tabla `quotes` ni vista de aprobación. Cliente no tiene cotizaciones que aprobar porque el sistema no las genera. |
| PORTAL-009 | Editar una solicitud seleccionada | 🟡 | [src/components/support/TicketDetailSheet.tsx:1](src/components/support/TicketDetailSheet.tsx:1), [src/hooks/useReopenTicket.ts:1](src/hooks/useReopenTicket.ts:1) | El cliente puede **reabrir** y **validar/calificar** la solicitud, pero no editar campos del ticket (asunto/descripción/severidad) post-creación. |
| PORTAL-012 | Ver/editar/eliminar comentario | 🟡 | [src/components/clients/tabs/CollaborationTab.tsx:34](src/components/clients/tabs/CollaborationTab.tsx:34) | UI muestra y crea comentarios. Edición y borrado no expuestos al rol `cliente` (RLS los bloquea, pero la UI tampoco los renderiza). |
| PORTAL-013 | Adjuntar archivo a comentario | 🟡 | [src/components/clients/tabs/CollaborationTab.tsx:34](src/components/clients/tabs/CollaborationTab.tsx:34) | El bucket `support-ticket-attachments` existe y staff puede adjuntar al ticket. Adjuntar **directamente desde el comentario** en la mesa de discusión del portal no está implementado. |

### 3.2 ERP — Administración de actores

| ID | Acción usuario | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| ERP-010 | Crear audiencia de usuarios de un cliente para notificaciones | ❌ | ninguna | No existe tabla `notification_audiences`. Notificaciones se envían por evento global o por rol, no por audiencia configurada. |
| ERP-011 | Ver/editar/eliminar audiencia | ❌ | ninguna | Idem. |
| ERP-020 | Buscar supervisiones de usuarios | ❌ | ninguna | No hay tabla `user_supervisions` ni componente. La supervisión hoy se infiere por rol (gerente → colaborador). |
| ERP-021 | Crear supervisión de un usuario | ❌ | ninguna | Idem. |
| ERP-022 | Eliminar supervisión de un usuario | ❌ | ninguna | Idem. |
| ERP-023 | Buscar supervisiones de equipos | ❌ | ninguna | Existe `gerente_client_assignments` (gerente↔cliente) pero no gerente↔equipo formal. |
| ERP-024 | Crear supervisión de un equipo | ❌ | ninguna | Idem. |
| ERP-025 | Eliminar supervisión de un equipo | ❌ | ninguna | Idem. |

### 3.3 ERP — Gestión de equipos de trabajo

| ID | Acción usuario | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| ERP-026 | Buscar tipos de tarea en catálogo | ❌ | ninguna | No existe tabla `task_types`. Los tipos viven como enum `task_kind` (`feature`/`bug`/`spike`/...), no editables desde UI. |
| ERP-027 | Crear tipo de tarea | ❌ | ninguna | Idem. |
| ERP-028 | Ver/editar/eliminar tipo de tarea | ❌ | ninguna | Idem. |

### 3.4 ERP — Configuración de productos de software

| ID | Acción usuario | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| ERP-039 | Buscar productos en el catálogo | 🟡 | [src/components/clients/ClientTechStack.tsx:38](src/components/clients/ClientTechStack.tsx:38) | No hay catálogo global de productos. `ClientTechStack` muestra/edita `clients.modules[]` y `clients.core_version` por cliente — no se consulta una lista maestra. |
| ERP-040 | Crear un producto | 🟡 | [src/components/clients/ClientTechStack.tsx:42](src/components/clients/ClientTechStack.tsx:42) | Los "productos" se agregan como strings libres al cliente. No hay tabla `products` con id/nombre/owner. |
| ERP-041 | Ver/editar/eliminar producto y sus módulos | 🟡 | [src/components/clients/ClientTechStack.tsx:51](src/components/clients/ClientTechStack.tsx:51) | Sólo edición inline al cliente. Sin gestión central. |
| ERP-042 | Crear módulo para producto | 🟡 | [src/components/clients/ClientTechStack.tsx:44](src/components/clients/ClientTechStack.tsx:44) | Igual que arriba, módulos como strings en array, no entidades. |
| ERP-043 | Ver/editar/eliminar módulo | 🟡 | [src/components/clients/ClientTechStack.tsx:51](src/components/clients/ClientTechStack.tsx:51) | Idem. |
| ERP-044 | Buscar versiones implementadas | 🟡 | [src/components/clients/ClientTechStack.tsx:38](src/components/clients/ClientTechStack.tsx:38) | Sólo se ve `clients.core_version` por cliente. No hay tabla `versions`. |
| ERP-045 | Crear versión implementada | 🟡 | [src/components/clients/ClientTechStack.tsx:42](src/components/clients/ClientTechStack.tsx:42) | Edición de string libre, no creación de entidad. |
| ERP-046 | Ver/editar/eliminar versión | 🟡 | [src/components/clients/ClientTechStack.tsx:44](src/components/clients/ClientTechStack.tsx:44) | Idem. |
| ERP-047 | Asociar/desasociar módulo a versión | ❌ | ninguna | No existe relación `version_modules`. Módulos no se asocian a versiones, sólo a clientes. |

### 3.5 ERP — Configuración de SVA (Customer Success) ⚠ MAYOR DÉFICIT

| ID | Acción usuario | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| ERP-048 | Buscar equipos SVA | ❌ | ninguna | Existen `teams` generales pero no una entidad separada "equipo SVA" con días no laborables, capacidad SVA, etc. |
| ERP-049 | Crear equipo SVA | ❌ | ninguna | Idem. |
| ERP-050 | Ver/editar/eliminar equipo SVA | ❌ | ninguna | Idem. |
| ERP-051 | Agregar/eliminar días no laborales de equipo SVA | ❌ | ninguna | No existe tabla `team_holidays` ni componente. |
| ERP-052 | Buscar motivos de cambios e incidencias | 🟡 | [src/components/support/ReopenReasonDialog.tsx:1](src/components/support/ReopenReasonDialog.tsx:1) | Los motivos están como **enum cerrado** en el componente. Se consultan al reabrir un ticket, pero no hay catálogo BD editable. |
| ERP-053 | Crear un motivo | ❌ | ninguna | El enum está hardcodeado. Para agregar uno hay que tocar código. |
| ERP-054 | Ver/editar/eliminar motivo | ❌ | ninguna | Idem. |
| ERP-055 | Buscar categorías de clientes | 🟡 | [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) (campo `clients.segment`) | `clients.segment` actúa como categorización (texto libre) pero no hay catálogo. |
| ERP-056 | Crear categoría de clientes | ❌ | ninguna | Sin CRUD de categorías. |
| ERP-057 | Ver/editar/eliminar categoría | ❌ | ninguna | Idem. |
| ERP-058 | Buscar plantillas de pólizas | 🟡 | [src/components/settings/BusinessRulesPanel.tsx:14](src/components/settings/BusinessRulesPanel.tsx:14), [src/hooks/useBusinessRules.ts:1](src/hooks/useBusinessRules.ts:1) | `business_rules` actúa como reglas SLA globales por `policy_version`. Funciona como "plantilla operativa" pero no como plantilla de póliza con paquetes asociados. |
| ERP-059 | Crear plantilla de póliza | ❌ | ninguna | No hay objeto "plantilla de póliza" con paquetes anidados. |
| ERP-060 | Ver/editar/eliminar plantilla | ❌ | ninguna | Idem. |
| ERP-061 | Crear paquete de servicios para plantilla | ❌ | ninguna | No existe tabla `service_packages`. |
| ERP-062 | Ver/editar/eliminar paquete de plantilla | ❌ | ninguna | Idem. |

### 3.6 ERP — Gestión de contratos y facturación

| ID | Acción usuario | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| ERP-068 | Buscar paquetes facturados individualmente | ❌ | ninguna | No existe tabla de paquetes de servicio cobrados aparte del contrato. |
| ERP-069 | Crear paquete facturado individualmente | ❌ | ninguna | Idem. |
| ERP-070 | Ver/editar/eliminar paquete facturado individualmente | ❌ | ninguna | Idem. |
| ERP-071 | Generar estado de cuenta de cliente | 🟡 | [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) (tabla `client_financials`) | Existe `client_financials` con saldo/movimientos pero **no hay vista que genere/exporte un estado de cuenta consolidado** (PDF, snapshot del período). |

### 3.7 ERP — Seguimiento a solicitudes de servicio

| ID | Acción usuario | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| ERP-085 | Buscar cotizaciones de servicio | ❌ | ninguna | No existe tabla `quotes` ni hooks. La etapa comercial dentro del ticket no está modelada. |
| ERP-086 | Crear cotización asociada a solicitud | ❌ | ninguna | Idem. |
| ERP-087 | Ver/editar/eliminar cotización | ❌ | ninguna | Idem. |
| ERP-088 | Adjuntar archivo a cotización | ❌ | ninguna | Idem. |

### 3.8 ERP — Nuevas funcionalidades del prototipo

| ID | Acción usuario | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| ERP-098 | Consultar información 360 de un cliente (SVA + otras implementadas) | 🟡 | [src/components/clients/ClientDetail.tsx:1](src/components/clients/ClientDetail.tsx:1), [src/components/clients/tabs/](src/components/clients/) | El detalle del cliente tiene tabs (Contratos, Tareas, Colaboración, Deliverables, etc.) y cubre la perspectiva SVA. Falta el **agregador "otras perspectivas implementadas"** (e.g., otros productos SYSDE: SAF+, otros equipos comerciales). Sin integración cross-producto. |

---

## 4. Detalle por funcionalidad (✅ Implementadas — resumen con evidencia)

### 4.1 PORTAL (14 ✅)

| ID | Evidencia file:line | Cómo se cumple |
|---|---|---|
| PORTAL-001 | [src/hooks/useSupportTickets.ts:1](src/hooks/useSupportTickets.ts:1), [src/components/dashboard/ClientPortalDashboard.tsx:1](src/components/dashboard/ClientPortalDashboard.tsx:1) | Cliente busca sus solicitudes en su dashboard (filtros por status, búsqueda libre). |
| PORTAL-002 | [src/components/support/NewTicketForm.tsx:111](src/components/support/NewTicketForm.tsx:111) | Formulario con `tipo_solicitud=requerimiento`. |
| PORTAL-003 | [src/components/support/NewTicketForm.tsx:111](src/components/support/NewTicketForm.tsx:111) | Mismo form, `tipo_solicitud=correccion`. |
| PORTAL-004 | [src/components/support/NewTicketForm.tsx:111](src/components/support/NewTicketForm.tsx:111) | Mismo form, `tipo_solicitud=consulta`. |
| PORTAL-006 | [src/components/dashboard/ClientPortalDashboard.tsx:1](src/components/dashboard/ClientPortalDashboard.tsx:1) | Stats y cards de estado actual en la home del rol `cliente`. |
| PORTAL-007 | [src/components/dashboard/ClientPortalDashboard.tsx:1](src/components/dashboard/ClientPortalDashboard.tsx:1) | Sección "Pendientes de cerrar/validar" en dashboard cliente. |
| PORTAL-008 | [src/components/support/TicketDetailSheet.tsx:1](src/components/support/TicketDetailSheet.tsx:1) | Sheet de detalle, RLS filtra a sólo tickets del cliente. |
| PORTAL-010 | [src/components/support/SupportCaseDetailPanel.tsx:1](src/components/support/SupportCaseDetailPanel.tsx:1) | Mesa de discusión = `comments` table renderizada en el detalle del caso. |
| PORTAL-011 | [src/components/clients/tabs/CollaborationTab.tsx:34](src/components/clients/tabs/CollaborationTab.tsx:34) | Cliente puede crear comentario; RLS lo permite si `client_id` del ticket coincide. |
| PORTAL-014 | [supabase/functions/reset-passwords/index.ts](supabase/functions/reset-passwords/index.ts), [src/pages/Login.tsx](src/pages/Login.tsx) | Edge function de reset + flujo de recuperación expuesto en login. |
| PORTAL-015 | [src/pages/Login.tsx:94](src/pages/Login.tsx:94), [src/hooks/useAuth.tsx:1](src/hooks/useAuth.tsx:1) | Auth con Supabase Auth (`signInWithPassword`). |
| PORTAL-016 | [src/pages/Index.tsx:1](src/pages/Index.tsx:1) (switch por rol), RLS con `has_role` en todas las tablas | Autorización por rol + RLS. El cliente ve sólo lo suyo. |
| PORTAL-017 | [supabase/functions/send-notification-email/index.ts](supabase/functions/send-notification-email/index.ts), [src/hooks/useNotifications.ts:1](src/hooks/useNotifications.ts:1), [supabase/functions/notify-critical-ticket/index.ts](supabase/functions/notify-critical-ticket/index.ts) | Edge functions de notificación email + tabla `user_notifications` con campana. |
| PORTAL-018 | [src/components/dashboard/SharedMinutasPanel.tsx:28](src/components/dashboard/SharedMinutasPanel.tsx:28), [src/pages/SharedPresentation.tsx:1](src/pages/SharedPresentation.tsx:1) | Minutas compartidas vía link público; cliente las lista en su dashboard. |

### 4.2 ERP — Administración de actores (17 ✅)

| ID | Evidencia file:line | Cómo se cumple |
|---|---|---|
| ERP-001 / ERP-002 / ERP-003 | [src/pages/AdminUsers.tsx:10](src/pages/AdminUsers.tsx:10), [src/components/admin/SystemUsersTab.tsx:1](src/components/admin/SystemUsersTab.tsx:1), [supabase/functions/manage-users/index.ts](supabase/functions/manage-users/index.ts) | Tab "Usuarios del sistema" con búsqueda, crear, ver/editar/eliminar via edge fn `manage-users`. |
| ERP-004 | [supabase/functions/reset-passwords/index.ts](supabase/functions/reset-passwords/index.ts), [src/components/admin/SystemUsersTab.tsx](src/components/admin/SystemUsersTab.tsx) | Admin dispara reset via edge fn. |
| ERP-005 | [src/components/admin/SystemUsersTab.tsx:1](src/components/admin/SystemUsersTab.tsx:1) (selector de rol), `user_roles` tabla | Asignación de rol al crear/editar usuario; RLS lo respeta. |
| ERP-006 | [src/components/clients/ClientList.tsx:43](src/components/clients/ClientList.tsx:43), [src/hooks/useClients.ts:1](src/hooks/useClients.ts:1) | Lista con búsqueda + filtros de status. |
| ERP-007 | [src/components/clients/CreateClientDialog.tsx:1](src/components/clients/CreateClientDialog.tsx:1) | Dialog con todos los campos. |
| ERP-008 | [src/components/clients/ClientDetail.tsx:1](src/components/clients/ClientDetail.tsx:1) | Detalle multi-tab editable; delete admin-only via UI. |
| ERP-009 | [src/components/clients/ClientUsersTab.tsx:1](src/components/clients/ClientUsersTab.tsx:1), tabla `client_team_members` | Asociar usuarios al cliente con rol específico. |
| ERP-012 a 015 | [src/components/admin/RBACPermissionsTab.tsx:1](src/components/admin/RBACPermissionsTab.tsx:1) | Panel RBAC con 7 roles definidos y matriz de permisos editable. |
| ERP-016 a 019 | [src/components/team/TeamHub.tsx:1](src/components/team/TeamHub.tsx:1), [src/hooks/useTeamMembers.ts:1](src/hooks/useTeamMembers.ts:1) | TeamHub gestiona equipos, búsqueda, miembros. |

### 4.3 ERP — Gestión de equipos de trabajo (10 ✅)

| ID | Evidencia file:line | Cómo se cumple |
|---|---|---|
| ERP-029, 030 | [src/pages/TasksDashboard.tsx:1](src/pages/TasksDashboard.tsx:1), [src/hooks/useTaskDetails.ts:1](src/hooks/useTaskDetails.ts:1) | Listado propio (filtro `assigned_to=user`) y supervisados (filtro por jerarquía). |
| ERP-031, 032, 033 | [src/pages/TasksDashboard.tsx:28](src/pages/TasksDashboard.tsx:28), [src/pages/TeamScrumDashboard.tsx:1](src/pages/TeamScrumDashboard.tsx:1) | Vistas con filtros + calendario. |
| ERP-034 a 036 | [src/components/tasks/EditTaskDialog.tsx:1](src/components/tasks/EditTaskDialog.tsx:1), [src/components/clients/tabs/TasksTab.tsx:85](src/components/clients/tabs/TasksTab.tsx:85) | CRUD completo + finalizar/cancelar via status update. |
| ERP-037, 038 | [src/components/team/AITimeCapture.tsx:42](src/components/team/AITimeCapture.tsx:42), [src/hooks/useTimeTracking.ts:1](src/hooks/useTimeTracking.ts:1), [src/components/admin/TimeAuditPanel.tsx:12](src/components/admin/TimeAuditPanel.tsx:12) | Registro de tiempo + auditoría. |

### 4.4 ERP — Contratos y facturación (6 ✅)

| ID | Evidencia file:line | Cómo se cumple |
|---|---|---|
| ERP-063 a 067 | [src/components/clients/ContractsSLATab.tsx:1](src/components/clients/ContractsSLATab.tsx:1), [src/hooks/useClientContracts.ts:1](src/hooks/useClientContracts.ts:1), tablas `client_contracts` + `client_slas` | Tab "Contratos & SLA" en detalle de cliente con CRUD completo de contratos (bolsa de horas, fee mensual, proyecto cerrado, T&M) y SLAs por prioridad/case_type. |
| ERP-072 | [src/components/dashboard/CEODashboard.tsx](src/components/dashboard/CEODashboard.tsx), [src/components/clients/ClientList.tsx](src/components/clients/ClientList.tsx) | Vista global de clientes con health, semáforos y métricas. |

### 4.5 ERP — Seguimiento a solicitudes (13 ✅)

| ID | Evidencia file:line | Cómo se cumple |
|---|---|---|
| ERP-073 | [src/components/support/SupportDashboard.tsx:1](src/components/support/SupportDashboard.tsx:1), [src/hooks/useSupportTickets.ts:1](src/hooks/useSupportTickets.ts:1) | Dashboard de soporte con filtros, búsqueda, savedViews. |
| ERP-074 | [src/components/support/NewTicketForm.tsx:111](src/components/support/NewTicketForm.tsx:111) | Form de creación con los 3 tipos. |
| ERP-075, 076 | [src/components/support/TicketDetailSheet.tsx:1](src/components/support/TicketDetailSheet.tsx:1), [src/components/support/SupportCaseDetailPanel.tsx:1](src/components/support/SupportCaseDetailPanel.tsx:1), bucket `support-ticket-attachments` | CRUD ticket + adjuntos. |
| ERP-077, 078 | [src/components/support/SubtaskList.tsx:1](src/components/support/SubtaskList.tsx:1), tabla `support_ticket_subtasks` | Subtareas asociadas al ticket. |
| ERP-079, 080 | [src/components/support/ReopenReasonDialog.tsx:1](src/components/support/ReopenReasonDialog.tsx:1), [src/components/support/TicketReopensTimeline.tsx:1](src/components/support/TicketReopensTimeline.tsx:1), [src/hooks/useReopenTicket.ts:1](src/hooks/useReopenTicket.ts:1), tabla `support_ticket_reopens` | Sistema completo de reaperturas = "cambios/incidencias" del ciclo del ticket. |
| ERP-081 a 084 | [src/components/support/SupportCaseDetailPanel.tsx:1](src/components/support/SupportCaseDetailPanel.tsx:1), tabla `comments` con `is_internal` | Mesa de discusión + CRUD de comentarios + adjuntos (bucket `support-ticket-attachments`). |
| ERP-089 | [src/components/dashboard/ActionQueue.tsx:1](src/components/dashboard/ActionQueue.tsx:1) | "ActionQueue" lista comentarios pendientes de atender por el usuario. |

### 4.6 ERP — Funcionalidades generales (2 ✅)

| ID | Evidencia file:line | Cómo se cumple |
|---|---|---|
| ERP-090 | [src/pages/Login.tsx:94](src/pages/Login.tsx:94), [src/hooks/useAuth.tsx:1](src/hooks/useAuth.tsx:1) | Auth Supabase Auth. |
| ERP-091 | RLS + `has_role()`/`is_staff_user()`/`user_can_see_client()` en todas las tablas, [src/pages/Index.tsx:1](src/pages/Index.tsx:1) | Autorización por rol con render condicional + RLS estricto. |

### 4.7 ERP — Nuevas (prototipo) (17 ✅)

| ID | Evidencia file:line | Cómo se cumple |
|---|---|---|
| ERP-092 | [src/components/clients/ContractsSLATab.tsx:1](src/components/clients/ContractsSLATab.tsx:1), tabla `client_slas` | SLAs por prioridad y tipo de caso, configurables por cliente. |
| ERP-093, 094 | [src/components/support/SupportCaseDetailPanel.tsx:1](src/components/support/SupportCaseDetailPanel.tsx:1), tabla `support_ticket_notes` con `is_internal` flag | Notas internas en tickets (RLS oculta a `cliente`). |
| ERP-095 | [src/pages/TeamScrumDashboard.tsx:1](src/pages/TeamScrumDashboard.tsx:1), [src/hooks/useTeamScrum.ts:1](src/hooks/useTeamScrum.ts:1), [src/components/scrum/](src/components/scrum/) | Board Scrum/Kanban completo con sprints, dailies, retros, planning. |
| ERP-096 | [src/components/support/CaseStrategyPanel.tsx:18](src/components/support/CaseStrategyPanel.tsx:18), [supabase/functions/case-strategy-ai/index.ts](supabase/functions/case-strategy-ai/index.ts) | Estrategia IA por caso. |
| ERP-097 | [src/components/support/ReopensInsightsPanel.tsx:1](src/components/support/ReopensInsightsPanel.tsx:1), [supabase/functions/notify-recurring-reopens/index.ts](supabase/functions/notify-recurring-reopens/index.ts) | Alerta de tickets con +3 reaperturas + insights agregados. |
| ERP-099 | [src/components/team/AITimeCapture.tsx:42](src/components/team/AITimeCapture.tsx:42), [supabase/functions/parse-time-entry/index.ts](supabase/functions/parse-time-entry/index.ts) | Captura IA: usuario escribe texto libre → IA extrae tarea/cliente/duración. |
| ERP-100 | tabla `time_weekly_locks`, [src/hooks/useTimeAudit.ts:1](src/hooks/useTimeAudit.ts:1), [src/components/admin/TimeAuditPanel.tsx:12](src/components/admin/TimeAuditPanel.tsx:12) | Cierre semanal con bloqueo de edición. |
| ERP-101 | [supabase/functions/summarize-transcript/index.ts](supabase/functions/summarize-transcript/index.ts), [src/components/clients/CreateMinutaWizard.tsx](src/components/clients/CreateMinutaWizard.tsx) | Transcript → IA → minuta estructurada. |
| ERP-102 | [src/components/dashboard/SharedMinutasPanel.tsx:28](src/components/dashboard/SharedMinutasPanel.tsx:28), [src/pages/SharedPresentation.tsx:1](src/pages/SharedPresentation.tsx:1), tablas `meeting_minutes` + `shared_presentations` | Crear minuta, asociar al cliente, compartir vía link público. |
| ERP-103 | [src/pages/ColaboradorDashboard.tsx:30](src/pages/ColaboradorDashboard.tsx:30), [src/pages/Index.tsx:8](src/pages/Index.tsx:8) | Dashboard del rol `colaborador` con tareas, tiempos, kudos. |
| ERP-104 | [src/components/dashboard/CEODashboard.tsx:39](src/components/dashboard/CEODashboard.tsx:39), [supabase/functions/executive-ai-chat/index.ts](supabase/functions/executive-ai-chat/index.ts) | Chat IA ejecutivo (CEO/admin) sobre la salud global. |
| ERP-105 | [src/components/scrum/PMAIPanel.tsx:10](src/components/scrum/PMAIPanel.tsx:10), [supabase/functions/pm-ai-analysis/index.ts](supabase/functions/pm-ai-analysis/index.ts) | PM AI analiza solicitudes y prioriza. |
| ERP-106 | [supabase/functions/analyze-team-scrum/index.ts](supabase/functions/analyze-team-scrum/index.ts), [src/pages/TeamScrumDashboard.tsx](src/pages/TeamScrumDashboard.tsx) | IA analiza salud del sprint, predice cumplimiento. |
| ERP-107 | [supabase/functions/analyze-team-activity/index.ts](supabase/functions/analyze-team-activity/index.ts), [supabase/functions/analyze-team-level/index.ts](supabase/functions/analyze-team-level/index.ts) | Análisis IA de equipo (RRHH/coaching). |
| ERP-108 | [src/components/team/MemberAIAgentPanel.tsx:1](src/components/team/MemberAIAgentPanel.tsx:1), [supabase/functions/member-agent-chat/index.ts](supabase/functions/member-agent-chat/index.ts) | Cada colaborador tiene su agente IA personal. |
| ERP-109 | [src/hooks/useActivityTracker.tsx:13](src/hooks/useActivityTracker.tsx:13), tabla `user_sessions` + `user_activity_log` | Tracking de sesión y actividad por usuario. |

---

## 5. Hallazgos extra (➕ funcionalidad implementada fuera del Story Mapping)

Estas capacidades existen en el código y **no aparecen en las 127 filas**. Vale la pena reconocerlas porque suman al backlog real entregado:

1. **Forecast de Sprint (IA)** — [supabase/functions/forecast-sprint/index.ts](supabase/functions/forecast-sprint/index.ts), [src/hooks/useSprintCeremonies.ts:129](src/hooks/useSprintCeremonies.ts:129). IA predice velocity y fecha de cierre.
2. **Policy AI Assistant** — [supabase/functions/policy-ai-assistant/index.ts](supabase/functions/policy-ai-assistant/index.ts). Asistencia IA para diseñar pólizas/contratos.
3. **Mentor AI** — [supabase/functions/mentor-ai/index.ts](supabase/functions/mentor-ai/index.ts), tabla `mentor_conversations`. Coaching IA individual a colaboradores.
4. **Career Path Analysis (IA)** — [supabase/functions/analyze-career-path/index.ts](supabase/functions/analyze-career-path/index.ts), [supabase/functions/analyze-cv/index.ts](supabase/functions/analyze-cv/index.ts), tabla `team_career_paths`. Plan de carrera IA por colaborador.
5. **Recommend Team for Client (IA)** — [supabase/functions/recommend-team-for-client/index.ts](supabase/functions/recommend-team-for-client/index.ts). Recomendación IA de equipo óptimo para un cliente.
6. **SVA Strategy (IA)** — [supabase/functions/sva-strategy/index.ts](supabase/functions/sva-strategy/index.ts), [src/hooks/useSVAStrategy.ts](src/hooks/useSVAStrategy.ts). Estrategia IA de Customer Success.
7. **Client Strategy (IA)** — [supabase/functions/client-strategy-ai/index.ts](supabase/functions/client-strategy-ai/index.ts), [src/components/support/ClientStrategyPanel.tsx](src/components/support/ClientStrategyPanel.tsx). Estrategia IA por cliente.
8. **Classify Tickets (IA)** — [supabase/functions/classify-tickets/index.ts](supabase/functions/classify-tickets/index.ts). Autoclasificación IA de tickets entrantes.
9. **Decrypt Ticket (IA)** — [supabase/functions/decrypt-ticket/index.ts](supabase/functions/decrypt-ticket/index.ts). Análisis IA de tickets ambiguos.
10. **Member AI Weekly Digest** — [supabase/functions/member-agent-weekly-digest/index.ts](supabase/functions/member-agent-weekly-digest/index.ts), tabla `member_ai_digests`. Digest semanal IA personalizado.
11. **Team Skills Matrix** — [src/hooks/useTeamSkills.ts](src/hooks/useTeamSkills.ts), tabla `team_member_skills`. Matriz de competencias por miembro.
12. **Recognition Wall / Kudos** — [src/components/team/RecognitionWall.tsx](src/components/team/RecognitionWall.tsx), tablas `team_kudos` + `team_badges`. Sistema peer-to-peer de reconocimiento.
13. **Onboarding Tracker** — [src/components/team/OnboardingTracker.tsx](src/components/team/OnboardingTracker.tsx), tabla `team_onboarding`. Seguimiento estructurado del onboarding.
14. **Learning Courses** — tablas `learning_courses` + `learning_enrollments`. Cursos internos con tracking de progreso.
15. **Case Compliance** — [src/components/support/CaseCompliancePanel.tsx](src/components/support/CaseCompliancePanel.tsx), tabla `case_compliance`. Auditoría de cumplimiento de proceso por caso.
16. **Ticket Sharing Links** — [src/components/support/ShareTicketHistoryDialog.tsx](src/components/support/ShareTicketHistoryDialog.tsx), tabla `shared_ticket_history`. Compartir historial de ticket vía link público con expiración.
17. **Support Presentation Sharing** — [src/components/support/ShareSupportPresentationDialog.tsx](src/components/support/ShareSupportPresentationDialog.tsx), tabla `shared_support_presentations`. Presentaciones de soporte compartibles.
18. **Minute Feedback** — [src/components/support/MinuteFeedbackList.tsx](src/components/support/MinuteFeedbackList.tsx), tabla `support_minutes_feedback`. Recolectar feedback post-minuta.
19. **DevOps Sync (Azure)** — [supabase/functions/sync-devops/index.ts](supabase/functions/sync-devops/index.ts), [src/hooks/useDevOps.ts](src/hooks/useDevOps.ts), tablas `devops_connections` + `devops_sync_mappings` + `devops_sync_logs`. Sync bidireccional de tasks con Azure DevOps.
20. **AI Usage Logs** — tabla `ai_usage_logs`, [src/hooks/useAIUsageLogs.ts](src/hooks/useAIUsageLogs.ts). Tracking de consumo IA por usuario/función.
21. **Sprint Ceremonies (Dailies/Retros/Reviews)** — tablas `sprint_dailies` + `sprint_retrospectives` + `sprint_reviews`. Ceremonias Scrum trackeadas.

---

## 6. Recomendación de prioridades (no parte del scope, sólo orientativo)

Si AWT debe priorizar el cierre del gap, en orden costo/valor:

1. **Cotizaciones (PORTAL-005 + ERP-085 a 088)** — alto valor de negocio (cerrar ciclo comercial); baja complejidad técnica (tabla `quotes` + componente + RLS estándar). **Estimado: 1 sprint**.
2. **Catálogo de motivos de cambios/incidencias (ERP-052 a 054)** — quita texto duro del código; permite a soporte agregar nuevos motivos sin redeploy. **Estimado: 0.5 sprint**.
3. **Estado de cuenta del cliente (ERP-071)** — facturación. Aprovecha `client_financials` existente; falta el reporte/PDF. **Estimado: 1 sprint**.
4. **Supervisiones formales (ERP-020 a 025)** — quita la inferencia por rol. Permite escenarios fuera del organigrama lineal. **Estimado: 1 sprint**.
5. **Audiencias de notificación (ERP-010, ERP-011)** — útil cuando el sistema escale a más clientes y notificaciones. **Estimado: 1 sprint**.
6. **Catálogos SVA completos (ERP-048 a 062)** — el más grande pero también el más opcional. La operación funciona hoy sin ellos. **Estimado: 2-3 sprints** si se prioriza.

Lo más urgente es **cotizaciones**, porque es el único hueco que rompe el ciclo de negocio (cliente solicita → cotizan → aprueba → ejecutan). Hoy ese ciclo se hace por fuera del ERP.

---

*Reporte generado por análisis de código file:line. Las 127 filas de origen están en `docs/story_mapping_requerimientos.csv`. Para regenerar este reporte cuando cambie el código, correr `/gap-storymapping all`.*
