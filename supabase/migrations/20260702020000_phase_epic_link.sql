-- Vincula (opcionalmente) cada fase del proyecto a una épica, para que su % de
-- avance se calcule del backlog en vez de moverse a mano. Las fases que no
-- calzan con ninguna épica quedan sin vincular (epic NULL) = siguen manuales.

ALTER TABLE public.phases
  ADD COLUMN IF NOT EXISTS epic text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'phases_epic_chk') THEN
    ALTER TABLE public.phases ADD CONSTRAINT phases_epic_chk
      CHECK (epic IS NULL OR epic IN ('administracion','infraestructura','parametrizacion','capacitaciones','desarrollos'));
  END IF;
END $$;

-- Vinculación heurística por nombre de fase (solo las que calzan claramente).
UPDATE public.phases SET epic = 'infraestructura'
WHERE epic IS NULL AND (name ILIKE '%infraestructura%' OR name ILIKE '%despliegue%' OR name ILIKE '%servidor%' OR name ILIKE '%cloud%');

UPDATE public.phases SET epic = 'capacitaciones'
WHERE epic IS NULL AND (name ILIKE '%capacita%' OR name ILIKE '%taller%' OR name ILIKE '%certificaci%' OR name ILIKE '%entrenamiento%');

UPDATE public.phases SET epic = 'desarrollos'
WHERE epic IS NULL AND (name ILIKE '%desarrollo%' OR name ILIKE '%custom%' OR name ILIKE '%integraci%');

UPDATE public.phases SET epic = 'administracion'
WHERE epic IS NULL AND (name ILIKE '%planifica%' OR name ILIKE '%kickoff%' OR name ILIKE '%entendimiento%' OR name ILIKE '%discovery%');

UPDATE public.phases SET epic = 'parametrizacion'
WHERE epic IS NULL AND (name ILIKE '%parametr%' OR name ILIKE '%configuraci%' OR name ILIKE '%regla%' OR name ILIKE '%carga de datos%');
-- El resto (pruebas integrales, go-live, etc.) queda NULL = manual.
