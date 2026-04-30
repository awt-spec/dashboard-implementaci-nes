-- ════════════════════════════════════════════════════════════════════════════
-- Link task owners (responsables) a partir de las CSVs de backlog
--
-- Las CSVs no tienen columna "Assigned To" pero embeden el responsable al
-- final del título: "... - MAVARGAS", "... - O. Castro", etc.
-- Este migration:
--   1. UPSERT sysde_team_members para los colaboradores nuevos
--   2. UPDATE tasks.owner = nombre_completo basado en (client_id, original_id)
--   3. Si existe auth user con ese email, UPDATE tasks.assigned_user_id
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 0. Asegurar UNIQUE en email para que ON CONFLICT funcione ───────────
-- La tabla original (20260416030945) no tenía UNIQUE. Normalizar emails
-- vacíos → NULL (multiple NULLs son permitidos en UNIQUE), eliminar dups
-- y crear el constraint completo.
UPDATE public.sysde_team_members SET email = NULL WHERE email = '';

DELETE FROM public.sysde_team_members a
 USING public.sysde_team_members b
 WHERE a.email = b.email
   AND a.email IS NOT NULL
   AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sysde_team_members_email
  ON public.sysde_team_members(email);

-- ─── 1. UPSERT colaboradores ─────────────────────────────────────────────
INSERT INTO public.sysde_team_members (name, email, role, department, is_active)
VALUES
  ('Orlando Castro', 'orlando.castro@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Fernando Pinto', 'fpinto-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Walter Gómez', 'wgomez-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Luis Alfaro', 'lalfaro-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Maria Nelly Vargas Salazar', 'mavargas-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Olga Lucia Cuervo', 'olga.lucia@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Carlos Andrés Rico', 'crico@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Andrés Julián Gómez', 'ajgomez-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Fauricio Navarro', 'navarro.fuentes@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Andrés Venegas', 'avenegas-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Marco Pisacreta', 'mpisacreta-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Sandra Guerra', 'sguerra-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Carlos Quesada', 'cquesada-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Luis Mangel', 'lmangel-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Bryan Hernandez', 'bhernandez-contratista@sysde.com', 'colaborador', 'Implementación', TRUE),
  ('Diego García', 'dgarcia-contratista@sysde.com', 'colaborador', 'Implementación', TRUE)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = TRUE,
  updated_at = NOW();

-- ─── 2. UPDATE tasks.owner por (client_id, original_id) ──────────────────
-- Cada update se hace en lote por persona → menos statements.
UPDATE public.tasks SET owner = 'Orlando Castro' WHERE (client_id, original_id) IN (
  ('aurum', 38307),
  ('aurum', 38308),
  ('aurum', 38304),
  ('amc', 37706),
  ('amc', 36813),
  ('amc', 37077),
  ('amc', 37078),
  ('amc', 37200),
  ('amc', 36917),
  ('amc', 36758)
);

UPDATE public.tasks SET owner = 'Fernando Pinto' WHERE (client_id, original_id) IN (
  ('aurum', 38305),
  ('cmi', 37864),
  ('cmi', 37452),
  ('cmi', 37613),
  ('cmi', 37809)
);

UPDATE public.tasks SET owner = 'Walter Gómez' WHERE (client_id, original_id) IN (
  ('aurum', 38710),
  ('dos-pinos', 35933),
  ('dos-pinos', 36165),
  ('dos-pinos', 36203),
  ('dos-pinos', 36355),
  ('dos-pinos', 36558),
  ('dos-pinos', 35641),
  ('dos-pinos', 36040),
  ('dos-pinos', 36071),
  ('dos-pinos', 37449),
  ('dos-pinos', 38156),
  ('amc', 37752),
  ('amc', 36755),
  ('amc', 36878)
);

