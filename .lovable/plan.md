
Objetivo: eliminar la pantalla en blanco y dejar estable el dashboard nuevo de colaborador sin romper admin/scrum.

1. Corregir la causa principal del crash
- Ajustar `src/components/colaborador/MondayGridDashboard.tsx` para usar `react-grid-layout` con imports correctos:
  - `import { Responsive, WidthProvider } from "react-grid-layout"`
  - crear `const ResponsiveGridLayout = WidthProvider(Responsive)`
- Quitar la inicialización riesgosa actual (`RGL.Responsive` / `RGL.WidthProvider`) porque puede dejar `undefined` y romper toda la pantalla al cargar el módulo.

2. Blindar el dashboard de colaborador
- Agregar saneo del layout guardado en `src/hooks/useColaboradorLayout.ts`:
  - filtrar widgets cuyo `type` ya no exista
  - filtrar layouts sin widget asociado
  - si el payload persistido está vacío, corrupto o incompleto, volver automáticamente a `DEFAULTS`
- En `MondayGridDashboard.tsx`, agregar fallback visual:
  - si no hay widgets válidos, mostrar dashboard por defecto en vez de render vacío
  - mostrar estado de carga visible, no `return null`

3. Evitar que un widget roto tumbe toda la vista
- En `src/pages/ColaboradorDashboard.tsx`, construir el registro de widgets solo con componentes válidos.
- Si algún widget no puede renderizarse, omitirlo del grid y mantener el resto del dashboard operativo.
- Mantener fuera “Mi actividad” como ya pidió el usuario.

4. Revisar regresión en vistas Ford
- Verificar integración de `src/components/scrum/FordLineView.tsx` en:
  - `src/pages/ColaboradorDashboard.tsx`
  - `src/pages/TeamScrumDashboard.tsx`
  - `src/components/scrum/SprintManager.tsx`
- Asegurar que la vista Ford no se renderice de forma que afecte la carga inicial del dashboard.

5. Validar navegación base
- Confirmar que `src/pages/Index.tsx` siga cargando correctamente por rol:
  - colaborador → `ColaboradorDashboard`
  - admin/pm → layout con sidebar
  - gerente → vista restringida
- Confirmar que `src/App.tsx` y el flujo de auth no estén quedando en un estado sin render.

6. Resultado esperado
- El preview deja de verse en blanco.
- El colaborador vuelve a ver su dashboard Monday editable.
- Admin y Scrum siguen mostrando la vista Ford sin romper la app.
- Si el layout guardado en BD está dañado por intentos anteriores, el sistema se recupera solo usando el layout por defecto.

Archivos a tocar
- `src/components/colaborador/MondayGridDashboard.tsx`
- `src/hooks/useColaboradorLayout.ts`
- `src/pages/ColaboradorDashboard.tsx`
- `src/pages/TeamScrumDashboard.tsx`
- `src/components/scrum/SprintManager.tsx` (solo si hace falta ajustar render seguro)
