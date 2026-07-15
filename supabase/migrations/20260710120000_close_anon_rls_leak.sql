-- Cierre de fuga anónima: varias tablas internas tenían políticas RLS con
-- USING(true)/WITH CHECK(true) aplicadas al rol `public` (que incluye `anon`),
-- lo que permitía LEER/ESCRIBIR sin login. Confirmado en prod: pm_ai_analysis
-- (27 filas) y sysde_team_members (19 filas con PII) eran legibles sin sesión.
--
-- Fix: cambiar SOLO el ROL de esas políticas de `public` → `authenticated`.
-- No se toca la expresión USING/CHECK, así que el comportamiento para usuarios
-- logueados es idéntico; solo se corta el acceso anónimo.
--
-- Se EXCLUYEN las tablas que el compartir público (rutas /shared/:token) necesita
-- leer sin login: shared_presentations, shared_support_presentations,
-- shared_ticket_history, presentation_feedback, support_presentation_feedback,
-- presentation_data.

do $$
declare r record; n int := 0;
begin
  for r in
    select c.relname, p.polname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and (coalesce(pg_get_expr(p.polqual, p.polrelid),'') = 'true'
           or coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'') = 'true')
      and p.polroles = '{0}'  -- rol public (oid 0), incluye anon
      and c.relname not in (
        'shared_presentations','shared_support_presentations','shared_ticket_history',
        'presentation_feedback','support_presentation_feedback','presentation_data'
      )
  loop
    execute format('alter policy %I on public.%I to authenticated', r.polname, r.relname);
    n := n + 1;
  end loop;
  raise notice 'RLS: % políticas restringidas de public a authenticated', n;
end $$;
