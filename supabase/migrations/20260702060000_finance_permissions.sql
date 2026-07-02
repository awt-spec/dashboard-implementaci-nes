-- Niveles de acceso a información financiera sensible (Mafe/Eduardo).
-- Valores mensuales, pagos, facturas, tarifas, cotizaciones y costos por perfil
-- NO deben verse para todos. Las horas / saldo de horas sí.
--
-- Dos permisos → tres niveles efectivos:
--   • finanzas.ver_montos  → montos comerciales (valor mensual, facturado/
--     pagado/pendiente, cotizaciones, paquetes facturados, penalidades).
--   • finanzas.ver_costos  → costos/tarifas internas por perfil (lo más
--     sensible; costo por colaborador).
--   • sin permiso          → enmascarado ("Referir a Eduardo").

INSERT INTO public.permissions (key, module, action, description) VALUES
  ('finanzas.ver_montos', 'Finanzas', 'ver_montos', 'Ver montos comerciales: valor mensual, facturado/pagado/pendiente, cotizaciones, paquetes y penalidades.'),
  ('finanzas.ver_costos', 'Finanzas', 'ver_costos', 'Ver costos y tarifas internas por perfil/colaborador (información restringida).')
ON CONFLICT (key) DO NOTHING;

-- Asignación a roles. Montos: admin, ceo, gerente, pm. Costos: solo admin, ceo.
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('admin', 'finanzas.ver_montos'),
  ('ceo', 'finanzas.ver_montos'),
  ('gerente', 'finanzas.ver_montos'),
  ('pm', 'finanzas.ver_montos'),
  ('admin', 'finanzas.ver_costos'),
  ('ceo', 'finanzas.ver_costos')
ON CONFLICT (role_key, permission_key) DO NOTHING;
