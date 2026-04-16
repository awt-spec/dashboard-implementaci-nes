ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS core_version text DEFAULT '',
ADD COLUMN IF NOT EXISTS modules jsonb NOT NULL DEFAULT '[]'::jsonb;