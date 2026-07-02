# CTO Review — Línea de gaps: Facturación, Contrato-KB, Estado de cuenta y Aprobación

**Fecha:** 2026-07-02 · **Lente:** arquitectura + secuencia + MVP vs futuro
**Alcance:** S2-01…S2-12 (facturación, KB del contrato, estado de cuenta, aprobación, normalización, soporte, fases, cadencia).

---

## 1. La tesis central (una sola idea)

Toda la línea cuelga de **un solo cerebro: el Knowledge Base del contrato + un agente IA que lo interpreta** (S2-02). De ahí se derivan **hitos de facturación** (S2-01), **SLA**, **paquetes/horas contratadas** y el **control de horas en tiempo real**. Hoy nada de eso nace del contrato: los disparadores los pone Beto **a mano** y salen del ERP.

> Regla de diseño: **el contrato es la fuente de verdad**. El ERP no *define* los hitos/SLA/paquetes; los **ejecuta y reconcilia** contra lo que el KB extrajo. Si construimos facturación/segregación antes que el cerebro, construimos complejidad sobre arena.

**Secuencia obligada:** primero el cerebro (o al menos su contrato→entidades), luego lo que cuelga.

---

## 2. Mapa de dependencias

```
                 ┌──────────────────────────────┐
                 │  S2-02  Contrato = KB + Agente │  ← el cerebro
                 │  (extrae hitos, SLA, paquetes) │
                 └───────────────┬───────────────┘
        ┌────────────────┬───────┴────────┬─────────────────┐
        ▼                ▼                ▼                 ▼
 S2-01 Disparadores  SLA (juega en   Control de horas   Paquetes/horas
 de facturación      la cancha)       en tiempo real     prepagadas (S2-08)
 (hitos→confirmar)   incumplimientos  (contratadas vs
        │                             consumidas, alerta
        │                             fuera-de-contrato)
        ▼
 S2-03 Segregación por contrato (semáforos, %, popurrí)
        │
        ▼
 S2-05 Estado de cuenta = OUTPUT puro (vivo, sin aprobación)
        │  ⟹ obliga a
        ▼
 S2-06 Aprobación AGUAS ARRIBA (a nivel requerimiento/cotización)

 S2-07 Estrategia/normalizar  →  GOBIERNA el alcance de TODO (no es dev)
```

Dos cadenas causales fuertes:
- **S2-02 → S2-01 → S2-03** (el contrato deriva hitos, y los hitos alimentan la segregación).
- **S2-05 → S2-06** (si el estado de cuenta es solo salida, la aprobación *tiene* que ocurrir antes).

---

## 3. Qué YA está construido (esta plataforma) vs qué falta

| Gap | Hoy en la app | Qué falta para la visión |
|---|---|---|
| **S2-01 Disparadores** | Existen en Fases; estado de facturación por HU (en asignación→lista para facturar→facturada). **Manual, desde ERP.** | Que **nazcan del contrato** (IA extrae hitos 1,2,3) y que una persona solo **confirme** el cumplimiento. |
| **S2-02 Contrato KB+IA** | Se puede **subir el contrato (PDF) y analizarlo con IA** (extrae cláusulas/riesgos/obligaciones). | Que la extracción produzca **entidades estructuradas** (hitos, SLA, paquetes) persistidas, no solo texto de análisis. Vigilar horas en vivo. |
| **S2-03 Segregación** | Cotizaciones, paquetes facturados, pólizas. | Sección de **segregación con semáforos** y % (70/30, 60/40, 60/20/20), alimentada por el KB; alerta si un requerimiento en riesgo afecta la factura. |
| **S2-04/05 Estado de cuenta** | Formato SYSDE (documento) + estructura por horas; ya **no** resta pagos acumulados. | Volverlo **output puro en vivo**; **quitar la aprobación del cliente**; agregar **vista rápida de bolsa de horas** (te quedan 5,4,3). |
| **S2-06 Aprobación** | Cotizaciones con estados; aprobación de cotización existe. | **Aprobación parcial por fase** a nivel requerimiento (10h aprobadas ≠ estimación total), con opción de **saltar** o registrar "aprobado por correo/Teams". |
| **SLA** | **Alerta activa de incumplimiento** (resolución) ya funciona. | Que los tiempos **deriven del contrato** (KB), no de seed manual. |
| **S2-08 Prepagadas** | `service_packages` (pólizas) con CRUD; account statement por horas. | Reconstruir el flujo **Lite** limpio (cotización→aprobación parcial→consumo→saldo). |
| **Fases detalle** | Fases funcionales, actualizan estado, histórico. | **Pulido de UI** del detalle (ej. capacitaciones: el render no es el esperado). Residual, no arquitectura. |

**Conclusión:** el 60–70% de la *plomería* existe (contratos, pólizas, cotizaciones, consumo de horas, análisis IA del contrato, alertas SLA). Lo que falta es **el hilo conductor contrato→entidades** y **mover la aprobación aguas arriba**.

---

## 4. MVP "vainilla" vs futuro "ideal" (directiva Eduardo: keep it simple)

**Meta de negocio:** ×5 la base de clientes. No se puede operar el "popurrí" ×5 → **normalizar** y no construir la variabilidad antes de tiempo.

