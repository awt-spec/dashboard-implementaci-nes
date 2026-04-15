-- Add client_type to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'implementacion';

-- Update existing clients to implementacion
UPDATE public.clients SET client_type = 'implementacion' WHERE client_type = 'implementacion';

-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ticket_id text NOT NULL,
  producto text NOT NULL DEFAULT '',
  asunto text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'Requerimiento',
  prioridad text NOT NULL DEFAULT 'Media',
  estado text NOT NULL DEFAULT 'EN ATENCIÓN',
  fecha_registro timestamp with time zone,
  fecha_entrega timestamp with time zone,
  dias_antiguedad integer NOT NULL DEFAULT 0,
  ai_classification text,
  ai_risk_level text,
  ai_summary text,
  responsable text,
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_tickets
CREATE POLICY "Allow all select on support_tickets" ON public.support_tickets FOR SELECT USING (true);
CREATE POLICY "Allow all insert on support_tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on support_tickets" ON public.support_tickets FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on support_tickets" ON public.support_tickets FOR DELETE USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create index for faster queries
CREATE INDEX idx_support_tickets_client_id ON public.support_tickets(client_id);
CREATE INDEX idx_support_tickets_estado ON public.support_tickets(estado);
CREATE INDEX idx_support_tickets_prioridad ON public.support_tickets(prioridad);

-- Create support_data table for storing last data update info per client
CREATE TABLE public.support_data_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'manual',
  source_name text,
  records_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_data_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on support_data_updates" ON public.support_data_updates FOR SELECT USING (true);
CREATE POLICY "Allow all insert on support_data_updates" ON public.support_data_updates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on support_data_updates" ON public.support_data_updates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on support_data_updates" ON public.support_data_updates FOR DELETE USING (true);