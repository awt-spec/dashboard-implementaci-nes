

## Plan: Presentación Global, Minutas con Branding, Navegación y Edición de Casos

### Problemas y Requerimientos

1. **Presentación general interna**: Crear una presentación resumen que combine implementación + soporte con slides de KPIs, progreso por cliente, estado de tickets, etc.
2. **Minutas con branding Sysde**: La presentación de minutas de soporte usa azul (#2980b9) en vez del rojo Sysde (#c0392b). Los datos aparecen casi en blanco porque `cases_referenced` almacena ticket_ids pero el filtro no encuentra los tickets correctamente.
3. **Selección de casos más intuitiva**: El formulario actual muestra checkboxes planos. Mejorar con búsqueda, selección rápida por prioridad/estado, y preselección de casos activos.
4. **Navegación sidebar**: La sección "Implementación" sigue mostrando clientes incorrectos. El filtro `client_type === "implementacion"` existe pero `useClients()` retorna un campo `client_type` que puede no estar mapeado correctamente en el tipo `Client`.
5. **Edición de casos desde detalle**: Agregar edición inline de estado, prioridad, notas y resumen IA en el panel expandido de `SupportCaseTable`.

---

### Cambios Técnicos

**1. Presentación Global (Implementación + Soporte)**
- Archivo: `src/components/dashboard/ExecutivePresentation.tsx`
- Agregar props para recibir tickets de soporte y clientes de soporte
- Agregar 2 slides nuevos: "Resumen Soporte" (KPIs: activos, críticos, >365d, clasificados IA) y "Tickets por Cliente" (tabla con distribución)
- Actualizar `src/components/dashboard/ExecutiveOverview.tsx` para pasar datos de soporte al abrir la presentación

**2. Corregir Branding Minutas Soporte**
- Archivo: `src/components/support/SupportMinutaPresentation.tsx`
- Cambiar color principal de `#2980b9` a `#c0392b` (rojo Sysde) en todos los slides
- Corregir el filtro de casos: `refCases` filtra por `ticket_id` pero `cases_referenced` puede contener IDs de uuid. Verificar y unificar el matching para usar ambos campos
- Agregar logo Sysde en slide de portada y cierre

**3. Selección de Casos más Intuitiva**
- Archivo: `src/components/support/SupportMinutas.tsx`
- Reemplazar lista de checkboxes con: búsqueda por texto, botones rápidos "Todos activos", "Solo críticos", "Solo abiertos"
- Mostrar conteo visual de seleccionados vs total
- Preseleccionar automáticamente los casos activos al abrir el formulario

**4. Corregir Filtro de Navegación Sidebar**
- Archivo: `src/hooks/useClients.ts` — El campo `client_type` se mapea al objeto `Client` pero el tipo `Client` en `projectData.ts` puede no incluirlo. Verificar que `client_type` se pasa correctamente
- Archivo: `src/components/dashboard/AppSidebar.tsx` — Agregar log defensivo: si `client_type` es undefined, excluir del listado de implementación
- Reforzar: `implClients = allClients.filter(c => c.client_type === "implementacion")` debe ser estricto (no incluir undefined)

**5. Edición de Casos desde Detalle**
- Archivo: `src/components/support/SupportCaseTable.tsx`
- En el panel expandido, agregar `Select` para cambiar estado (EN ATENCIÓN, ENTREGADA, PENDIENTE, etc.)
- Agregar `Select` para cambiar prioridad
- Agregar `Textarea` editable para notas con botón guardar
- Agregar `Textarea` editable para resumen IA con botón guardar
- Usar `useUpdateSupportTicket` que ya existe para persistir cambios

### Archivos a Modificar
1. `src/components/dashboard/ExecutivePresentation.tsx` — Agregar slides de soporte
2. `src/components/dashboard/ExecutiveOverview.tsx` — Pasar datos soporte
3. `src/components/support/SupportMinutaPresentation.tsx` — Branding rojo + fix datos
4. `src/components/support/SupportMinutas.tsx` — UX selección casos
5. `src/components/dashboard/AppSidebar.tsx` — Fix filtro navegación
6. `src/components/support/SupportCaseTable.tsx` — Edición inline de campos
7. `src/data/projectData.ts` — Verificar tipo Client incluye client_type