UPDATE public.tasks SET owner = 'Luis Alfaro' WHERE (client_id, original_id) IN (
  ('dos-pinos', 35427),
  ('dos-pinos', 36062),
  ('dos-pinos', 35540),
  ('dos-pinos', 35576),
  ('dos-pinos', 35884),
  ('dos-pinos', 36144),
  ('dos-pinos', 36206),
  ('dos-pinos', 36331),
  ('dos-pinos', 36440),
  ('dos-pinos', 36576),
  ('dos-pinos', 36626),
  ('dos-pinos', 36784),
  ('dos-pinos', 36860),
  ('dos-pinos', 36960),
  ('dos-pinos', 37137),
  ('dos-pinos', 37263),
  ('dos-pinos', 37420),
  ('dos-pinos', 37661),
  ('dos-pinos', 37838),
  ('dos-pinos', 37990),
  ('dos-pinos', 38107),
  ('dos-pinos', 38344),
  ('dos-pinos', 38536),
  ('dos-pinos', 38605),
  ('dos-pinos', 38702),
  ('dos-pinos', 38871),
  ('dos-pinos', 38994),
  ('dos-pinos', 39337),
  ('dos-pinos', 39438),
  ('dos-pinos', 36357),
  ('dos-pinos', 36441),
  ('dos-pinos', 36577),
  ('dos-pinos', 36627),
  ('dos-pinos', 36709),
  ('dos-pinos', 36785),
  ('dos-pinos', 36861),
  ('dos-pinos', 36961),
  ('dos-pinos', 37264),
  ('dos-pinos', 37421),
  ('dos-pinos', 37662),
  ('dos-pinos', 37839),
  ('dos-pinos', 37991),
  ('dos-pinos', 38108),
  ('dos-pinos', 38345),
  ('dos-pinos', 38537),
  ('dos-pinos', 38606),
  ('dos-pinos', 38703),
  ('dos-pinos', 38872),
  ('dos-pinos', 39338),
  ('dos-pinos', 39439),
  ('dos-pinos', 37138),
  ('dos-pinos', 38996),
  ('dos-pinos', 38085),
  ('cmi', 38100),
  ('cmi', 38983),
  ('arkfin', 38105)
);

UPDATE public.tasks SET owner = 'Maria Nelly Vargas Salazar' WHERE (client_id, original_id) IN (
  ('dos-pinos', 35428),
  ('dos-pinos', 35577),
  ('dos-pinos', 35677),
  ('dos-pinos', 35923),
  ('dos-pinos', 36192),
  ('dos-pinos', 36185),
  ('dos-pinos', 36204),
  ('dos-pinos', 36356),
  ('dos-pinos', 36559),
  ('dos-pinos', 37118),
  ('dos-pinos', 36826),
  ('dos-pinos', 38157),
  ('dos-pinos', 37339),
  ('dos-pinos', 38389),
  ('dos-pinos', 38390),
  ('dos-pinos', 38467),
  ('dos-pinos', 38468),
  ('dos-pinos', 38084),
  ('dos-pinos', 38473),
  ('cmi', 37600),
  ('cmi', 37601),
  ('cmi', 37709),
  ('cmi', 37380),
  ('cmi', 36909),
  ('cmi', 36898),
  ('cmi', 36910),
  ('cmi', 36944),
  ('cmi', 37019),
  ('cmi', 37146),
  ('cmi', 36942),
  ('cmi', 37017),
  ('cmi', 37030),
  ('cmi', 37037),
  ('cmi', 37439),
  ('arkfin', 37293),
  ('arkfin', 37295),
  ('arkfin', 37296),
  ('arkfin', 37425),
  ('arkfin', 37526),
  ('arkfin', 37426),
  ('amc', 36828),
  ('amc', 36829),
  ('amc', 36831),
  ('amc', 36827),
  ('amc', 37031)
);

