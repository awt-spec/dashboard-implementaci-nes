-- Generar emails automáticos para miembros sin email
-- Formato: primernombre.primerapellido@sysde.com (sin tildes ni espacios)
UPDATE public.sysde_team_members
SET email = lower(
  regexp_replace(
    translate(
      split_part(name, ' ', 1) || '.' || 
      CASE 
        WHEN split_part(name, ' ', 2) != '' THEN split_part(name, ' ', 2)
        ELSE 'sysde'
      END,
      'áéíóúÁÉÍÓÚñÑ',
      'aeiouAEIOUnN'
    ),
    '[^a-zA-Z0-9.]', '', 'g'
  )
) || '@sysde.com'
WHERE (email IS NULL OR email = '') AND is_active = true;