---
description: Gap analysis del Story Mapping (requerimientos) contra el código real del repo. Clasifica cada funcionalidad en Implementada / Parcial / Ausente con evidencia file:line.
argument-hint: [sistema: erp|portal|all] [etapa-filtro-opcional]
allowed-tools: Read, Grep, Glob, Bash(cat:*), Bash(rg:*), Bash(ls:*), Bash(find:*), Bash(wc:*)
model: opus
---

## Fuentes de verdad

- Matriz de requerimientos (127 funcionalidades, una por fila, con ID estable): @docs/story_mapping_requerimientos.csv
- Arquitectura del repo (dónde vive cada cosa): @ARCHITECTURE.md

Columnas del CSV: `id, sistema, etapa, accion_usuario`.
`sistema` es `ERP` (109 filas) o `PORTAL` (18 filas, = la Intranet / portal del cliente externo).
IMPORTANTE: en este repo el Portal del cliente NO es un proyecto separado — es el rol `cliente` dentro del mismo SPA (render condicional por rol en `src/pages/Index.tsx`). Buscá ambos sistemas en el MISMO codebase.

## Alcance de esta corrida

- `$1` define qué auditar: `erp` (solo filas ERP-*), `portal` (solo PORTAL-*), o `all` (default si no se pasa).
- `$2` (opcional) = filtro de etapa: si está presente, auditá solo las filas cuya columna `etapa` contenga ese texto (case-insensitive). Ej: `/gap-storymapping erp facturación`.

## Cómo buscar evidencia (orden obligatorio, NO adivines)

Para CADA fila en alcance, andá a buscar evidencia REAL en el código antes de clasificar. Mapa de dónde mirar según el `sistema` y la `etapa`:

- Administración de actores → `src/components/admin/`, `src/pages/AdminUsers.tsx`, `supabase/functions/manage-users/`, migraciones con `user_roles`, `profiles`, `teams`, `supervis`.
- Gestión de equipos de trabajo (tareas, calendario, tiempos) → `src/components/tasks/`, `src/components/team/`, `src/hooks/useTeamScrum.ts`, `TimeTracking*`, migraciones `tasks`, `time_*`.
- Configuración de productos de software → `src/components/settings/`, migraciones `products`, `modules`, `versions`.
- Configuración de SVA / Customer Success → `src/components/settings/`, `BusinessRulesPanel`, catálogos (`motivos`, `categorias`, `plantillas`, `paquetes`), migraciones relacionadas.
- Gestión de contratos y facturación → `src/components/clients/ContractsSLATab*`, migraciones `contracts`, `polizas`, `paquetes`, `estado_cuenta`, `billing`.
- Seguimiento a solicitudes de servicio (tickets) → `src/components/support/` (41 comp.), `src/hooks/useSupportTickets.ts`, mesa de discusión (comments/threads), cotizaciones (`quotes`), adjuntos (buckets `support-ticket-attachments`).
- Funcionalidades generales (auth, autorización, notificaciones, cambio de contraseña) → `src/hooks/useAuth.tsx`, RLS / `has_role`, `supabase/functions/send-notification-email/`, `notify-*`.
- Nuevas funcionalidades del prototipo (SLA, notas internas, board Scrum/Kanban, IA, info 360, captura IA de tiempos, minutas IA, dashboards) → `src/components/scrum/`, `src/components/clients/*Minuta*`, `src/components/team/MemberAIAgentPanel*`, y el inventario de Edge Functions de IA en `supabase/functions/` (`case-strategy-ai`, `executive-ai-chat`, `client-strategy-ai`, `analyze-*`, `classify-tickets`, etc. — ver tabla §5.2 de ARCHITECTURE.md).
- Portal / cliente externo → todo lo anterior PERO filtrando a lo que el rol `cliente` puede ver: `src/pages/Index.tsx` (switch por rol), componentes `Shared*.tsx`, vistas read-only, y RLS que exponen datos al `cliente`.

Técnica: usá `rg` (ripgrep) con términos del dominio en español Y inglés (el código mezcla ambos: "cotización"→`quote`, "solicitud"→`ticket/request`, "mesa de discusión"→`thread/comment/discussion`, "póliza"→`policy/contract`, "supervisión"→`supervis`). Verificá que el match es funcionalidad real (componente montado + hook + tabla/RLS o edge function), no un string suelto.

## Criterio de clasificación (estricto)

- **✅ Implementada** — existe UI montada + capa de datos (hook/query o edge function) + persistencia (tabla/RLS o storage). Las 3 capas presentes.
- **🟡 Parcial** — existe evidencia pero incompleta: UI sin backend, backend sin UI, CRUD a medias (ej. crear pero no editar/eliminar), o presente solo para un rol cuando el requerimiento implica más. Explicá QUÉ falta.
- **❌ Ausente** — sin evidencia creíble en el repo.
- **➕ Extra** (opcional) — si encontrás funcionalidad relevante en el código que NO está en el Story Mapping, anotala al final como hallazgo, no la fuerces a una fila.

Regla dura: NO clasifiques como Implementada sin al menos una cita `ruta/archivo.tsx:línea`. Sin evidencia file:line ⇒ como máximo 🟡, y si no hay nada ⇒ ❌. No infieras del nombre de un archivo: abrilo y confirmá.

## Output

1. **Resumen ejecutivo** (4-6 líneas, lenguaje de negocio): cuántas ✅ / 🟡 / ❌ sobre el total en alcance, y los 3 huecos más grandes para AWT.
2. **Tabla de cobertura por etapa**: etapa · total · ✅ · 🟡 · ❌ · % implementado.
3. **Detalle por funcionalidad** (solo 🟡 y ❌, las ✅ van resumidas): `id` · `accion_usuario` · estado · evidencia (file:line o "ninguna") · qué falta.
4. **Hallazgos ➕** (extras en código fuera del mapa), si los hay.

Escribí el reporte completo en `docs/gap-storymapping-<sistema>-<YYYY-MM-DD>.md`. No modifiques código en esta corrida — es read-only, solo diagnóstico.

Si el CSV o el ARCHITECTURE.md no existen en las rutas indicadas, pará y decímelo en vez de adivinar.