UPDATE public.tasks SET owner = 'Olga Lucia Cuervo' WHERE (client_id, original_id) IN (
  ('dos-pinos', 35429),
  ('dos-pinos', 35532),
  ('dos-pinos', 35574),
  ('dos-pinos', 35675),
  ('dos-pinos', 35921),
  ('dos-pinos', 36074),
  ('dos-pinos', 36133),
  ('dos-pinos', 36199),
  ('dos-pinos', 36345),
  ('dos-pinos', 36500),
  ('dos-pinos', 36926),
  ('dos-pinos', 37222),
  ('dos-pinos', 37291),
  ('dos-pinos', 37772),
  ('dos-pinos', 38499),
  ('dos-pinos', 38656),
  ('dos-pinos', 37450),
  ('dos-pinos', 37817)
);

UPDATE public.tasks SET owner = 'Carlos Andrés Rico' WHERE (client_id, original_id) IN (
  ('dos-pinos', 35430),
  ('dos-pinos', 35541),
  ('dos-pinos', 35572),
  ('dos-pinos', 35676),
  ('dos-pinos', 35922),
  ('dos-pinos', 36086),
  ('dos-pinos', 36142),
  ('dos-pinos', 36200),
  ('dos-pinos', 36358),
  ('dos-pinos', 36531),
  ('dos-pinos', 37092),
  ('dos-pinos', 37226),
  ('dos-pinos', 37356),
  ('dos-pinos', 37635),
  ('dos-pinos', 37754),
  ('dos-pinos', 38498),
  ('dos-pinos', 38807),
  ('dos-pinos', 38838),
  ('dos-pinos', 38880),
  ('dos-pinos', 39056),
  ('dos-pinos', 39355),
  ('dos-pinos', 37525),
  ('dos-pinos', 37696),
  ('dos-pinos', 38223),
  ('dos-pinos', 38271),
  ('dos-pinos', 38330),
  ('dos-pinos', 38651),
  ('cmi', 38912),
  ('cmi', 38913),
  ('cmi', 38914),
  ('cmi', 39089),
  ('cmi', 38786),
  ('cmi', 38840),
  ('cmi', 38869)
);

UPDATE public.tasks SET owner = 'Andrés Julián Gómez' WHERE (client_id, original_id) IN (
  ('dos-pinos', 35431),
  ('dos-pinos', 35578),
  ('dos-pinos', 35678),
  ('dos-pinos', 36164),
  ('cmi', 37101),
  ('cmi', 37011),
  ('arkfin', 39076)
);

UPDATE public.tasks SET owner = 'Fauricio Navarro' WHERE (client_id, original_id) IN (
  ('dos-pinos', 35493),
  ('dos-pinos', 35579),
  ('dos-pinos', 35674),
  ('dos-pinos', 35920),
  ('dos-pinos', 36087),
  ('dos-pinos', 36163),
  ('dos-pinos', 36202),
  ('dos-pinos', 36354),
  ('dos-pinos', 36557)
);

UPDATE public.tasks SET owner = 'Andrés Venegas' WHERE (client_id, original_id) IN (
  ('dos-pinos', 35883),
  ('dos-pinos', 35924),
  ('dos-pinos', 35640)
);

UPDATE public.tasks SET owner = 'Marco Pisacreta' WHERE (client_id, original_id) IN (
  ('dos-pinos', 36952),
  ('cmi', 37026),
  ('cmi', 37025)
);

UPDATE public.tasks SET owner = 'Sandra Guerra' WHERE (client_id, original_id) IN (
  ('dos-pinos', 39048),
  ('dos-pinos', 39444)
);

