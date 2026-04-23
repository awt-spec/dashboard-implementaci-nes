-- ============================================================================
-- Sistema de notificaciones por usuario.
--
-- Tabla user_notifications: una fila por evento destinado a un usuario.
--   - Vista in-app (campana con badge)
--   - Fuente también para el disparo de email (vía edge function send-notification-email)
--
-- Trigger: al cambiar `assigned_user_id` de un support_ticket, se crea una
-- notificación para el nuevo responsable.
--
-- Email: edge function `send-notification-email` lee rows con
-- `email_queued=true` y las manda vía Resend. La función marca
-- `email_sent_at` al terminar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN (
    'ticket_assigned', 'ticket_status_changed', 'note_added', 'subtask_assigned',
    'minute_shared', 'mention', 'system'
  )),
  title          TEXT NOT NULL,
  body           TEXT,
  link           TEXT,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  email_queued   BOOLEAN NOT NULL DEFAULT false,
  email_sent_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON public.user_notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_email_queued
  ON public.user_notifications (email_queued, email_sent_at)
  WHERE email_queued = true AND email_sent_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Cada user ve / marca como leídas SOLO sus notificaciones.
DROP POLICY IF EXISTS "user_notifications_owner_select" ON public.user_notifications;
CREATE POLICY "user_notifications_owner_select"
  ON public.user_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_notifications_owner_update" ON public.user_notifications;
CREATE POLICY "user_notifications_owner_update"
  ON public.user_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Solo admin/pm/gerente + service_role pueden crear notificaciones para otros.
-- (En la práctica los triggers corren como SECURITY DEFINER y bypass RLS.)
DROP POLICY IF EXISTS "user_notifications_admin_insert" ON public.user_notifications;
CREATE POLICY "user_notifications_admin_insert"
  ON public.user_notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'pm'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  );

-- ─── Helper: obtener email de un user_id ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT email FROM auth.users WHERE id = _user_id LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_user_email(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated;

-- ─── Trigger: ticket asignado → notificación + email queued ─────────────
CREATE OR REPLACE FUNCTION public.on_ticket_assigned_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
  v_old_assignee UUID;
  v_new_assignee UUID;
BEGIN
  v_new_assignee := NEW.assigned_user_id;
  IF TG_OP = 'UPDATE' THEN
    v_old_assignee := OLD.assigned_user_id;
    IF v_new_assignee IS NULL OR v_new_assignee = v_old_assignee THEN
      RETURN NEW;
    END IF;
  ELSIF v_new_assignee IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nombre del cliente para contexto
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id LIMIT 1;

  INSERT INTO public.user_notifications (
    user_id, kind, title, body, link, payload, email_queued
  ) VALUES (
    v_new_assignee,
    'ticket_assigned',
    format('Te asignaron el caso %s', COALESCE(NEW.ticket_id, NEW.id::text)),
    format('%s · %s · Prioridad %s', COALESCE(v_client_name, '—'), COALESCE(NEW.asunto, 'Sin asunto'), COALESCE(NEW.prioridad, 'Media')),
    format('/?ticket=%s', NEW.id),
    jsonb_build_object(
      'ticket_id', NEW.ticket_id,
      'ticket_uuid', NEW.id,
      'client_id', NEW.client_id,
      'client_name', v_client_name,
      'prioridad', NEW.prioridad,
      'estado', NEW.estado
    ),
    true  -- disparar email
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_assigned_notify ON public.support_tickets;
CREATE TRIGGER trg_ticket_assigned_notify
  AFTER INSERT OR UPDATE OF assigned_user_id ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.on_ticket_assigned_notify();

COMMENT ON TABLE public.user_notifications IS
  'Notificaciones por usuario. Alimentadas por triggers (asignación, status changes) y por llamadas directas desde el frontend/edge functions.';
COMMENT ON COLUMN public.user_notifications.email_queued IS
  'Si true, la edge function send-notification-email procesará y mandará el correo, seteando email_sent_at al terminar.';
