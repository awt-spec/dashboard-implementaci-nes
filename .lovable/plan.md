
## Plan: rediseñar "Sprint Activo" con un hub dedicado

Hoy el sprint activo está fragmentado: una barra de capacidad en `SprintManager`, un Kanban básico en otra pestaña, y el burndown enterrado en "Reportes". Voy a unificar todo en un nuevo panel inmersivo.

### Cambios

**1. Nueva pestaña destacada "🔥 Sprint Activo"** (primera pestaña, default) en `TeamScrumDashboard.tsx`. Si no hay sprint activo, muestra un CTA grande "Iniciar un sprint" que lleva a la pestaña Sprints.

**2. Nuevo componente `src/components/scrum/ActiveSprintHub.tsx`** con secciones:

- **Header inmersivo** con gradiente Sysde:
  - Nombre + meta del sprint, cliente
  - Días restantes / total (badge prominente con color: verde >50%, ámbar 20-50%, rojo <20% o vencido)
  - Botones rápidos: Daily, Retro, Cerrar Sprint

- **Strip de KPIs (4 cards)**: SP completados/planeados, % avance, items en progreso, items bloqueados/sin owner

- **Capacidad + Burndown lado a lado**:
  - Barra de capacidad con marcador de "ideal a hoy" vs "real"
  - Gráfico burndown en grande con anotación "vas X SP arriba/abajo del ideal"

- **Mini Kanban embebido** (5 columnas compactas) con drag & drop entre estados, sin tener que ir a otra pestaña

- **Carga del equipo en el sprint** (chips por persona con SP asignados/completados, semáforo visual)

- **Items en riesgo** (panel lateral): sin owner, sin estimación, en progreso >3 días, vencidos

**3. Selector si hay múltiples sprints activos**: tabs internos por sprint.

**4. Polish**: animaciones framer-motion al cambiar estado, contador de días vivo (actualiza al cargar), confetti sutil cuando 100% completado.

### Archivos
- **Nuevo**: `src/components/scrum/ActiveSprintHub.tsx`
- **Modificado**: `src/pages/TeamScrumDashboard.tsx` (agrega tab "active" como default, importa ActiveSprintHub)

### Notas técnicas
- Reutiliza `useAllScrumWorkItems`, `useAllSprints`, `useUpdateWorkItemScrum` ya existentes
- Cálculo de burndown e ideal-vs-real se mueve dentro del nuevo componente (hoy está en TeamScrumDashboard)
- DnD usa el mismo patrón nativo HTML5 que SprintManager
- Sin migración DB ni nuevos endpoints
