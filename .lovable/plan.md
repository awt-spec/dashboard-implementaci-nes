

## Plan: Acuerdos/Acciones Manuales en Minutas + Tabs de Acuerdos/Acciones por Cliente + Acuerdos en Detalle de Caso

### Resumen

Tres cambios principales:
1. Agregar campos manuales de acuerdos y acciones al formulario de creación de minuta (antes de generar con IA), que se combinan con los generados por la IA.
2. Crear un nuevo tab "Acuerdos y Acciones" en el dashboard de soporte por cliente, que consolide todos los acuerdos y acciones de todas las minutas del cliente.
3. En el detalle expandido de cada caso (SupportCaseTable), agregar sección para registrar acuerdos y acciones específicos del caso, vinculados a minutas.

---

### Cambios Técnicos

**1. Formulario de creación de minuta — acuerdos/acciones manuales**
- Archivo: `src/components/support/SupportMinutas.tsx`
- Agregar dos listas editables en el formulario de creación (antes del botón "Generar con IA"):
  - "Acuerdos previos" — input + botón agregar, lista con chips removibles
  - "Acciones previas" — mismo patrón
- Estado: `manualAgreements: string[]`, `manualActions: string[]`
- En `handleGenerateMinuta`: combinar los manuales con los que devuelve la IA:
  ```typescript
  agreements: [...manualAgreements, ...(parsed.agreements || [])],
  action_items: [...manualActions, ...(parsed.action_items || [])],
  ```

**2. Nuevo tab "Acuerdos y Acciones" en SupportDashboard**
- Archivo: `src/components/support/SupportDashboard.tsx`
- Agregar tab "Acuerdos" que solo aparece en vista de cliente
- Crear componente `src/components/support/SupportAgreementsTab.tsx`:
  - Consulta `support_minutes` del cliente
  - Muestra tabla consolidada con columnas: Fecha minuta, Acuerdo/Acción, Tipo (acuerdo vs acción), Estado (nuevo campo manual que se puede togglear completado/pendiente)
  - Permite filtrar por tipo y por minuta de origen

**3. Acuerdos y acciones en detalle de caso**
- Archivo: `src/components/support/SupportCaseTable.tsx`
- En el panel expandido, agregar nueva sección "Acuerdos del Caso"
- Buscar en `support_minutes` donde `cases_referenced` incluya el `ticket_id` del caso
- Mostrar los acuerdos y acciones de esas minutas relacionadas, con badge indicando la minuta de origen
- No requiere nueva tabla — usa la relación existente via `cases_referenced`

### Archivos a Modificar/Crear
1. `src/components/support/SupportMinutas.tsx` — Formulario con acuerdos/acciones manuales
2. `src/components/support/SupportAgreementsTab.tsx` — Nuevo componente tab consolidado
3. `src/components/support/SupportDashboard.tsx` — Agregar tab "Acuerdos"
4. `src/components/support/SupportCaseTable.tsx` — Mostrar acuerdos relacionados en detalle de caso

