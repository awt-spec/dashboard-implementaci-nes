# SVA — Catálogo de eventos de dominio

> **Estado:** diseño a futuro. Por ADR-003, en Fase 2 **no hay event bus**. Este catálogo define el contrato que los servicios deben respetar **cuando** se introduzca event bus (Fase 5+), para que los publishers ya emitan con el shape correcto desde el inicio.

| | |
|---|---|
| **Formato** | [CloudEvents v1.0](https://cloudevents.io/) — agnóstico de transporte |
| **Transport futuro** | TBD en Fase 5. Candidatos: Upstash Redis Streams, RabbitMQ managed, Postgres `pg_notify` + Vercel Cron |
| **Versionado** | `<entity>.<action>.v<N>` — bump major en breaking change |
| **Retention default** | 30 días (90 días para `ai.*` por billing) |
| **Delivery** | At-least-once. Idempotency en consumers vía `id` del envelope |

---

## 1. Envelope estándar (CloudEvents v1.0)

Todos los eventos comparten este envelope:

```json
{
  "specversion": "1.0",
  "type": "ticket.reopened.v1",
  "source": "core-service",
  "id": "evt_01HXX5KJ8M0RC8N6T7Q4ZA9XYZ",
  "time": "2026-05-14T19:00:00Z",
  "subject": "ticket:uuid-del-ticket",
  "datacontenttype": "application/json",
  "data": { /* payload específico del evento */ }
}
```

**Campos:**

| Campo | Tipo | Notas |
|---|---|---|
| `specversion` | string | Siempre `"1.0"` |
| `type` | string | `<entity>.<action>.v<N>` — ej: `ticket.created.v1` |
| `source` | string | Nombre del servicio productor (`auth-service`, `ai-gateway`, `core-service`) |
| `id` | string | ULID/UUID único — **consumers usan para deduplicar** |
| `time` | string ISO 8601 | Timestamp UTC de creación |
| `subject` | string | Identificador del recurso afectado, formato `<entity>:<id>` |
| `datacontenttype` | string | `"application/json"` |
| `data` | object | Payload — schema por `type` |

**Headers de transport (cuando se publique):**

| Header | Valor | Propósito |
|---|---|---|
| `x-event-type` | mismo que `type` del envelope | Routing por consumer |
| `x-correlation-id` | request_id que originó el evento | Tracing distribuido |
| `x-actor-user-id` | UUID del user que disparó | Audit |

---

## 2. Inventario de eventos (v1)

### Productor: `auth-service`

| Type | Propósito | Consumers futuros |
|---|---|---|
| `user.created.v1` | Nuevo user staff o cliente | notifications-service (welcome email), core-service (cache invalidation) |
| `user.role_changed.v1` | Cambió rol de un user | core-service (invalidar cache de permisos) |
| `user.deleted.v1` | Soft delete de user | core-service (anonimizar audit logs) |
| `cliente_assignment.created.v1` | Cliente asignado a empresa | core-service (cache invalidation) |
| `cliente_assignment.revoked.v1` | Cliente revocado | core-service (invalidar sessions del user) |

### Productor: `core-service` — Tickets

| Type | Propósito | Consumers |
|---|---|---|
| `ticket.created.v1` | Nuevo ticket | notifications-service (Slack si crítico), ai-gateway (auto-classify si pendiente), reporting (counter++) |
| `ticket.assigned.v1` | Responsable asignado/cambiado | notifications-service (notif al nuevo responsable) |
| `ticket.status_changed.v1` | Cambio de estado | notifications-service (cliente notificado en ENTREGADA), reporting |
| `ticket.reopened.v1` | Reincidencia detectada | notifications-service (Slack si count ≥3), reporting (tasa reopens) |
| `ticket.classified.v1` | IA terminó de clasificar | core-service (update ai_classification, ai_risk_level), reporting |
| `ticket.sla_warning.v1` | Cruzó umbral 70% de deadline | notifications-service (alerta al responsable + gerente) |
| `ticket.sla_overdue.v1` | Pasó deadline | notifications-service (escalada), reporting |
| `ticket.decrypted.v1` | Admin descifró ticket confidencial | reporting (audit) |

### Productor: `core-service` — Sprints / Tasks

| Type | Propósito | Consumers |
|---|---|---|
| `sprint.created.v1` | Nuevo sprint | — |
| `sprint.started.v1` | Sprint pasó a activo | notifications-service (kickoff al equipo) |
| `sprint.completed.v1` | Sprint pasó a completado | reporting (velocity histórica) |
| `task.created.v1` | Nueva task de implementación | — |
| `task.assigned.v1` | Task asignada a colaborador | notifications-service (notif al asignado) |
| `task.completed.v1` | Task pasada a `done` | reporting |
| `task.blocked.v1` | Task marcada como bloqueada | notifications-service (alerta al PM) |

### Productor: `core-service` — Clients

| Type | Propósito | Consumers |
|---|---|---|
| `client.created.v1` | Nuevo cliente | reporting |
| `client.status_changed.v1` | Activo → en-riesgo, etc. | notifications-service (alerta C-level si en-riesgo) |
| `contract.renewed.v1` | Contrato renovado | reporting (revenue projection) |
| `contract.expiring.v1` | Contrato vence en <90 días | notifications-service (recordatorio comercial) |
| `deliverable.approved.v1` | Entregable aprobado por cliente | reporting |
| `minute.published.v1` | Minuta publicada para cliente | notifications-service (email al cliente) |

### Productor: `core-service` — Team & People

| Type | Propósito | Consumers |
|---|---|---|
| `time_entry.recorded.v1` | Time entry registrado | reporting |
| `time_entry.week_locked.v1` | Semana cerrada (no más edits) | notifications-service (recordatorio si incompleto) |
| `member.skill_added.v1` | Nueva skill registrada | ai-gateway (cache invalidation) |
| `member.cv_analyzed.v1` | CV procesado por IA | — |

### Productor: `ai-gateway`

| Type | Propósito | Consumers |
|---|---|---|
| `ai.call.completed.v1` | Inferencia exitosa | reporting (cost/usage tracking) |
| `ai.call.failed.v1` | Inferencia falló (timeout/overload/quota) | notifications-service (alerta DevOps si > N por hora), reporting |
| `ai.rate_limit_hit.v1` | Rate limit alcanzado por un user | reporting |
| `ai.cache_hit.v1` | Prompt cache hit (>5% savings) | reporting (cost analysis) |

---

## 3. Schemas detallados (payload `data`)

> Solo los más representativos. Los demás siguen el mismo patrón.

### `ticket.created.v1`

```json
{
  "ticket_id": "uuid",
  "ticket_code": "CFE-12345",
  "client_id": "string",
  "asunto": "string",
  "tipo": "string",
  "prioridad": "Critica, Impacto Negocio | Alta | Media | Baja",
  "estado": "PENDIENTE",
  "fuente": "cliente | interno | email | api | devops",
  "is_confidential": false,
  "created_by_user_id": "uuid",
  "created_at": "2026-05-14T19:00:00Z"
}
```

### `ticket.reopened.v1`

```json
{
  "ticket_id": "uuid",
  "ticket_code": "CFE-12345",
  "client_id": "string",
  "iteration_number": 3,
  "reason": "Cliente reportó que el bug no se resolvió",
  "reopen_type": "cliente_rechazo",
  "reopened_from_state": "ENTREGADA",
  "reopened_to_state": "EN ATENCIÓN",
  "responsible_at_reopen": "Hellen Calvo",
  "new_responsible": "Carlos Castante",
  "triggered_by_user_id": "uuid",
  "triggered_by_name": "Hellen Calvo",
  "current_count": 3,
  "delivered_at": "2026-05-10T15:30:00Z",
  "reopened_at": "2026-05-14T19:00:00Z"
}
```

### `ticket.sla_overdue.v1`

```json
{
  "ticket_id": "uuid",
  "ticket_code": "CFE-12345",
  "client_id": "string",
  "client_name": "CFE Panamá",
  "responsable": "Hellen Calvo",
  "prioridad": "Alta",
  "deadline_days": 7,
  "days_elapsed": 9,
  "days_over": 2,
  "sla_source": "policy_v4.5 | client_override"
}
```

### `ai.call.completed.v1`

```json
{
  "function_name": "case-strategy",
  "model": "claude-haiku-4-5",
  "user_id": "uuid",
  "client_id": "string",
  "ticket_id": "uuid",
  "elapsed_ms": 2437,
  "usage": {
    "input_tokens": 5588,
    "output_tokens": 1024,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 4567,
    "total_tokens": 6612
  },
  "estimated_cost_usd": 0.0034,
  "status": "success"
}
```

### `user.created.v1`

```json
{
  "user_id": "uuid",
  "email": "newuser@sysde.com",
  "full_name": "string",
  "role": "colaborador | admin | pm | cliente | gerente | ceo | gerente_soporte",
  "created_by_user_id": "uuid",
  "is_cliente": false,
  "cliente_assignment": null
}
```

---

## 4. Versionado y breaking changes

### Regla
- **Compatible (no rompe consumers):** agregar campos opcionales al payload. Mantener el mismo `type`.
- **Breaking (rompe consumers):**
  - Eliminar campo del payload.
  - Renombrar campo.
  - Cambiar tipo de campo (`string → integer`).
  - Cambiar semántica de un campo (mismo nombre, sentido distinto).

### Procedimiento de bump de versión
1. Crear schema `v2` co-existente con `v1`.
2. Productor publica **ambos** (`ticket.reopened.v1` Y `ticket.reopened.v2`) durante mínimo 60 días.
3. Consumers migran a `v2` en su propio ciclo.
4. Después de 60 días, productor deja de publicar `v1`.
5. Schema `v1` se archiva como histórico (no se elimina del catálogo).

---

## 5. Idempotencia y orden

### Idempotencia (en consumers)

Cada consumer mantiene una tabla local `processed_events(event_id PRIMARY KEY, processed_at)`. Antes de procesar:

```sql
INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING;
-- Si la inserción no insertó nada → ya procesado → skip
```

Esto es **at-least-once + dedup local** = exactly-once efectivo.

### Orden

- **Within entity (mismo `subject`):** orden garantizado. Ej: `ticket.created.v1` siempre antes de `ticket.status_changed.v1` del mismo ticket.
- **Cross-entity:** NO garantizado. Ej: `user.created.v1` no necesariamente antes de `ticket.created.v1` aunque el ticket sea creado por el user.

Cuando el orden cross-entity importa (ej: ai-gateway necesita user creado antes de clasificar tickets), el productor publica eventos compuestos o el consumer espera + reintenta.

---

## 6. Cómo se publica un evento (template TypeScript)

```ts
// packages/shared/events.ts
import { ulid } from "ulidx";

export async function publishEvent<T>(args: {
  type: string;            // ej: "ticket.reopened.v1"
  source: string;          // ej: "core-service"
  subject: string;         // ej: "ticket:uuid"
  data: T;
  correlation_id?: string;
}): Promise<void> {
  const envelope = {
    specversion: "1.0",
    type: args.type,
    source: args.source,
    id: `evt_${ulid()}`,
    time: new Date().toISOString(),
    subject: args.subject,
    datacontenttype: "application/json",
    data: args.data,
  };

  // EN FASE 2: NO HAY BUS — guardamos en una tabla outbox para procesar más tarde
  await db.from("event_outbox").insert({
    envelope,
    headers: { "x-correlation-id": args.correlation_id ?? "" },
  });

  // EN FASE 5: publicar al bus real
  // await bus.publish("events", envelope, headers);
}
```

### Patrón outbox transactional

Para que el evento sea consistente con la mutación de BD, ambos se hacen en la misma transacción:

```ts
await db.transaction(async (tx) => {
  const ticket = await tx.from("support_tickets").update({...}).eq("id", id).select().single();
  await publishEvent({
    type: "ticket.reopened.v1",
    source: "core-service",
    subject: `ticket:${ticket.id}`,
    data: { ... },
  });
});
```

Un worker separado (Vercel Cron cada 1 min) drena `event_outbox` → bus real cuando exista.

---

## 7. Estado actual vs futuro

| Evento | Hoy (Fase 2) | Futuro (Fase 5+) |
|---|---|---|
| `ticket.reopened.v1` | Frontend invoca `notify-recurring-reopens` directamente post-mutación. **Se pierde si tab cierra.** | core-service publica al bus, notifications-service consume confiable |
| `ticket.created.v1` (crítico) | Frontend invoca `notify-critical-ticket`. **Pérdida idem.** | Idem |
| Auto-clasificación con IA al crear ticket | No existe — hay que clickear "clasificar" manualmente | ai-gateway consume `ticket.created.v1` y clasifica async |
| Notificación SLA overdue | No existe | core-service publica desde un trigger SQL cron-able + consumer notifica |
| Tracking de costo IA real-time | No existe — solo `ai_usage_logs` agregable | reporting consume `ai.call.completed.v1` y calcula running cost |

---

## 8. Decisiones pendientes para Fase 5

1. **Transport del event bus:** Upstash Redis Streams vs RabbitMQ managed vs Postgres `pg_notify` puro.
2. **Política de retención:** 30d default. ¿Algunos eventos requieren más? (ai.* = 90d para billing, ya decidido).
3. **Dead letter queue:** ¿qué hacemos con eventos que fallan después de N reintentos? Probablemente tabla `events_dlq` + alerta manual.
4. **Reprocesamiento histórico:** ¿necesitamos poder "replay" eventos desde X fecha para rebuild de proyecciones?
5. **Schema registry:** los schemas viven en este README hoy. ¿Vale la pena formalizar en Confluent Schema Registry o similar cuando crezca?

---

## Referencias cruzadas

- [`../../03-diseno-arquitectura.md`](../../03-diseno-arquitectura.md) — diseño general
- [`../auth-service/openapi.yaml`](../auth-service/openapi.yaml) — productor de `user.*`
- [`../ai-gateway/openapi.yaml`](../ai-gateway/openapi.yaml) — productor de `ai.*`
- [`../core-service/openapi.yaml`](../core-service/openapi.yaml) — productor de `ticket.*`, `sprint.*`, `client.*`, `time_entry.*`
- [CloudEvents v1.0 spec](https://github.com/cloudevents/spec)
