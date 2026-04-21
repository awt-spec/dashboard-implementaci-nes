-- ============================================
-- BUSINESS RULES (biblioteca de reglas v4.5)
-- ============================================
CREATE TABLE public.business_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','client','case_type')),
  policy_version TEXT NOT NULL DEFAULT 'v4.5',
  rule_type TEXT NOT NULL DEFAULT 'closure' CHECK (rule_type IN ('closure','sla','notice','checklist','signature','metric','weekly')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/PM read business_rules" ON public.business_rules
  FOR SELECT USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm') OR has_role(auth.uid(),'gerente'));
CREATE POLICY "Admin/PM insert business_rules" ON public.business_rules
  FOR INSERT WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm'));
CREATE POLICY "Admin/PM update business_rules" ON public.business_rules
  FOR UPDATE USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm'));
CREATE POLICY "Admin delete business_rules" ON public.business_rules
  FOR DELETE USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_business_rules_updated
  BEFORE UPDATE ON public.business_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_business_rules_scope ON public.business_rules(scope, is_active);
CREATE INDEX idx_business_rules_type ON public.business_rules(rule_type);

-- ============================================
-- CLIENT RULE OVERRIDES
-- ============================================
CREATE TABLE public.client_rule_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.business_rules(id) ON DELETE CASCADE,
  override_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, rule_id)
);

ALTER TABLE public.client_rule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read client_rule_overrides" ON public.client_rule_overrides
  FOR SELECT USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm') OR
    EXISTS (SELECT 1 FROM public.gerente_client_assignments g WHERE g.user_id = auth.uid() AND g.client_id = client_rule_overrides.client_id)
  );
CREATE POLICY "Admin/PM insert client_rule_overrides" ON public.client_rule_overrides
  FOR INSERT WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm'));
CREATE POLICY "Admin/PM update client_rule_overrides" ON public.client_rule_overrides
  FOR UPDATE USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm'));
CREATE POLICY "Admin delete client_rule_overrides" ON public.client_rule_overrides
  FOR DELETE USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_client_rule_overrides_updated
  BEFORE UPDATE ON public.client_rule_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_client_rule_overrides_client ON public.client_rule_overrides(client_id, is_active);

-- ============================================
-- CASE COMPLIANCE (evaluación por ticket)
-- ============================================
CREATE TABLE public.case_compliance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  client_id TEXT REFERENCES public.clients(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.business_rules(id) ON DELETE SET NULL,
  policy_version TEXT NOT NULL DEFAULT 'v4.5',
  applicable_deadline_days INTEGER,
  days_remaining INTEGER,
  semaphore TEXT NOT NULL DEFAULT 'green' CHECK (semaphore IN ('green','yellow','red','overdue')),
  notices_sent INTEGER NOT NULL DEFAULT 0,
  notices_required INTEGER NOT NULL DEFAULT 3,
  checklist JSONB NOT NULL DEFAULT '{
    "documented_solution": false,
    "client_notification": false,
    "ticket_reference": false,
    "closure_type": false,
    "validation_guide": false
  }'::jsonb,
  checklist_completed_count INTEGER NOT NULL DEFAULT 0,
  ai_recommendation TEXT,
  ai_recommendation_action TEXT,
  ai_last_run_at TIMESTAMPTZ,
  ai_model TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  escalated_to_sprint_id UUID,
  escalated_at TIMESTAMPTZ,
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id)
);

ALTER TABLE public.case_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read case_compliance" ON public.case_compliance
  FOR SELECT USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm') OR has_role(auth.uid(),'colaborador') OR
    EXISTS (SELECT 1 FROM public.gerente_client_assignments g WHERE g.user_id = auth.uid() AND g.client_id = case_compliance.client_id)
  );
CREATE POLICY "Insert case_compliance" ON public.case_compliance
  FOR INSERT WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm') OR has_role(auth.uid(),'colaborador'));
CREATE POLICY "Update case_compliance" ON public.case_compliance
  FOR UPDATE USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm') OR has_role(auth.uid(),'colaborador'));
CREATE POLICY "Admin delete case_compliance" ON public.case_compliance
  FOR DELETE USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_case_compliance_updated
  BEFORE UPDATE ON public.case_compliance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_case_compliance_ticket ON public.case_compliance(ticket_id);
CREATE INDEX idx_case_compliance_client ON public.case_compliance(client_id, semaphore);
CREATE INDEX idx_case_compliance_risk ON public.case_compliance(risk_level);

-- ============================================
-- POLICY AI SETTINGS
-- ============================================
CREATE TABLE public.policy_ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','user')),
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  auto_notice BOOLEAN NOT NULL DEFAULT false,
  auto_checklist BOOLEAN NOT NULL DEFAULT true,
  ai_suggestions BOOLEAN NOT NULL DEFAULT true,
  sync_with_sprint BOOLEAN NOT NULL DEFAULT true,
  evaluation_frequency_minutes INTEGER NOT NULL DEFAULT 60,
  signature_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope)
);

