# Propuesta — Reenfoque del módulo de Entregables

**Estado:** para revisión (próxima sesión) · **Origen:** feedback de Mafe
**Fecha:** 2026-07-01

## Problema

Con el nuevo modelo operativo, **SYSDE hace todo el despliegue**. Los "paquetes de
entregables" que el cliente recibía y aprobaba casi desaparecen. El módulo actual está
redactado como "se entrega un paquete → el cliente lo revisa → lo aprueba", lo cual ya
no refleja la realidad ni es lo más comunicable para el cliente.

## Modelo actual (a reemplazar)

`Deliverable` (`src/data/projectData.ts`):
- `type`: documento | modulo | configuracion | capacitacion | reporte
- `status`: **pendiente | en-revision | entregado | aprobado**

Se muestra al cliente en: pestaña "Entregas" (`GerenteMobileDashboard`),
`ClientDashboard`, `UpcomingDeliverables`. Internamente: `DeliverablesTab`.

## Propuesta

Reenfocar el módulo de "paquetes de entregables" hacia **estados de avance de software
comunicables al cliente**, asociados a un **future/HU**, más los **manuales de nuevas
funcionalidades**.

### 1. Dos tipos de entregable (`deliverable_kind`)

- **`funcionalidad`** — una entrega de software ligada a un future/HU. Es lo que ahora
  lleva el flujo de estados comunicables.
- **`manual`** — manual / nota de versión de una nueva funcionalidad (documento que
  acompaña a la liberación). Reemplaza el sentido de "documento/reporte".

### 2. Nuevos estados comunicables (para `funcionalidad`)

Redacción **externa** (lo que ve el cliente) → clave interna:

| Estado externo (cliente)              | clave                     |
|---------------------------------------|---------------------------|
| En desarrollo                         | `en_desarrollo`           |
| En pruebas del cliente (QA)           | `en_qa_cliente`           |
| En espera de ventana de mantenimiento | `esperando_ventana`       |
| En certificación                      | `en_certificacion`        |
| Liberado a producción                 | `liberado` (terminal)     |

> Reemplazan a pendiente / en-revisión / entregado / aprobado. El estado ya no habla de
> "entregar un paquete" sino del punto del ciclo de vida en que está la funcionalidad.

### 3. Asociación a future/HU

Reutilizar el campo existente `linkedTaskId` (Deliverable → tasks). Así la entrega de
software se conecta con el backlog de HU y con las **épicas** ya implementadas
(`useEpics`), cerrando el hilo "HU → épica → entrega → facturación".

### 4. Manuales de nuevas funcionalidades

Los `kind = manual` son adjuntos/enlaces (release notes, manual de usuario) que se
listan junto a la funcionalidad liberada, para que el cliente los consulte.

## Impacto técnico (estimado)

- **DB:** migración aditiva sobre `deliverables` — agregar `deliverable_kind` y ampliar el
  set de `status` (o nueva columna `lifecycle_status`) con los 5 estados nuevos; mapear los
  actuales (pendiente→en_desarrollo, en-revision→en_qa_cliente, entregado→esperando_ventana
  o en_certificacion, aprobado→liberado). El mapeo es aproximado; conviene revisarlo caso a
  caso o dejar que el equipo lo reasigne.
- **Tipos/labels:** `Deliverable` en `projectData.ts` + un catálogo de labels externos.
- **Redacción externa:** actualizar copy en los sitios cliente
  (`GerenteMobileDashboard` "Entregas", `ClientDashboard`, `UpcomingDeliverables`) — evitar
  "aprobar/entregar paquete"; usar los estados de ciclo de vida.
- **Interno:** `DeliverablesTab` con edición de estado + kind + link a HU.
- Es un cambio transversal (~12 sitios que consumen `deliverables`) + migración + copy
  externo. Sizable, conviene hacerlo en una tanda dedicada tras validar los estados.

## Preguntas abiertas para validar en sesión

1. ¿"Liberado a producción" es el estado terminal, o hay un paso de "aceptación del
   cliente" posterior que quieran conservar?
2. ¿Los manuales son un tipo de entregable o una sub-sección aparte por funcionalidad?
3. ¿El cliente debe poder accionar algo (ej. agendar la ventana de mantenimiento, aprobar
   la certificación) o es solo informativo?
4. ¿Se mantiene "capacitación" como entregable o pasa a otro módulo?
