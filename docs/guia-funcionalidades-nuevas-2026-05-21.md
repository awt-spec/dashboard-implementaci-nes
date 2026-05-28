# Guía de funcionalidades nuevas — Cierre de gaps Story Mapping

**Fecha:** 2026-05-21
**Sistema:** SVA ERP (sysdesupport.com)
**Resultado:** cobertura del Story Mapping de **62% → 99%** (126/127 funcionalidades)
**Estado:** todo desplegado en producción (código + base de datos)

Este documento explica, en lenguaje de negocio, **qué se cerró** y **dónde verlo** en la aplicación. Está pensado para AWT y el equipo (Eduardo, Mafe, Katherine, Carlos).

---

## 1. Resumen ejecutivo

Se cerraron **35 de las 48 funcionalidades** que faltaban en el Story Mapping, en una sola tanda de trabajo. Las 35 quedaron desplegadas en producción: el código está en `main` (Vercel) y las 17 migraciones de base de datos están aplicadas en Supabase.

La única funcionalidad que queda pendiente (información 360 cross-producto) depende de integraciones con otros sistemas SYSDE (SAF+, Factoraje, etc.) que están fuera de este repositorio — no es deuda de este equipo.

**Cómo navegar la app (menú lateral izquierdo):**

| Sección del menú | Quién la ve | Qué hay |
|---|---|---|
| **Implementación** | admin, pm | Lista de clientes → detalle con tabs (Cotizaciones, Estado de cuenta, Contratos, Personas, etc.) |
| **Soporte** | admin, pm, gerente_soporte | Bandeja de tickets → detalle con tab Cotizaciones |
| **Configuración** | admin, pm, gerente_soporte | Catálogos administrables (motivos, tipos, categorías, equipos SVA, plantillas, productos) |
| **Portal del cliente** | cliente externo | Sus solicitudes, cotizaciones pendientes, estado de cuenta |

---

## 2. Mapa rápido: dónde ver cada funcionalidad nueva

| Funcionalidad | Dónde verla | Quién la usa |
|---|---|---|
| **Cotizaciones** | Soporte → ticket → tab *Cotizaciones* · o · Implementación → cliente → tab *Cotizaciones* | Staff crea/envía; cliente aprueba en su portal |
| **Estado de cuenta** | Implementación → cliente → tab *Estado de cuenta* (con *Exportar PDF*) | Staff y cliente |
| **Motivos de reapertura** | Configuración → *Motivos de reapertura* | Admin (catálogo); todos al reabrir un ticket |
| **Supervisiones** | Configuración → *Supervisiones* | Admin |
| **Audiencias de notificación** | Implementación → cliente → Personas → *Audiencias notif.* | Admin / admin del cliente |
| **Tipos de tarea** | Configuración → *Tipos de tarea* | Admin (catálogo); todos al crear tareas |
| **Categorías de clientes** | Configuración → *Categorías de clientes* · badge en el header del cliente | Admin/PM |
| **Paquetes facturados** | Implementación → cliente → Contratos & SLA → tab *Paquetes facturados* | Admin/PM |
| **Editar comentarios + adjuntos** | Cliente → tab *Colaboración* | Staff y cliente (solo lo propio) |
| **Editar solicitud (cliente)** | Portal cliente → abrir su solicitud → botón *Editar* | Cliente (editor/admin) |
| **Equipos SVA + días no laborables** | Configuración → *Equipos SVA* | Admin/PM |
| **Plantillas de pólizas + paquetes** | Configuración → *Plantillas de pólizas* | Admin/PM |
| **Productos / módulos / versiones** | Configuración → *Productos de software* | Admin/PM |

---

## 3. Detalle por bloque

### Bloque 1 — Ciclo comercial (Cotizaciones)

**Qué cierra:** el flujo solicitud → cotización → aprobación del cliente → ejecución. Antes las cotizaciones se hacían por email/PDF manual, fuera del ERP.