ALTER TABLE public.policy_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read policy_ai_settings" ON public.policy_ai_settings
  FOR SELECT USING (
    user_id = auth.uid() OR scope = 'global' OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm')
  );
CREATE POLICY "Insert policy_ai_settings" ON public.policy_ai_settings
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm')
  );
CREATE POLICY "Update policy_ai_settings" ON public.policy_ai_settings
  FOR UPDATE USING (
    user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pm')
  );
CREATE POLICY "Admin delete policy_ai_settings" ON public.policy_ai_settings
  FOR DELETE USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_policy_ai_settings_updated
  BEFORE UPDATE ON public.policy_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- SEED v4.5 — Política de Cierre de Casos
-- ============================================
INSERT INTO public.business_rules (name, description, scope, policy_version, rule_type, content) VALUES
('Plazos de Cierre v4.5',
 'Plazos máximos de gestión por tipo y prioridad de caso',
 'global','v4.5','sla',
 '{
   "deadlines":[
     {"case_type":"correccion","priority":"alta","deadline_days":3,"notices":3,"interval_hours":24},
     {"case_type":"correccion","priority":"media","deadline_days":5,"notices":2,"interval_hours":48},
     {"case_type":"correccion","priority":"baja","deadline_days":10,"notices":1,"interval_hours":72},
     {"case_type":"requerimiento","priority":"alta","deadline_days":5,"notices":3,"interval_hours":24},
     {"case_type":"requerimiento","priority":"media","deadline_days":10,"notices":2,"interval_hours":48},
     {"case_type":"requerimiento","priority":"baja","deadline_days":15,"notices":1,"interval_hours":72},
     {"case_type":"consulta","priority":"alta","deadline_days":2,"notices":2,"interval_hours":12},
     {"case_type":"consulta","priority":"media","deadline_days":3,"notices":1,"interval_hours":24},
     {"case_type":"consulta","priority":"baja","deadline_days":5,"notices":1,"interval_hours":48}
   ]
 }'::jsonb),
('Checklist de Cierre v4.5',
 'Cinco elementos obligatorios para poder cerrar un caso',
 'global','v4.5','checklist',
 '{
   "items":[
     {"key":"documented_solution","label":"Solución documentada","required":true,"description":"Diagnóstico con: qué pasó, qué se hizo, estado final, definitiva/temporal"},
     {"key":"client_notification","label":"Notificación al cliente enviada","required":true,"description":"Aviso formal con firma estándar"},
     {"key":"ticket_reference","label":"Ticket referenciado","required":true,"description":"Número de ticket vinculado"},
     {"key":"closure_type","label":"Tipo de cierre seleccionado","required":true,"description":"Resuelto / No reproducible / Por cliente / Workaround"},
     {"key":"validation_guide","label":"Guía de validación entregada","required":true,"description":"Pasos para que el cliente valide la solución"}
   ]
 }'::jsonb),
('Firma Estándar v4.5',
 'Firma corporativa para todas las notificaciones',
 'global','v4.5','signature',
 '{
   "template":"Atentamente,\n\nEquipo de Soporte SYSDE\nsoporte@sysdesupport.com\nwww.sysdesupport.com\n\n* Este caso será cerrado automáticamente en [X días] si no recibimos respuesta."
 }'::jsonb),
('Métricas Activas v4.5',
 'Cuatro KPIs que vigilan la salud del soporte',
 'global','v4.5','metric',
 '{
   "metrics":[
     {"key":"backlog_age","label":"Antigüedad de backlog","target":"<5 días","operator":"lt","threshold":5,"unit":"days"},
     {"key":"reopen_rate","label":"Tasa de reapertura","target":"<10%","operator":"lt","threshold":10,"unit":"percent"},
     {"key":"checklist_completion","label":"Checklist completo","target":"100%","operator":"eq","threshold":100,"unit":"percent"},
     {"key":"csat_score","label":"CSAT","target":"≥4","operator":"gte","threshold":4,"unit":"score"}
   ]
 }'::jsonb),
('Cierre Semanal v4.5',
 'Reglas de cierre semanal y revisión de pendientes',
 'global','v4.5','weekly',
 '{
   "rules":[
     {"day":"viernes","action":"Revisar todos los casos abiertos > 3 días","responsible":"Líder de soporte"},
     {"day":"viernes","action":"Cerrar casos con 3 avisos sin respuesta","responsible":"Consultor"},
     {"day":"viernes","action":"Generar reporte semanal de cumplimiento","responsible":"PM"},
     {"day":"lunes","action":"Daily de soporte: revisar casos rojos","responsible":"Equipo"}
   ]
 }'::jsonb);

-- Default global AI settings row
INSERT INTO public.policy_ai_settings (user_id, scope, ai_model, auto_notice, auto_checklist, ai_suggestions, sync_with_sprint, evaluation_frequency_minutes)
VALUES (NULL, 'global', 'google/gemini-3-flash-preview', false, true, true, true, 60);