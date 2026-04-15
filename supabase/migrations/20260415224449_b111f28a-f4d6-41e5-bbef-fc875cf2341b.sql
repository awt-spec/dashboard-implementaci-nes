
-- Helper function for conversion
CREATE OR REPLACE FUNCTION pg_temp.text_arr_to_jsonb(arr text[]) RETURNS jsonb AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('text', elem, 'responsible', '', 'date', '', 'priority', 'Media')),
    '[]'::jsonb
  )
  FROM unnest(arr) AS elem;
$$ LANGUAGE sql;

-- Convert case_agreements
ALTER TABLE public.support_tickets
  ALTER COLUMN case_agreements DROP DEFAULT;
ALTER TABLE public.support_tickets
  ALTER COLUMN case_agreements TYPE jsonb USING pg_temp.text_arr_to_jsonb(case_agreements);
ALTER TABLE public.support_tickets
  ALTER COLUMN case_agreements SET DEFAULT '[]'::jsonb;

-- Convert case_actions
ALTER TABLE public.support_tickets
  ALTER COLUMN case_actions DROP DEFAULT;
ALTER TABLE public.support_tickets
  ALTER COLUMN case_actions TYPE jsonb USING pg_temp.text_arr_to_jsonb(case_actions);
ALTER TABLE public.support_tickets
  ALTER COLUMN case_actions SET DEFAULT '[]'::jsonb;