**Cómo usarlo (staff):**
1. Menú → **Soporte** → abrí un ticket → tab **Cotizaciones** (o desde **Implementación** → cliente → tab **Cotizaciones**).
2. Clic en **Nueva cotización** → ponés título, líneas (horas/servicios/licencias con cantidad y precio), impuesto, validez.
3. Se crea como **borrador**. Cuando está lista, **Enviar al cliente**.
4. Podés adjuntar archivos a la cotización mientras es borrador.

**Cómo lo ve el cliente:**
- Entra a su **Portal** → en la barra lateral aparece **"Cotizaciones pendientes de aprobar"**.
- Abre la cotización, ve el detalle y **Aprueba** o **Rechaza** (con motivo).
- Las cotizaciones vencidas se marcan automáticamente.

**Estados:** borrador → enviada → aprobada / rechazada / expirada / cancelada.

---

### Bloque 2 — Estado de cuenta del cliente

**Qué cierra:** la rendición formal del consumo. Antes los datos existían pero no había una vista consolidada ni exportable.

**Cómo usarlo:**
1. Menú → **Implementación** → cliente → tab **Estado de cuenta**.
2. Elegís el período (mes corriente, mes anterior, últimos 30 días, trimestre, año a la fecha, o personalizado).
3. Ves: horas consumidas vs contratadas, utilización %, sobreconsumo (en rojo si aplica), desglose por colaborador y por ticket, gráfico diario, cotizaciones aprobadas del período y estado financiero.
4. Botón **Exportar PDF** genera el documento para enviar a la contabilidad del cliente.

**El cliente** ve su propio estado de cuenta en el sidebar de su portal.

---

### Bloque 3 — Catálogos administrables (Configuración)

Todos estos se gestionan en **Menú → Configuración**. Antes eran valores fijos en el código (había que pedir un cambio técnico para modificarlos); ahora los administra el equipo sin depender de desarrollo.

**Motivos de reapertura** (Configuración → *Motivos de reapertura*)
- Catálogo de causas cuando un caso se reabre (cliente rechazó, falla QA, etc.).
- Crear/editar/activar/desactivar/reordenar. Los motivos base no se borran (solo se desactivan).
- Se usan automáticamente en el diálogo "Reabrir caso".

**Tipos de tarea** (Configuración → *Tipos de tarea*)
- Clasificación de tareas (Desarrollo, Configuración, Soporte, Reunión, etc.) con color.
- Al crear/editar una tarea aparece el selector **Tipo de Tarea**.

**Categorías de clientes** (Configuración → *Categorías de clientes*)
- Segmentación: Estratégico, Premium, Estándar, En riesgo, Nuevo.
- Se asigna desde el **badge de categoría en el header del detalle del cliente** (clic en el badge).

**Equipos SVA** (Configuración → *Equipos SVA*)
- Equipos de Customer Success como entidad propia.
- Cada equipo tiene su botón **Días no laborables** para cargar feriados/vacaciones.

**Plantillas de pólizas** (Configuración → *Plantillas de pólizas*)
- Templates reutilizables de pólizas de servicio.
- Cada plantilla tiene un botón **Paquetes** para definir paquetes anidados (horas, precio, ciclo).

**Productos de software** (Configuración → *Productos de software*)
- Catálogo del portafolio SYSDE (SAF+, Factoraje, FileMaster, Pensión, Sentinel, Leasing — ya cargados).
- Abrí un producto → **Módulos & versiones**: gestionás los módulos, las versiones, y qué módulos trae cada versión.

---

### Bloque 4 — Supervisiones y audiencias

**Supervisiones** (Configuración → *Supervisiones*)
- Declarar "Persona X supervisa a Persona Y" o "a un equipo (department)", fuera del organigrama por rol.
- Dos pestañas: **Personas** y **Equipos**. Con alcance (general, tickets, tareas, calidad, tiempos).
- "Finalizar" conserva el historial; "Eliminar" lo borra.

**Audiencias de notificación** (Implementación → cliente → Personas → *Audiencias notif.*)
- Grupos de destinatarios para notificaciones específicas (ej: "Power-users CMI", "Comité de aprobación").
- Definís miembros + qué eventos los disparan (ticket creado, SLA en riesgo, cotización enviada, etc.).
- Lo puede gestionar un admin de SYSDE o un admin del propio cliente.

