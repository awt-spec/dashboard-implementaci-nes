-- ============================================================================
-- Extiende public.support_ticket_subtasks para convertir las subtareas en
-- unidades de trabajo con más contexto: descripción larga, responsable,
-- fecha límite y prioridad independiente del ticket padre.
--
-- Idempotente: usa ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.support_ticket_subtasks
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS assignee    TEXT,
  ADD COLUMN IF NOT EXISTS due_date    DATE,
  ADD COLUMN IF NOT EXISTS priority    TEXT NOT NULL DEFAULT 'media';

-- Constraint laxo: prioridad siempre en lowercase y dentro del set conocido.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_ticket_subtasks_priority_chk'
  ) THEN
    ALTER TABLE public.support_ticket_subtasks
      ADD CONSTRAINT support_ticket_subtasks_priority_chk
      CHECK (priority IN ('baja','media','alta','critica'));
  END IF;
END $$;

-- Índice para búsquedas/ordenamiento por fecha límite (filtros "próximas a vencer").
CREATE INDEX IF NOT EXISTS idx_support_ticket_subtasks_due_date
  ON public.support_ticket_subtasks (due_date)
  WHERE due_date IS NOT NULL;

-- Índice para reordenamiento rápido dentro de un ticket.
CREATE INDEX IF NOT EXISTS idx_support_ticket_subtasks_ticket_sort
  ON public.support_ticket_subtasks (ticket_id, sort_order);

COMMENT ON COLUMN public.support_ticket_subtasks.description IS
  'Descripción expandida de la subtarea (opcional). UI la muestra en expand/collapse.';
COMMENT ON COLUMN public.support_ticket_subtasks.assignee IS
  'Responsable de la subtarea. Texto libre para poder asignar a externos; TicketDetailSheet sugiere miembros SYSDE.';
COMMENT ON COLUMN public.support_ticket_subtasks.due_date IS
  'Fecha límite sugerida para esta subtarea (independiente del SLA del ticket).';
COMMENT ON COLUMN public.support_ticket_subtasks.priority IS
  'Prioridad de la subtarea: baja | media | alta | critica. Default media.';
