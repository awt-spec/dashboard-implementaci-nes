
# Análisis: Huecos y problemas estructurales del backend

## Resumen del análisis

Revisé las 50 tablas de la BD, RLS, triggers, integridad referencial, índices, storage y datos reales. La aplicación **NO tiene corrupción de datos** (0 huérfanos, 0 duplicados, 0 PKs faltantes), pero hay **6 problemas estructurales** que pueden romper el aplicativo en distintos escenarios.

---

## Problemas encontrados (priorizados)

### 🔴 CRÍTICO #1 — Trigger `on_auth_user_created` no existe
La función `handle_new_user()` está definida y crea el `profile` automáticamente al registrarse un usuario. **PERO el trigger sobre `auth.users` no está creado** (la BD reporta 0 triggers).

**Impacto:** Hoy todos los 43 users tienen profile/role porque fueron creados desde `manage-users` edge function (que los inserta manualmente). Pero si un usuario se registra desde la pantalla de Login normal (signup público) o por OAuth/Google → **no se le creará `profiles` ni `user_roles`**, quedando en estado roto: no podrá entrar al sistema, las RLS de `gerente_client_assignments` y `profiles` fallarán silenciosamente.

**Fix:** Crear trigger + extender `handle_new_user()` para asignar también un `user_role` por defecto (`gerente` o el que aplique según `raw_user_meta_data`).

---

### 🔴 CRÍTICO #2 — Identidad de tickets duplicable entre clientes
Hay índice único `(client_id, ticket_id)` ✓, pero el PK es solo `id` (uuid). El código en varios lugares filtra solo por `ticket_id` global (e.g. `useSupportTicketDetails`). Verifiqué: hoy no hay duplicados, pero cuando dos clientes registren un ticket con el mismo número (común en sistemas externos), las consultas `.eq("ticket_id", X).maybeSingle()` van a fallar con "more than one row".

**Fix:** Auditar todas las queries `.eq("ticket_id", ...)` para asegurar que también filtran por `client_id`, o usar `.eq("id", ...)` (UUID).

---

### 🟠 ALTO #3 — RLS "Allow all" en 110+ políticas (sin protección real)
El linter reporta **108 políticas con `USING (true)` / `WITH CHECK (true)` para INSERT/UPDATE/DELETE** en casi todas las tablas. Cualquier persona con la `anon key` (que está en el bundle del frontend) puede:
- Borrar todos los clientes, tickets, minutas
- Modificar usuarios y roles ajenos
- Insertar feedback falso, notificaciones spam, asignaciones de gerente

**No rompe el app hoy**, pero un atacante (o un bug en código) puede dejar la BD inutilizable en segundos. Las tablas más expuestas: `clients`, `tasks`, `support_tickets`, `meeting_minutes`, `shared_presentations`, `support_minutes`.

**Fix sugerido (incremental):** Reemplazar `USING (true)` por `USING (auth.uid() IS NOT NULL)` en INSERT/UPDATE/DELETE de tablas críticas, manteniendo SELECT abierto solo donde hace falta (tokens públicos de presentaciones compartidas).

---

### 🟠 ALTO #4 — Storage buckets públicos permiten listing
3 buckets públicos (`presentation-media`, `task-attachments`, `support-ticket-attachments`) tienen política SELECT que permite **listar TODOS los archivos** de cualquier cliente. Cualquiera con el bucket name puede enumerar archivos de todos los clientes.

**Fix:** Cambiar política SELECT para requerir conocer la ruta completa, o restringir por carpeta `(storage.foldername(name))[1] = client_id`.

---

### 🟡 MEDIO #5 — `sysde_team_members.user_id` nullable + sin unique
La columna `user_id` es nullable (correcto, miembros sin acceso aún) pero **NO tiene índice único**. Si se llama dos veces a "Crear acceso" para el mismo miembro, se asocian dos auth users distintos al mismo registro → duplica logins, rompe el conteo de "Acceso activo".

**Fix:** Agregar `UNIQUE INDEX (user_id) WHERE user_id IS NOT NULL`.

---

### 🟡 MEDIO #6 — `client_dashboard_config` sin política DELETE
La tabla tiene policies para SELECT/INSERT/UPDATE pero **no DELETE**. Si el código intenta limpiar la config de un usuario eliminado, fallará silenciosamente con 0 rows affected (RLS bloquea).

**Fix:** Agregar policy `DELETE` con `auth.uid() = user_id` o cascade desde delete de auth user.

---

### 🟢 BAJO #7 — Otros hallazgos menores
- 3 `shared_presentations` ya expirados pero siguen visibles (no se limpian). Cleanup job sería bueno.
- `handle_new_user()` y `record_task_history()` tienen `search_path` mutable (warning menor de seguridad).
- "Leaked password protection" desactivada en Auth (warning).
- Tabla `client_notifications` no tiene índice por `(client_id, is_read, created_at)` → consultas del campanario lentas cuando crezca.

---

## Plan de implementación propuesto

```text
Migration única que aplica:
1. CREATE TRIGGER on_auth_user_created en auth.users → handle_new_user()
2. Extender handle_new_user para insertar user_role por defecto
3. CREATE UNIQUE INDEX en sysde_team_members(user_id) WHERE NOT NULL
4. Policy DELETE en client_dashboard_config
5. Endurecer RLS de tablas críticas (clients, tasks, support_tickets,
   meeting_minutes, user_roles, profiles) → requerir auth.uid() IS NOT NULL
   en INSERT/UPDATE/DELETE
6. Restringir SELECT de storage buckets para no permitir listing
7. Fix search_path en las 2 funciones
8. Índice (client_id, is_read, created_at DESC) en client_notifications
```

Adicionalmente, **revisar código frontend** en `useSupportTicketDetails` y similares para garantizar que filtran por `(client_id, ticket_id)` o por `id`.

## ¿Qué quieres que haga?

Puedo aplicar todo el plan (migración + ajustes de código), o priorizar solo los críticos (#1, #2). Confírmame para proceder.
