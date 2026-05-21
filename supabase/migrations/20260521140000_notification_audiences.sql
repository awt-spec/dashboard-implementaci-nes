-- ============================================================================
-- Audiencias de notificación — gap P5 Story Mapping (ERP-010, ERP-011)
-- Grupos arbitrarios de usuarios por cliente para distribución de notificaciones.
-- NO confundir con cliente_company_assignments (membresía formal del cliente)
-- ni con client_team_members (directorio de contacto interno). Las audiencias
-- son subsets configurables del directorio para broadcast selectivo.
-- ============================================================================

CREATE TABLE public.notification_audiences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  -- channel: dónde se envían las notif de esta audiencia
  -- 'email' (default), 'in_app', 'both'
  channel     text NOT NULL DEFAULT 'both' CHECK (channel IN ('email','in_app','both')),
  -- event_filters: jsonb con triggers que activan a esta audiencia
  -- ej: { "ticket_created": true, "ticket_resolved": true, "sla_at_risk": false }
  event_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);

CREATE INDEX idx_audiences_client_active
  ON public.notification_audiences(client_id, is_active);

CREATE TRIGGER set_notification_audiences_updated_at
  BEFORE UPDATE ON public.notification_audiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Miembros (N:M users ↔ audiencia) ────────────────────────────────────────
CREATE TABLE public.notification_audience_members (
  audience_id uuid NOT NULL REFERENCES public.notification_audiences(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  added_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (audience_id, user_id)
);

CREATE INDEX idx_audience_members_user
  ON public.notification_audience_members(user_id);

-- ============================================================================
-- Helper SECURITY DEFINER: lista de user_ids activos para una audiencia
-- Filtra usuarios cuyo profiles.user_id no exista (zombie), etc.
-- Útil para que un edge fn de notificación resuelva destinatarios sin
-- preocuparse por RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_audience_recipients(_audience_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, p.email, p.full_name
  FROM public.notification_audience_members m
  JOIN public.profiles p ON p.user_id = m.user_id
  JOIN public.notification_audiences a ON a.id = m.audience_id
  WHERE m.audience_id = _audience_id
    AND a.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_audience_recipients(uuid) TO authenticated;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.notification_audiences ENABLE ROW LEVEL SECURITY;

-- SELECT: staff sin restricción; cliente solo sus propias audiencias
CREATE POLICY "Staff sees all audiences"
  ON public.notification_audiences FOR SELECT
  USING (public.is_staff_user());

CREATE POLICY "Cliente sees own audiences"
  ON public.notification_audiences FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente'::app_role)
    AND public.user_can_see_client(client_id)
  );

-- INSERT/UPDATE/DELETE: admin global, o admin del cliente (cliente_company_assignments con permission_level='admin')
CREATE POLICY "Admin or client-admin manages audiences"
  ON public.notification_audiences FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.cliente_company_assignments
      WHERE user_id = auth.uid()
        AND client_id = notification_audiences.client_id
        AND permission_level = 'admin'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.cliente_company_assignments
      WHERE user_id = auth.uid()
        AND client_id = notification_audiences.client_id
        AND permission_level = 'admin'
    )
  );

ALTER TABLE public.notification_audience_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff or cliente del audience reads members"
  ON public.notification_audience_members FOR SELECT
  USING (
    public.is_staff_user()
    OR EXISTS (
      SELECT 1 FROM public.notification_audiences a
      WHERE a.id = audience_id
        AND public.user_can_see_client(a.client_id)
    )
  );

CREATE POLICY "Admin or client-admin manages members"
  ON public.notification_audience_members FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.notification_audiences a
      JOIN public.cliente_company_assignments cca
        ON cca.client_id = a.client_id
      WHERE a.id = audience_id
        AND cca.user_id = auth.uid()
        AND cca.permission_level = 'admin'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.notification_audiences a
      JOIN public.cliente_company_assignments cca
        ON cca.client_id = a.client_id
      WHERE a.id = audience_id
        AND cca.user_id = auth.uid()
        AND cca.permission_level = 'admin'
    )
  );

COMMENT ON TABLE public.notification_audiences IS
  'Grupos arbitrarios de destinatarios por cliente para distribución de notificaciones. Gap P5 Story Mapping (ERP-010, ERP-011).';
COMMENT ON COLUMN public.notification_audiences.event_filters IS
  'JSONB de triggers: { "ticket_created": true, "ticket_resolved": true, "sla_at_risk": false }. Vacío = recibe broadcast manual solamente.';
