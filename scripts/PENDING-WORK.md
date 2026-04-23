# Trabajo pendiente — sesión ticket UX (2026-04-22)

## Lo que ya está terminado (commitable)

✅ Bug "Atender no pasa nada" arreglado:
- `useUpdateSupportTicket` invalida `["support-inbox"]` y `["ticket-history"]`
- Realtime del `SupportInbox` escucha `INSERT + UPDATE` (antes solo INSERT)

✅ `TicketDetailSheet` — sheet completo con 4 tabs (Detalle / Historial / Notas / Subtareas) + acciones rápidas (estado, prioridad, responsable, atender, cerrar, reabrir, eliminar)

✅ `useTicketHistory` — hook que combina `ticket_access_log` + `support_ticket_notes`

✅ `TicketHistoryTimeline` — visual rail con icons por tipo de evento, tiempo relativo + tooltip absoluto

✅ Botón "Ver" del Inbox ahora abre el sheet

## Pendiente (próxima sesión — orden sugerido)

### 1. Subtareas extensas ✅ (hecho 2026-04-22)
Hecho en esta sesión:
- ✅ Migración `20260422180000_extend_subtasks.sql` — agrega `description`, `assignee`, `due_date`, `priority` + constraint + índices
- ✅ Hook `useSupportTicketDetails.ts` ampliado: tipos + `useUpdateTicketSubtask` + `useReorderTicketSubtasks` (optimistic)
- ✅ Componente `src/components/support/SubtaskItem.tsx` — expand/collapse, título/descr editables inline, pickers de prioridad/responsable/fecha, drag handle
- ✅ Componente `src/components/support/SubtaskList.tsx` — barra de progreso, sub-tabs (Todas / Pendientes / Completadas), D&D nativo HTML5 reordenando `sort_order`
- ✅ Integración en `TicketDetailSheet.tsx` — tab "Subtareas" ahora renderiza `<SubtaskList>`
- ✅ Fixeado bug latente: componente usaba `is_done` pero la tabla tiene `completed`

Pendiente de verificar: correr la migración en Supabase y probar el sheet en browser.

### 2. Estados intuitivos ✅ (hecho 2026-04-22)
Hecho en esta sesión:
- ✅ Componente `src/components/support/TicketStateFlow.tsx`:
  - Main flow horizontal clickable: `PENDIENTE → EN ATENCIÓN → POR CERRAR → ENTREGADA → CERRADA`
  - Alternativos en rail inferior: `ON HOLD`, `VALORACIÓN`, `COTIZADA`, `APROBADA`, `ANULADA`
  - Cada nodo con icono distintivo + tooltip con hint semántico
  - Estados `past` marcados con check verde, `current` con ring + animate-spin en "EN ATENCIÓN"
  - Detecta estados legacy no-estándar y los muestra como warning sin romper render
  - Hint automático al cerrar: "Click en cualquier estado activo para reabrir"
- ✅ Reemplazado el `<Select>` de estado en `TicketDetailSheet.tsx` — ahora ocupa fila completa arriba, prioridad/responsable abajo en 2 columnas

### 3. Historial enriquecido + share ✅ (hecho 2026-04-22)
Hecho en esta sesión:
- ✅ `TicketHistoryTimeline` ahora muestra fecha absoluta completa (`22/04/2026 14:35:08`) debajo del tiempo relativo, con `<time>` semántico
- ✅ Verificado: `ticket_access_log` ya tiene `ip_address`/`user_agent` (migración `20260422160000`)
- ✅ Migración `20260422190000_shared_ticket_history.sql` — tabla con token único, snapshot de historial + ticket, flags `include_internal_notes` e `include_system_views`, expiración configurable, `view_count` incrementable vía RPC `bump_shared_ticket_history_view` (SECURITY DEFINER)
- ✅ `ShareTicketHistoryDialog.tsx` — título editable, expiración 7/14/30/90 días, toggles para notas internas y eventos `view`, preview de cuántos eventos verá el cliente
- ✅ Página pública `/historial-caso/:token` — `SharedTicketHistory.tsx`, branded con header SYSDE, card resumen del ticket + timeline
- ✅ `TicketHistoryTimeline` ahora acepta `events` directamente (modo snapshot) o `ticketId` (modo fetch en vivo)
- ✅ Botón "Compartir" en el header del tab Historial del sheet
- ✅ Ruta registrada en `App.tsx` + tipos de Supabase actualizados

