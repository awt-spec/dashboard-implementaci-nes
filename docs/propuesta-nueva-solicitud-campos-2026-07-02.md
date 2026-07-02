# Nueva Solicitud (formulario del cliente) — campos actuales y propuesta

**Estado:** POR DEFINIR (el equipo decide qué campos se usan "en la cancha")
**Fecha:** 2026-07-02 · **Componente:** `src/components/support/NewTicketForm.tsx`

## Campos actuales (modo base)

El formulario tiene dos modos: `cliente` (portal externo) y `admin` (interno).

### Sección A — Datos de la solicitud (obligatoria)
| Campo | Requerido | Notas |
|---|---|---|
| Cliente | Sí | En modo cliente se fija automáticamente a su empresa. |
| Producto | No | Texto libre (ej. Gurunet, SAF+, FileMaster). |
| Asunto | **Sí** | Título corto. |
| Descripción | **Sí** | Mín. 10 caracteres. |
| Tipo | **Sí** | Requerimiento · Corrección · Consulta · Incidente · Pregunta · Problema · Crítica, Impacto Negocio. |
| Prioridad cliente | **Sí** | Crítica (impacto de negocio) · Alta · Media · Baja. |

### Sección B — Contexto técnico (opcional, colapsada)
| Campo | Requerido | Notas |
|---|---|---|
| Ubicación del error | No | Módulo / pantalla / proceso. |
| Unidad de fabricación | No | Texto libre ("- No asignada -"). |

### Sección C — Solo modo admin (interno)
Prioridad interna · Orden de atención · Fecha estimada de entrega · Fecha estimada de cierre · Responsable.

## Observaciones para la definición

- **"Producto" es texto libre** → conviene volverlo un **selector** con el catálogo real de productos SYSDE (evita typos y permite reporting por producto). Requiere una lista de productos.
- **"Tipo" mezcla niveles**: incluye "Crítica, Impacto Negocio" que en realidad es una **prioridad**, no un tipo. Conviene sacarlo de Tipo (ya está en Prioridad).
- **"Unidad de fabricación"** parece heredado de otro dominio (manufactura). Validar si aplica a SYSDE o se elimina/renombra.
- **"Ubicación del error"** es útil para incidentes/correcciones, pero irrelevante para consultas/preguntas → se podría **mostrar condicionalmente** según el Tipo.
- La **prioridad la fija el cliente**; el SLA se calcula sobre ella. Si se quiere que el cliente no sobre-priorice, se puede dejar la prioridad como "sugerida" y que soporte confirme la prioridad interna (ya existe el campo).

## Propuesta de set "en la cancha" (para validar)

**Mínimo imprescindible (cliente):**
1. Producto *(selector del catálogo)* — **obligatorio**
2. Asunto — obligatorio
3. Descripción — obligatorio
4. Tipo *(sin la opción de prioridad)* — obligatorio
5. Prioridad — obligatorio

**Condicional (según Tipo = Incidente/Corrección/Problema):**
6. Ubicación del error (módulo/pantalla)
7. Adjunto (captura/log) — *hoy no existe; se puede agregar*

**Quitar / revisar:** "Unidad de fabricación" (validar si aplica).

## Preguntas abiertas para el equipo

1. ¿"Producto" pasa a **selector** con catálogo? ¿De dónde sale la lista (tabla de productos por cliente)?
2. ¿Se queda "Unidad de fabricación"? Si sí, ¿con qué valores?
3. ¿"Ubicación del error" siempre visible o solo para incidentes/correcciones?
4. ¿Se agrega **adjunto** (captura de pantalla / log) al formulario del cliente?
5. ¿La prioridad del cliente es vinculante para el SLA, o soporte re-clasifica (prioridad interna) antes de que "cuente" el SLA?
6. ¿Algún campo nuevo requerido en la cancha que hoy no exista (ej. ambiente prod/test, versión, urgencia con fecha tope)?

> Cuando el equipo defina el set, la implementación es directa: ajustar `NewTicketForm.tsx` (campos + validación) y, si se agregan campos nuevos, una migración para las columnas en `support_tickets` (varias ya existen: `ubicacion_error`, `unidad_fabricacion`, `descripcion`, etc.).
