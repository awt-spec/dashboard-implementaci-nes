CREATE TABLE IF NOT EXISTS public.colaborador_dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.colaborador_dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own layout select" ON public.colaborador_dashboard_layouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own layout insert" ON public.colaborador_dashboard_layouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own layout update" ON public.colaborador_dashboard_layouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own layout delete" ON public.colaborador_dashboard_layouts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_colab_layout_updated BEFORE UPDATE ON public.colaborador_dashboard_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();