### 4. IA Estrategia por caso ✅ (hecho 2026-04-22)
Hecho en esta sesión:
- ✅ Edge function `supabase/functions/case-strategy-ai/index.ts`:
  - Input: `{ ticket_id }`
  - Junta: ticket + cliente + contrato + SLA + financials + historial (audit + notas + subtareas) + hasta 10 casos similares cerrados (mismo cliente o producto/tipo)
  - Calcula `slaState` dinámicamente (ok / en_riesgo / incumplido / sin_sla / cerrado)
  - Gemini 2.5 Pro con tool-calling — schema: `diagnostico`, `accion_recomendada`, `riesgos`, `casos_similares`, `sla_status`, `confianza`
  - Persiste en `pm_ai_analysis` con `analysis_type='case_strategy'`, `scope=<ticket_id>`
  - Loggea uso en `ai_usage_logs` (success/error)
  - Usa helpers compartidos `_shared/cors.ts` + `_shared/auth.ts`, roles permitidos: admin/pm/gerente/colaborador
- ✅ Hook `src/hooks/useCaseStrategy.ts`:
  - `useLatestCaseStrategy(ticketId)` — lee último análisis por scope
  - `useRunCaseStrategy()` — mutación que invoca el edge function
- ✅ Componente `src/components/support/CaseStrategyPanel.tsx`:
  - Empty state con CTA "Generar análisis"
  - Vista rica: diagnóstico, SLA status con icono, acción recomendada con urgencia/esfuerzo, riesgos por severidad con impacto financiero, casos similares con lección aplicable, barra de confianza
  - Botón "Regenerar" + toggle para ver JSON crudo
- ✅ Tab "Estrategia IA" (5to tab) en `TicketDetailSheet.tsx`

### 5. IA Estrategia por cliente ✅ (hecho 2026-04-22)
Hecho en esta sesión:
- ✅ Edge function `supabase/functions/client-strategy-ai/index.ts`:
  - Input: `{ client_id }`
  - Junta: cliente + contrato activo + SLAs + financials + TODOS los tickets (histórico completo) + notas externas recientes + agreements
  - Deriva métricas: open/closed, críticos, edad promedio, viejos >30d, distribución por producto/tipo/ai_classification, tendencia mensual (últimos 6 meses: created/closed)
  - Gemini 2.5 Pro con tool-calling — schema: `salud_relacion {score, tendencia, resumen}`, `top_3_dolores`, `oportunidades_upsell`, `riesgos_churn`, `plan_proximo_mes` (semana-a-semana), `confianza`
  - Persiste en `pm_ai_analysis` con `analysis_type='client_strategy'`, `scope=<client_id>`
  - Roles: admin/pm/gerente (estratégico, no colaborador)
- ✅ Hook `src/hooks/useClientStrategy.ts` con `useLatestClientStrategy` + `useRunClientStrategy`
- ✅ Componente `src/components/support/ClientStrategyPanel.tsx`:
  - Empty state con CTA "Generar estrategia"
  - Hero con score circular animado por salud (SVG), tendencia (trending up/down/estable)
  - Grid 2 columnas: top dolores (con ocurrencias + solución sugerida) + upsell (con probabilidad + estimado USD/mes + momento recomendado)
  - Riesgos de churn con chips de señales observadas + mitigación
  - Plan 30 días como rail vertical semana-a-semana con objetivos + bullets de acciones + responsable sugerido
  - Botón "Regenerar" + toggle JSON debug
