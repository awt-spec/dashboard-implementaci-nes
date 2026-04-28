-- ════════════════════════════════════════════════════════════════════════════
-- Subtareas de tickets ahora tienen CATEGORÍA para distinguir naturaleza
-- del trabajo:
--   • estrategia → planificación, decisiones, próximos pasos
--   • revision   → QA, code review, validación
--   • comercial  → upsell, escalamiento, contacto comercial
--   • backlog    → ítem del backlog del equipo (scrum)
--   • general    → genérica (default)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.support_ticket_subtasks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('estrategia','revision','comercial','backlog','general'));

CREATE INDEX IF NOT EXISTS idx_support_ticket_subtasks_category
  ON public.support_ticket_subtasks(ticket_id, category);

-- Opcional: vincular una subtarea a un ítem de backlog del equipo
-- (work_items existen en el sistema de scrum). Si la subtarea es 'backlog'
-- esto permite navegar al sprint board.
ALTER TABLE public.support_ticket_subtasks
  ADD COLUMN IF NOT EXISTS linked_work_item_id UUID;

COMMENT ON COLUMN public.support_ticket_subtasks.category IS
  'Naturaleza del trabajo: estrategia, revision, comercial, backlog, general';
COMMENT ON COLUMN public.support_ticket_subtasks.linked_work_item_id IS
  'Si category=backlog: UUID del work_item vinculado (sin FK porque la tabla puede no existir en todos los envs)';
