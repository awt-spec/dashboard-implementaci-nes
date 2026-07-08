-- ════════════════════════════════════════════════════════════════════════
-- Rol CSR — Customer Service Representative (Agente de Atención al Cliente)
--
-- Agente de soporte de PRIMERA LÍNEA: atiende y responde tickets de cara al
-- cliente, se autoasigna casos, captura feedback (CSAT) y puede escalar al
-- gerente de soporte. NO gestiona la operación: sin borrado, sin configuración
-- de SLA/reglas/pólizas, sin transferencias de cliente, sin finanzas, sin
-- administración de usuarios.
--
-- Aislamiento: a diferencia de gerente_soporte, el CSR NO se incluye en
-- is_staff_user() ni en user_can_see_client(), así que NO hereda las lecturas
-- amplias de datos de proyecto. Su acceso se define con políticas dedicadas
-- (is_csr_user()) acotadas al dominio de soporte.
--
-- Nota: el valor de enum 'csr' se agrega en una migración/paso previo aparte
-- (ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción).
-- ════════════════════════════════════════════════════════════════════════

-- ── Helper de rol ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_csr_user(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'csr'::public.app_role
  );
$$;

-- ── Catálogo de roles ────────────────────────────────────────────────────
INSERT INTO public.roles (key, label, description, scope, is_system, is_active)
VALUES (
  'csr',
  'Agente de Soporte (CSR)',
  'Atención al cliente de primera línea: atiende y responde tickets, se autoasigna casos y captura feedback. Sin gestión de SLA, borrado ni finanzas.',
  'interno', true, true
) ON CONFLICT (key) DO NOTHING;

-- ── Permisos RBAC (para gates de UI que usan useHasPermission) ────────────
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'csr', k FROM (VALUES ('soporte.ver_dashboard'), ('soporte.gestionar_tickets')) v(k)
ON CONFLICT DO NOTHING;

-- ── Feedback / CSAT por ticket (nuevo) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_ticket_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  client_id   text,
  rating      int CHECK (rating BETWEEN 1 AND 5),
  sentiment   text CHECK (sentiment IN ('positivo','neutral','negativo')),
  comment     text,
  captured_by uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_feedback_ticket ON public.support_ticket_feedback(ticket_id);
ALTER TABLE public.support_ticket_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Support read ticket feedback" ON public.support_ticket_feedback;
CREATE POLICY "Support read ticket feedback" ON public.support_ticket_feedback FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)
      OR has_role(auth.uid(),'gerente_soporte'::app_role) OR public.is_csr_user());

DROP POLICY IF EXISTS "Support write ticket feedback" ON public.support_ticket_feedback;
CREATE POLICY "Support write ticket feedback" ON public.support_ticket_feedback FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)
      OR has_role(auth.uid(),'gerente_soporte'::app_role) OR public.is_csr_user());

-- ── RLS del CSR: dominio de soporte, sin borrado ni gestión ──────────────
-- Clientes de soporte (solo lectura).
DROP POLICY IF EXISTS "csr read support clients" ON public.clients;
CREATE POLICY "csr read support clients" ON public.clients FOR SELECT
  USING (public.is_csr_user() AND client_type = 'soporte');

-- Tickets: leer / crear / actualizar. SIN política de DELETE.
DROP POLICY IF EXISTS "csr read support tickets" ON public.support_tickets;
CREATE POLICY "csr read support tickets" ON public.support_tickets FOR SELECT USING (public.is_csr_user());
DROP POLICY IF EXISTS "csr insert support tickets" ON public.support_tickets;
CREATE POLICY "csr insert support tickets" ON public.support_tickets FOR INSERT WITH CHECK (public.is_csr_user());
DROP POLICY IF EXISTS "csr update support tickets" ON public.support_tickets;
CREATE POLICY "csr update support tickets" ON public.support_tickets FOR UPDATE
  USING (public.is_csr_user()) WITH CHECK (public.is_csr_user());

-- Notas de ticket (respuestas al cliente / internas): leer / crear / actualizar.
DROP POLICY IF EXISTS "csr read support notes" ON public.support_ticket_notes;
CREATE POLICY "csr read support notes" ON public.support_ticket_notes FOR SELECT USING (public.is_csr_user());
DROP POLICY IF EXISTS "csr insert support notes" ON public.support_ticket_notes;
CREATE POLICY "csr insert support notes" ON public.support_ticket_notes FOR INSERT WITH CHECK (public.is_csr_user());
DROP POLICY IF EXISTS "csr update support notes" ON public.support_ticket_notes;
CREATE POLICY "csr update support notes" ON public.support_ticket_notes FOR UPDATE
  USING (public.is_csr_user()) WITH CHECK (public.is_csr_user());

-- Lecturas de apoyo para operar la bandeja.
DROP POLICY IF EXISTS "csr read team members" ON public.sysde_team_members;
CREATE POLICY "csr read team members" ON public.sysde_team_members FOR SELECT USING (public.is_csr_user());
DROP POLICY IF EXISTS "csr read profiles" ON public.profiles;
CREATE POLICY "csr read profiles" ON public.profiles FOR SELECT USING (public.is_csr_user());
DROP POLICY IF EXISTS "csr read slas" ON public.client_slas;
CREATE POLICY "csr read slas" ON public.client_slas FOR SELECT USING (public.is_csr_user());
DROP POLICY IF EXISTS "csr read ticket reopens" ON public.support_ticket_reopens;
CREATE POLICY "csr read ticket reopens" ON public.support_ticket_reopens FOR SELECT USING (public.is_csr_user());