### MVP (vainilla, sin toppings) — construir ahora
1. **Estado de cuenta = output en vivo** (S2-05): horas en línea, disponible a cualquier hora, sin sumas/Excel. **Quitar** la aprobación del cliente sobre el estado de cuenta.
2. **Vista rápida "bolsa de horas"** (S2-04): saldo disponible destacado (5,4,3 h) + el detalle chico para quien audita hora por hora. *(Quick win — ya tenemos saldo de horas por póliza.)*
3. **Aprobación aguas arriba Lite** (S2-06): a nivel requerimiento/cotización, con **aprobación parcial por fase** y opción de saltar/registrar "aprobado por correo". Estándar único, mínima variación.
4. **Paquetes de horas prepagadas** (S2-08): flujo limpio cotización→aprobación→consumo→saldo.
5. **Disparadores semi-derivados** (S2-01): IA extrae hitos del contrato → quedan disponibles → persona confirma "cumplido". *(No 100% automático aún, pero ya no "del aire".)*
6. **Clientes nuevos solo en el modelo nuevo**; legacy se acomodan en renovación.

### Futuro / ideal — NO construir todavía
- Segregación completa del "popurrí" con todos los semáforos y % arbitrarios (S2-03 full).
- Agente IA que **vigila la cancha en tiempo real** y dispara alertas de sobreconsumo / fuera-de-contrato de forma autónoma.
- Reconciliación automática requerimiento-en-riesgo → factura.
- Segregación multi-póliza estricta (caso John: horas que no cruzan entre pólizas) — modelar en MVP como *atributo*, endurecer después.

> **Marca en el mapa:** separar explícito MVP/vainilla ↔ futuro/ideal. Si algo complica la arquitectura, los Luis levantan la mano (S2-07).

---

## 5. Decisiones de arquitectura a poner sobre la mesa (Castillo / Luis)

1. **KB del contrato:** ¿dónde vive? Propuesta: almacenamiento del documento + extracción por agente → **tabla de entidades derivadas** (`contract_milestones`, y reutilizar `client_slas`, `service_packages`). El análisis IA actual devuelve texto; hay que hacerlo devolver **entidades estructuradas** persistidas y editables (IA propone, humano confirma).
2. **Fuente de verdad y reconciliación:** las horas contratadas, SLA y paquetes se **derivan del contrato**; el ERP registra consumo y **reconcilia**. Definir qué gana en conflicto (contrato) y cómo se marcan discrepancias.
3. **Horas en tiempo real:** ya existe el cálculo (RPC de estado de cuenta + `service_packages` + `work_time_entries`). Falta: **agregado en vivo por póliza** y **umbral de alerta** (sobreconsumo / solicitud fuera de contrato). Es incremental, no reescritura.
4. **Segregación multi-póliza (caso John):** las horas **no pueden cruzar** de una póliza a otra. Requiere que cada consumo (solicitud/ticket) se **atribuya a una póliza** explícita (hoy la atribución es heurística por fecha). Endurecer: FK solicitud→póliza.
5. **Aprobación upstream:** modelar la **aprobación parcial por fase** como entidad (monto/horas aprobadas por tramo), con estados y evidencia ("aprobado por correo"). El estado de cuenta solo **refleja lo autorizado**.

---

## 6. Secuencia recomendada (build order)

- **Sprint Lite (primer corte 17-jul):**
  - Estado de cuenta como output + vista bolsa de horas (S2-04/05). *(bajo riesgo, alto valor, base ya existe)*
  - Quitar aprobación del cliente sobre el estado de cuenta.
  - Aprobación parcial por fase a nivel cotización/requerimiento (S2-06 Lite).
- **Sprint siguiente:**
  - KB del contrato → extracción de **entidades** (hitos/SLA/paquetes) IA-propone/humano-confirma (S2-02).
  - Disparadores de facturación **derivados** de esos hitos (S2-01).
- **Después (ideal):**
  - Segregación con semáforos y % (S2-03); control de horas en vivo con alertas autónomas; reconciliación riesgo→factura.

---

## 7. Riesgos / anti-patrones a evitar

- **Construir la segregación del "popurrí" antes que el KB** → complejidad sin cerebro. No.
- **Sobre-modelar variantes** (mil escenarios de la intranet que nunca llegaron a prod). Vainilla primero.
- **Dejar el estado de cuenta como algo que se "publica" manualmente** → vuelve la auditoría manual del cliente. Debe ser vivo por construcción.
- **IA que "adivina" hitos sin confirmación humana** → siempre IA-propone / humano-confirma para lo facturable.

---

## 8. No-dev (gobernanza) — solo registrar

- **S2-07 Estrategia/normalizar:** decisión de negocio; gobierna alcance. Eliminar garantía ilimitada; legacy normaliza o sale.
- **Cadencia:** sesiones de prototipo (Mafe/Beto) separadas de los jueves (avance de Vega + corte de sprint). "Mini doble clic" por milestone. Ritmo, no producto.
- **Soporte (vista):** ya bastante armada; pendientes = revisión a fondo, **migrar el agente IA de Claude barato a Sonnet 5** cuando se entrene, y reconciliar registro de horas de Soporte.

---

### Quick wins que podemos entregar ya (base existente)
1. **Vista bolsa de horas disponible** por póliza (5,4,3) — tenemos saldo por `service_packages`.
2. **Marcar el estado de cuenta como "output"** (quitar cualquier paso de aprobación del cliente) — ya es casi eso.
3. **Enlazar cada disparador de hito a la cláusula** que lo origina, usando el análisis IA del contrato que ya corre.