- ✅ Integrado en `SupportDashboard.tsx` como sub-tab "Estrategia Cliente" dentro del tab principal "IA & Estrategia". Visible solo cuando hay cliente scoped (isClientView o selectedClient !== "all"). Pasa a ser el default sub-tab en vistas cliente-scoped.

### 6. Minutas con feedback rich ✅ (hecho 2026-04-22)
Hecho en esta sesión:
- ✅ Migración `20260422200000_support_minutes_feedback.sql` — tabla `support_minutes_feedback` (sentimiento triple positivo/neutro/negativo, `text_comment`, `audio_url`/`audio_duration_seconds`/`audio_transcript`, `video_url`/`video_duration_seconds`/`video_transcript`, `author_name`, FKs a `support_minutes` y `shared_support_presentations`) + bucket público `minute-feedback-media`
- ✅ Componente `src/components/support/MinuteFeedbackRecorder.tsx`:
  - Sentimiento triple con iconos y colores
  - Nombre opcional + textarea de comentarios
  - Grabación de audio con MediaRecorder (cap 5min, timer animado con dot pulsante, auto-stop al llegar al cap, reproducción post-grabación, descarte)
  - Grabación de video análoga (cap 2min) con preview live del stream
  - `pickAudioMime`/`pickVideoMime` priorizando mp4 (iOS Safari) → webm
  - Cleanup de tracks + timers en unmount
  - Upload a bucket con `uploadMedia` (path único `crypto.randomUUID()`)
  - Dispara `transcribe-audio` de forma async no bloqueante después del insert
- ✅ `SharedSupportPresentation.tsx` — reemplazado el viejo `SlideFeedback` por `<MinuteFeedbackRecorder sharedPresentationId={...} clientId={...} />`. También agregado `client_id` al select.
- ✅ Edge function `supabase/functions/transcribe-audio/index.ts`:
  - Input: `{ feedback_id, audio_url, kind: "audio" | "video" }`
  - Descarga media, cap 25MB, convierte a base64, llama a Gemini 2.5 Flash vía Lovable AI (input_audio format mp4/webm/mp3/wav)
  - Persiste transcripción en `audio_transcript` o `video_transcript` via REST PATCH (bypass RLS con service role)
  - Loggea uso/errores en `ai_usage_logs`
- ✅ Componente `src/components/support/MinuteFeedbackList.tsx`:
  - Fetch filtrado por `client_id`, ordenado desc por `created_at`
  - Header con badges agregados por sentimiento + contadores de audio/video
  - Por item: autor + fecha relativa/absoluta, texto, audio con `<audio controls>` + transcript inline (o "transcripción pendiente…"), video con `<video controls>` + transcript
  - Empty state cuando no hay feedback
- ✅ Integrado en `SupportMinutas.tsx` arriba del listado de minutas
- ✅ Types de Supabase actualizados

## Orden estimado

```
Sesión 1 (3-4h): Subtareas extensas + Estados intuitivos
Sesión 2 (3-4h): Historial enriquecido + share público
Sesión 3 (4h):   IA estrategia por caso + por cliente
Sesión 4 (5h):   Minutas con audio/video + transcripción
```

## Archivos clave de referencia

- `src/hooks/useSupportTickets.ts` — mutations + cache invalidation
- `src/hooks/useSupportTicketDetails.ts` — subtareas, notas, attachments, dependencias
- `src/hooks/useTicketHistory.ts` — timeline (ya creado)
- `src/components/support/TicketDetailSheet.tsx` — sheet principal
- `src/components/support/TicketHistoryTimeline.tsx` — timeline visual
- `src/components/support/SupportMinutas.tsx` — minutas existentes
- `src/components/support/SupportMinutaPresentation.tsx` — vista compartida
- `src/pages/SharedSupportPresentation.tsx` — página pública con token

## Para retomar

Pegar este texto al inicio de la próxima sesión:
> "Retomá el plan en `scripts/PENDING-WORK.md`, arranquemos por la sección X"
