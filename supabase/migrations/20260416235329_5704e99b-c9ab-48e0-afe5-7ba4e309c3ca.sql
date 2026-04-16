ALTER TABLE public.support_minutes ADD COLUMN IF NOT EXISTS referenced_clients text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_support_minutes_referenced_clients ON public.support_minutes USING GIN(referenced_clients);