UPDATE public.tasks SET owner = 'Carlos Quesada' WHERE (client_id, original_id) IN (
  ('cmi', 37418),
  ('cmi', 37105),
  ('cmi', 37406),
  ('cmi', 37163),
  ('cmi', 37162),
  ('cmi', 37161),
  ('cmi', 37066),
  ('cmi', 37128),
  ('cmi', 37679),
  ('cmi', 36939),
  ('cmi', 36953),
  ('cmi', 37243),
  ('cmi', 37680),
  ('cmi', 37834),
  ('cmi', 36937),
  ('cmi', 36943),
  ('cmi', 37164),
  ('cmi', 37018),
  ('cmi', 36941),
  ('cmi', 36954),
  ('cmi', 37038),
  ('cmi', 37106),
  ('cmi', 37107),
  ('cmi', 37416),
  ('cmi', 37407),
  ('cmi', 37417),
  ('cmi', 37410),
  ('cmi', 37745),
  ('cmi', 37157),
  ('cmi', 37835),
  ('cmi', 37412),
  ('cmi', 37007),
  ('cmi', 37158),
  ('cmi', 37686),
  ('cmi', 37840),
  ('cmi', 38012),
  ('cmi', 38121),
  ('cmi', 38296),
  ('cmi', 38900),
  ('cmi', 37415),
  ('cmi', 37408),
  ('cmi', 37685),
  ('cmi', 37837),
  ('cmi', 37688),
  ('cmi', 37808),
  ('cmi', 37830),
  ('cmi', 37843),
  ('cmi', 38297)
);

UPDATE public.tasks SET owner = 'Luis Mangel' WHERE (client_id, original_id) IN (
  ('cmi', 36839),
  ('cmi', 36858),
  ('cmi', 36838),
  ('cmi', 37796),
  ('cmi', 37801),
  ('cmi', 37777)
);

UPDATE public.tasks SET owner = 'Bryan Hernandez' WHERE (client_id, original_id) IN (
  ('cmi', 36940),
  ('cmi', 36965),
  ('cmi', 37098),
  ('cmi', 37112),
  ('cmi', 37367),
  ('cmi', 37711),
  ('cmi', 36902),
  ('cmi', 36903),
  ('cmi', 36945),
  ('cmi', 37384),
  ('cmi', 37271),
  ('cmi', 37269),
  ('cmi', 37187),
  ('cmi', 37719),
  ('cmi', 37156),
  ('cmi', 36946),
  ('cmi', 37154),
  ('cmi', 37697),
  ('cmi', 36929),
  ('cmi', 37611),
  ('cmi', 36995),
  ('cmi', 37614),
  ('cmi', 37832),
  ('cmi', 37867),
  ('amc', 37717),
  ('amc', 37664),
  ('amc', 36923),
  ('amc', 36928),
  ('amc', 37153),
  ('amc', 36955),
  ('amc', 37708),
  ('amc', 36956)
);

UPDATE public.tasks SET owner = 'Luis M. Alfaro' WHERE (client_id, original_id) IN (
  ('cmi', 37707),
  ('cmi', 37831),
  ('cmi', 37871)
);

UPDATE public.tasks SET owner = 'Diego García' WHERE (client_id, original_id) IN (
  ('cmi', 37797),
  ('cmi', 37747),
  ('cmi', 37799),
  ('cmi', 37800),
  ('cmi', 37811)
);


-- ─── 3. Linkear assigned_user_id donde haya auth user (si corresponde) ───
UPDATE public.tasks t
   SET assigned_user_id = au.id
  FROM auth.users au
  JOIN public.sysde_team_members m ON LOWER(m.email) = LOWER(au.email)
 WHERE t.owner = m.name
   AND t.assigned_user_id IS NULL
   AND t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- ─── 4. Reporte ──────────────────────────────────────────────────────────
DO $report$
DECLARE
  v_with_owner    INTEGER;
  v_with_user     INTEGER;
  v_total         INTEGER;
  v_team_members  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');
  SELECT COUNT(*) INTO v_with_owner
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     AND owner IS NOT NULL AND owner != '—';
  SELECT COUNT(*) INTO v_with_user
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     AND assigned_user_id IS NOT NULL;
  SELECT COUNT(*) INTO v_team_members
    FROM public.sysde_team_members WHERE is_active = TRUE;
  RAISE NOTICE 'Tasks: % total · % con owner (%.1f%%) · % linked a auth user',
    v_total, v_with_owner, (v_with_owner::float / v_total * 100), v_with_user;
  RAISE NOTICE 'Sysde team_members activos: %', v_team_members;
END;
$report$;
