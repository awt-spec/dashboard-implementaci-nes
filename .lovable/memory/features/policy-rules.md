---
name: Política Cierre v4.5 + Reglas de Negocio
description: Motor de reglas vivo basado en la Política de Gestión y Cierre de Casos v4.5; configuración global/cliente/caso con asistente IA y sync con sprints
type: feature
---
**Tablas**: `business_rules` (sla, checklist, signature, metric, weekly), `client_rule_overrides`, `case_compliance` (semáforo+checklist 5pts+IA), `policy_ai_settings`. Seed automático v4.5.

**UI**: 
- Sidebar admin/PM → ítem "Configuración" (icono ⚙️) → `ConfigurationHub` con 4 tabs: Política activa / Reglas / Por cliente / IA & Estrategia.
- `SupportCaseDetailPanel` → tab "Política" con `CaseCompliancePanel` (semáforo, checklist, avisos, botones IA, escalar a sprint).

**IA**: edge function `policy-ai-assistant` con 3 modos:
- `recommend_action` → próxima acción
- `generate_notice` → aviso con firma estándar
- `validate_closing` → valida los 4 elementos del diagnóstico
Modelo por defecto: `google/gemini-3-flash-preview`.

**Evaluación**: edge function `evaluate-case-compliance` calcula plazo+semáforo+riesgo combinando regla SLA global + override del cliente + datos del ticket. Se autoejecuta al abrir el panel del caso.

**Cierre**: bloqueado hasta tener checklist 5/5. Casos `high`/`critical` muestran "Escalar a sprint".
