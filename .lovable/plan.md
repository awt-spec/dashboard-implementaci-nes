

## Política de Cierre v4.5 + Reglas de Negocio + Configuración con IA

Voy a integrar la **Política de Gestión y Cierre de Casos v4.5** como motor de reglas vivo dentro de la plataforma, con tres capas: **(1) Configuración global / por cliente / por caso**, **(2) Motor de evaluación automática** que vigila cada ticket contra los SLAs, y **(3) Asistente IA** que recomienda acciones, redacta avisos con la firma estándar, valida el checklist de cierre y sincroniza con sprints.

### Lo que se va a construir

**1. Modelo de datos (3 tablas nuevas)**
- `business_rules` — biblioteca de reglas (plazo, avisos, checklist, firma). Scope: `global` | `client` | `case_type`. Versionada (v4.5).
- `client_rule_overrides` — sobrescritura por cliente (ej. cliente VIP usa 2 días en vez de 3).
- `case_compliance` — evaluación calculada por ticket: días restantes, avisos enviados, checklist completo (5 puntos), riesgo de incumplimiento, recomendación IA.

Seed automático con la política v4.5: plazos por tipo+prioridad, los 5 elementos del checklist, la firma estándar, las reglas de cierre semanal y las 4 métricas activas (backlog, reapertura, checklist, CSAT).

**2. Sidebar — nuevo item "Configuración" (icono ⚙️ rueda)**
Sección visible para `admin`/`pm` al final del menú principal, con 4 pestañas:
- **Política activa** — visualiza la política v4.5 cargada (tablas de plazos, checklist, firma, reglas semanales) en formato editable.
- **Reglas de negocio** — CRUD de reglas, activar/desactivar, versionar, duplicar.
- **Por cliente** — overrides por cliente (plazos custom, firma personalizada, equipo asignado).
- **IA & Estrategia** — toggles del motor (auto-aviso, auto-checklist, sugerencias IA, sync con sprint), modelo IA por defecto, frecuencia de evaluación.

**3. Motor de evaluación (Edge Function `evaluate-case-compliance`)**
Para cada ticket evalúa: tipo+prioridad → plazo aplicable → días restantes → estado de avisos → checklist (5 puntos) → riesgo (verde/amarillo/rojo) → recomendación IA contextual. Se ejecuta on-demand y al abrir el detalle del ticket. Resultado se guarda en `case_compliance` y dispara badges visuales.

**4. Panel "Cumplimiento de Política" en el detalle del caso (`SupportCaseDetailPanel`)**
Nueva sección con:
- Semáforo de SLA (días restantes vs plazo de la política).
- Checklist de 5 puntos interactivo (los del documento: solución documentada, notificación, ticket referenciado, tipo de cierre, guía de validación). El cierre se bloquea si falta alguno.
- Contador de avisos enviados (3/3 para corrección alta y requerimientos).
- Botón **"Generar aviso con IA"** → produce el texto con la firma estándar y el placeholder `[X días]` ya resuelto según prioridad.
- Botón **"Recomendación IA"** → analiza el caso + historial + reglas activas y devuelve la próxima acción recomendada (enviar aviso, escalar, cerrar, vincular a sprint).

**5. Estrategia por nivel (global / cliente / caso)**
- **Global**: KPIs agregados de las 4 métricas activas (backlog <5d, reapertura <10%, checklist 100%, CSAT ≥4) en el dashboard ejecutivo.
- **Cliente**: tarjeta "Salud de cumplimiento" en el detalle del cliente de soporte con su tendencia.
- **Caso**: panel de cumplimiento en el ticket (descrito en punto 4).

**6. Integración con Sprint / Equipo Scrum**
- Cuando un caso entra en riesgo crítico (vence en <24h, supera plazo, o tiene 3 avisos sin respuesta), aparece un botón **"Escalar a sprint"** que lo agrega al sprint activo del consultor responsable con `business_value` y `effort` precargados según prioridad.
- En `TeamScrumDashboard` y en la línea Ford aparece un badge de "Política" sobre items que vienen de tickets en riesgo, con tooltip explicando la regla violada.
- El **agente IA del colaborador** ya existente recibe contexto extra: "Tienes 2 casos en riesgo de SLA según política v4.5", con acción de un click para revisarlos.

**7. IA conectada en todas las capas**
Edge function `policy-ai-assistant` con 3 modos:
- `recommend_action(case)` → próxima acción según política + contexto.
- `generate_notice(case, type)` → texto del aviso con firma estándar, plazo correcto y referencia al ticket.
- `validate_closing(case)` → revisa el diagnóstico documentado contra los 4 elementos obligatorios (qué pasó, qué se hizo, estado final, definitiva/temporal) y devuelve OK o qué falta.

Modelo: `google/gemini-3-flash-preview` (rápido, barato, suficiente para reglas estructuradas).

### Estructura técnica

```text
supabase/
  migrations/  → business_rules, client_rule_overrides, case_compliance + seed v4.5
  functions/
    evaluate-case-compliance/   → calcula semáforo + checklist
    policy-ai-assistant/        → 3 modos IA (recommend/generate/validate)

src/
  components/
    settings/
      ConfigurationHub.tsx          → contenedor con 4 pestañas (icono ⚙️)
      ActivePolicyPanel.tsx         → tablas de la política v4.5 editables
      BusinessRulesPanel.tsx        → CRUD de reglas
      ClientOverridesPanel.tsx      → overrides por cliente
      AIStrategyPanel.tsx           → toggles IA + sync sprint
    support/
      CaseCompliancePanel.tsx       → semáforo + checklist 5 puntos + avisos + IA
  hooks/
    useBusinessRules.ts
    useCaseCompliance.ts
    usePolicyAI.ts
  pages/
    Index.tsx                       → ruta "config" + icono ⚙️ en sidebar
  components/dashboard/AppSidebar.tsx → nuevo item "Configuración"
```

### Flujo end-to-end
1. Admin abre ⚙️ → la política v4.5 ya está cargada → ajusta override para cliente VIP.
2. Llega ticket → motor evalúa → muestra "Vence en 2d, 0/3 avisos, checklist 1/5".
3. Consultor pulsa "Generar aviso IA" → texto listo con firma → envía.
4. Día 3, sin respuesta → IA recomienda "Cerrar con diagnóstico documentado".
5. Consultor llena checklist → IA valida los 4 elementos → permite cerrar.
6. Caso crítico no atendido → botón "Escalar a sprint" lo lleva al sprint activo del responsable.
7. Métricas globales actualizadas en tiempo real en el dashboard ejecutivo.

### Lo que no cambia
- Tablas existentes de `support_tickets`, `clients`, `tasks`, `support_sprints` se mantienen — solo se enlazan vía `case_compliance.ticket_id`.
- Sin tocar la auth, RLS sigue el patrón `has_role()` actual.
- El tablero de colaborador y la línea Ford ya construidos se respetan; solo reciben badges nuevos.