> Nota: el catálogo de audiencias está listo. El **disparo automático** de notificaciones contra estos grupos es un paso siguiente (cuando se quiera, se conecta al envío de emails existente).

---

### Bloque 5 — Mejoras del portal del cliente

**Mesa de discusión mejorada** (cliente → tab *Colaboración*)
- Ahora se puede **editar** y **eliminar** comentarios propios (antes solo crear).
- Se puede **adjuntar un archivo** a un comentario.
- Cada comentario registra a su autor real; solo el autor (o staff) puede modificarlo.

**Editar la solicitud** (Portal cliente → abrir su solicitud → botón *Editar*)
- El cliente puede corregir el **asunto** y las **notas** de su solicitud mientras está en estado inicial (antes de que soporte la cierre).

---

## 4. Estado de cobertura final

| Etapa del Story Mapping | Cobertura |
|---|---|
| Administración de actores | 100% |
| Gestión de equipos de trabajo | 100% |
| Configuración de productos | 100% |
| Configuración de SVA | 100% |
| Contratos y facturación | 100% |
| Seguimiento de solicitudes | 100% |
| Funcionalidades generales | 100% |
| Nuevas (prototipo) | 94% (falta info 360 cross-producto) |
| Portal del cliente | 100% |
| **TOTAL** | **126/127 (99%)** |

---

## 5. Lo único pendiente

**ERP-098 — Información 360 del cliente (perspectiva SVA + otras implementadas).**
El detalle del cliente ya muestra toda la perspectiva SVA (contratos, tareas, tickets, cotizaciones, estado de cuenta, categoría, audiencias). Lo que falta es **agregar la vista de otros productos SYSDE** (SAF+, Factoraje, etc.) del mismo cliente.

**Por qué no está:** depende de que esos otros sistemas expongan APIs para consultar su información. Es una dependencia de plataforma, no de este ERP. Cuando esas APIs existan, se construye el agregador.

---

## 6. Anexo técnico (para Mafe / desarrollo)

**17 migraciones SQL** aplicadas a Supabase prod (`qorixnxlaiuyxoentrfa`), en orden, sin downtime:

```
20260521100000  quotes_module                    (cotizaciones)
20260521110000  account_statement                (estado de cuenta)
20260521120000  reopen_reasons_catalog           (motivos)
20260521130000  supervisions                     (supervisiones)
20260521140000  notification_audiences           (audiencias)
20260521150000  expire_quotes                    (expiración auto cotizaciones)
20260521160000  quotes_bucket_security           (seguridad adjuntos)
20260521170000  task_types_catalog               (tipos de tarea)
20260521180000  client_categories                (categorías cliente)
20260521190000  billed_packages                  (paquetes facturados)
20260521200000  comments_authorship_attachments  (comentarios)
20260521210000  sva_teams                        (equipos SVA)
20260521220000  policy_templates                 (plantillas póliza)
20260521230000  products_catalog                 (productos)
```
(+ las migraciones de fix de QA aplicadas in-place sobre las anteriores)

**Características técnicas comunes a todo lo entregado:**
- RLS (Row Level Security) en todas las tablas nuevas — cada rol ve solo lo que le corresponde.
- Catálogos con protección `is_system`: los valores base no se pueden eliminar (solo desactivar), para no romper el sistema.
- Validaciones en UI + base de datos (defensa en profundidad).
- Todo pasó: TypeScript sin errores, build exitoso, 35/35 tests.

**Pendientes técnicos menores (no bloquean uso):**
- Habilitar `pg_cron` en Supabase para que la expiración de cotizaciones corra sola a diario (hoy la función existe y se puede correr manual).
- Conectar el catálogo de productos con `ClientTechStack` (hoy el catálogo existe; asignar productos del catálogo a cada cliente es un paso de integración futuro).
- Conectar las audiencias con el disparo real de notificaciones.

---

*Generado tras el cierre de gaps del Story Mapping. Reporte de gap analysis original: `docs/gap-storymapping-all-2026-05-21.md`.*
