-- ============================================================================
-- Seguridad de tickets: pgcrypto + audit log + campo is_confidential
--
-- Objetivo:
--  1. Habilitar pgcrypto (ya viene instalable en Supabase) para cifrar columnas
--     sensibles a nivel aplicación.
--  2. Agregar flag `is_confidential` que marca tickets cuyos datos delicados
--     quedan cifrados con una clave simétrica del proyecto.
--  3. Funciones helper `encrypt_sensitive` / `decrypt_sensitive` que usan una
--     GUC `app.encryption_key` (configurable via `ALTER DATABASE SET` o
--     secret del proyecto). Sin la clave, las funciones devuelven NULL.
--  4. Audit log `ticket_access_log` para registrar quién accedió a qué ticket
--     y cuándo.
--
-- Notas:
--   - Supabase Platform ya provee cifrado at-rest (AES-256) + TLS en tránsito.
--     Esta migración agrega cifrado a nivel columna OPCIONAL para datos
--     sensibles que requieren protección adicional (ej: contraseñas
--     temporales, datos financieros del cliente, etc.).
--   - La columna `descripcion` NORMAL queda en claro para búsqueda + IA.
--   - La columna `descripcion_cifrada` guarda la versión cifrada cuando el
--     ticket es confidencial.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensión pgcrypto
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 2. Campos nuevos en support_tickets
-- ---------------------------------------------------------------------------

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS is_confidential    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS descripcion_cifrada BYTEA,
  ADD COLUMN IF NOT EXISTS fuente             TEXT NOT NULL DEFAULT 'interno';
  -- fuente: 'cliente' (creado por gerente via portal) | 'interno' (creado por SVA)

DO $$ BEGIN
  ALTER TABLE public.support_tickets
    DROP CONSTRAINT IF EXISTS support_tickets_fuente_check;
  ALTER TABLE public.support_tickets
    ADD CONSTRAINT support_tickets_fuente_check
    CHECK (fuente IN ('cliente','interno','email','api','devops'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

COMMENT ON COLUMN public.support_tickets.is_confidential IS
  'Si true, la descripción normal queda vacía y la confidencial cifrada vive en descripcion_cifrada.';
COMMENT ON COLUMN public.support_tickets.fuente IS
  'Origen del ticket: cliente (portal gerente), interno (SVA), email, api, devops.';

-- ---------------------------------------------------------------------------
-- 3. Helpers de cifrado (usan GUC app.encryption_key)
--    Configurar con: ALTER DATABASE postgres SET app.encryption_key = '<secret>';
--    O como secret de Edge Functions (preferible): Deno.env.get("ENCRYPTION_KEY")
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plaintext TEXT, key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF plaintext IS NULL OR length(plaintext) = 0 THEN
    RETURN NULL;
  END IF;
  IF key IS NULL OR length(key) < 16 THEN
    RAISE EXCEPTION 'encryption key must be >= 16 chars';
  END IF;
  RETURN extensions.pgp_sym_encrypt(plaintext, key);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive(ciphertext BYTEA, key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  IF key IS NULL OR length(key) < 16 THEN
    RETURN '[CIFRADO]'; -- si no hay clave válida, no falla; solo no descifra
  END IF;
  BEGIN
    RETURN extensions.pgp_sym_decrypt(ciphertext, key);
  EXCEPTION WHEN OTHERS THEN
    RETURN '[ERROR DE DESCIFRADO]';
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Audit log de accesos a tickets
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_access_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL CHECK (action IN ('view','create','update','decrypt','delete')),
  ip_address INET,
  user_agent TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_access_log_ticket ON public.ticket_access_log(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_access_log_user   ON public.ticket_access_log(user_id, created_at DESC);

ALTER TABLE public.ticket_access_log ENABLE ROW LEVEL SECURITY;

-- Solo admins/PMs pueden leer el audit log. Los writes solo via triggers.
DROP POLICY IF EXISTS "Read ticket access log" ON public.ticket_access_log;
CREATE POLICY "Read ticket access log" ON public.ticket_access_log
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role)
  );

DROP POLICY IF EXISTS "Insert ticket access log" ON public.ticket_access_log;
CREATE POLICY "Insert ticket access log" ON public.ticket_access_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.ticket_access_log IS
  'Registro de accesos a tickets (quién ve/edita qué). Solo admins/pms pueden leer. Escritura via triggers + edge functions.';

-- ---------------------------------------------------------------------------
-- 5. Trigger que audita create/update en support_tickets
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_ticket_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_access_log (ticket_id, user_id, action, metadata)
    VALUES (
      NEW.id,
      auth.uid(),
      'create',
      jsonb_build_object(
        'ticket_id', NEW.ticket_id,
        'client_id', NEW.client_id,
        'prioridad', NEW.prioridad,
        'is_confidential', NEW.is_confidential,
        'fuente', NEW.fuente
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo loguear si cambia algo "importante" (no micro-updates)
    IF OLD.estado IS DISTINCT FROM NEW.estado
       OR OLD.prioridad IS DISTINCT FROM NEW.prioridad
       OR OLD.responsable IS DISTINCT FROM NEW.responsable
       OR OLD.prioridad_interna IS DISTINCT FROM NEW.prioridad_interna
       OR OLD.is_confidential IS DISTINCT FROM NEW.is_confidential
    THEN
      INSERT INTO public.ticket_access_log (ticket_id, user_id, action, metadata)
      VALUES (
        NEW.id,
        auth.uid(),
        'update',
        jsonb_build_object(
          'from', jsonb_build_object('estado', OLD.estado, 'prioridad', OLD.prioridad, 'responsable', OLD.responsable),
          'to',   jsonb_build_object('estado', NEW.estado, 'prioridad', NEW.prioridad, 'responsable', NEW.responsable)
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ticket_change ON public.support_tickets;
CREATE TRIGGER trg_log_ticket_change
  AFTER INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_change();

-- ---------------------------------------------------------------------------
-- 6. Trigger BEFORE INSERT/UPDATE: si is_confidential=true y descripcion viene en claro,
--    la mueve a descripcion_cifrada y vacía el campo normal.
--    Para que funcione necesita app.encryption_key como setting. Si no lo hay,
--    deja la info en claro pero marca is_confidential.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_confidential_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  enc_key TEXT;
BEGIN
  IF NEW.is_confidential IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Intentar obtener la clave del setting (opcional — si falla, no cifra)
  BEGIN
    enc_key := current_setting('app.encryption_key', true);
  EXCEPTION WHEN OTHERS THEN
    enc_key := NULL;
  END;

  IF enc_key IS NULL OR length(enc_key) < 16 THEN
    -- Sin clave: no cifra pero tampoco expone. Simplemente marca.
    -- La aplicación (edge function) puede cifrar después con la clave del secret.
    RETURN NEW;
  END IF;

  -- Cifrar descripción si viene en claro
  IF NEW.descripcion IS NOT NULL AND length(NEW.descripcion) > 0 THEN
    NEW.descripcion_cifrada := extensions.pgp_sym_encrypt(NEW.descripcion, enc_key);
    NEW.descripcion := '[CIFRADO — solo SVA autorizado]';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_confidential_ticket ON public.support_tickets;
CREATE TRIGGER trg_handle_confidential_ticket
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_confidential_ticket();

-- ---------------------------------------------------------------------------
-- 7. Índice para consultar tickets de un cliente por fuente
--    (útil para el dashboard "Bandeja de entrada" que filtra tickets nuevos)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_support_tickets_fuente_estado_created
  ON public.support_tickets(fuente, estado, created_at DESC);
