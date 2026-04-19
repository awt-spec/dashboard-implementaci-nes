
The user wants to add to the existing collaborator profile improvement plan an AI empowerment layer where each collaborator gets a role-based AI agent. Let me design this addition coherently with what's already planned.

Key idea: each collaborator has a personal AI agent specialized by their role (Developer, QA, PM, Consultant SAP/IFS, Support, Designer, etc.) with context about their skills, current tasks, sprint, hours, and goals. The agent helps them daily.

Capabilities per role:
- Developer: code reviews, debugging help, architecture suggestions, generate unit tests
- QA: test plans, regression scenarios, bug triage
- PM/Gerente: status summaries, risk detection, meeting minutes, stakeholder updates
- Consultant SAP/IFS: configuration advice, troubleshooting, doc lookup
- Support: ticket diagnosis, KB suggestions, response drafting
- Designer: UX feedback, copy review

Need: agent profiles table, conversation persistence, edge function with role-based system prompts, UI panel in MemberProfile, plus shortcuts ("Ayúdame con esta tarea", "Resume mi semana", "Prepara mi 1:1").

Add proactive features: weekly digest, suggestions based on tasks, skill development nudges.

Keep concise — this is an addition to existing plan.

## Adición al plan: Empoderamiento con IA por rol

### Eje 6 — Agentes IA personales por rol

Cada colaborador tendrá un **agente IA personal** especializado en su rol, con contexto completo de su perfil, sprint actual, tareas, horas y skills. Disponible como tab "Mi Agente IA" en el perfil y como botón flotante en el `ColaboradorDashboard`.

**Roles soportados** (detección automática desde `sysde_team_members.role`):
- **Developer / Tech Lead** — code review, debugging, generación de tests, sugerencias de arquitectura
- **QA / Tester** — planes de prueba, casos regresión, bug triage
- **PM / Gerente** — resúmenes de estado, detección de riesgos, drafting de minutas y updates a stakeholders
- **Consultor SAP / IFS** — guía de configuración, troubleshooting funcional, búsqueda en documentación
- **Soporte** — diagnóstico de tickets, sugerencias de KB, drafts de respuesta al cliente
- **Diseñador / UX** — feedback UX, revisión de copy
- **Default (otros)** — asistente generalista de productividad

**Capacidades comunes a todos los agentes:**
- "Resume mi semana" (lo que hice + lo que viene + bloqueos)
- "Prepara mi 1:1 con mi líder" (logros, dudas, ayuda que necesito)
- "Ayúdame con esta tarea" (recibe `task_id` o `ticket_id` por contexto)
- "¿Qué debería aprender esta semana?" (basado en skill gaps + cursos del Learning Hub)
- "Registra mis horas de hoy" (parsea texto natural → entradas en `work_time_entries`)

**Modo proactivo (digest semanal):**
- Cron Sunday 18:00 → genera digest por miembro: % de meta cumplida, top tarea pendiente, sugerencia de curso, kudo recomendado a dar.
- Notificación in-app con el resumen.

### Detalles técnicos

**DB (migración nueva):**
- `member_ai_agents`: id, member_id (UNIQUE), role_template (text), custom_instructions (text), tone (text default 'friendly'), enabled (bool), created_at, updated_at. RLS: dueño + admin/pm.
- `member_ai_conversations`: id, member_id, title, messages (jsonb), context_snapshot (jsonb), created_at, updated_at. RLS: dueño + admin/pm.
- `member_ai_digests`: id, member_id, week_start (date), summary (text), suggestions (jsonb), created_at. UNIQUE(member_id, week_start).

**Edge functions nuevas:**
- `member-agent-chat` — recibe `member_id` + mensaje + opcional `task_id/ticket_id`. Carga contexto (perfil, skills, sprint actual, tasks abiertas, horas semana, goals, kudos recibidos). Usa **Lovable AI Gateway** con `google/gemini-2.5-flash` (default) o `google/gemini-2.5-pro` para tareas complejas. Streaming SSE. System prompt construido dinámicamente desde `role_template`. Persiste en `member_ai_conversations`. Maneja 429/402 con toasts.
- `member-agent-weekly-digest` — invocable por cron o manualmente. Genera digest por miembro y lo guarda en `member_ai_digests`.
- `member-agent-log-hours` — tool calling: parsea lenguaje natural ("trabajé 2h en el ticket de Aurum esta mañana") y crea entrada en `work_time_entries`.

**Componentes UI nuevos:**
- `MemberAIAgentPanel.tsx` — chat con streaming, sugerencias rápidas según rol, historial de conversaciones, botón "Configurar agente".
- `AgentConfigDialog.tsx` — el dueño elige tono, instrucciones custom, activa/desactiva.
- `WeeklyDigestCard.tsx` — muestra el último digest en `MyProductivityDashboard`.
- `FloatingAgentButton.tsx` — FAB en `ColaboradorDashboard` que abre el panel.

**Edición:**
- `MemberProfile.tsx` — nuevo tab "Mi Agente IA" (visible solo dueño + admin para inspección).
- `ColaboradorDashboard.tsx` — FAB del agente.
- `MyProductivityDashboard.tsx` — card del digest semanal.

**Seguridad:** las conversaciones son privadas del miembro; solo `admin` puede inspeccionarlas (auditoría). Nunca se envía info de otros colaboradores en el contexto sin consentimiento.

**Sin claves nuevas** — usa `LOVABLE_API_KEY` existente.
