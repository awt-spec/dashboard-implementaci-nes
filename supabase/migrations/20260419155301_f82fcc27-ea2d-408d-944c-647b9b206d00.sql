-- Member AI Agents config
CREATE TABLE public.member_ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  role_template TEXT NOT NULL DEFAULT 'default',
  custom_instructions TEXT,
  tone TEXT NOT NULL DEFAULT 'friendly',
  enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.member_ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own agent or admin/pm"
ON public.member_ai_agents FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_agents.member_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert their own agent or admin"
ON public.member_ai_agents FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_agents.member_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their own agent or admin"
ON public.member_ai_agents FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_agents.member_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete agents"
ON public.member_ai_agents FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_member_ai_agents_updated
BEFORE UPDATE ON public.member_ai_agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Member AI Conversations
CREATE TABLE public.member_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_ai_conv_member ON public.member_ai_conversations(member_id, updated_at DESC);

ALTER TABLE public.member_ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members or admin/pm can view conversations"
ON public.member_ai_conversations FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_conversations.member_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert their own conversations"
ON public.member_ai_conversations FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_conversations.member_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their own conversations"
ON public.member_ai_conversations FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_conversations.member_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Members can delete their own conversations"
ON public.member_ai_conversations FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_conversations.member_id AND p.user_id = auth.uid()
  )
);

CREATE TRIGGER trg_member_ai_conv_updated
BEFORE UPDATE ON public.member_ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Member AI Digests
CREATE TABLE public.member_ai_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  summary TEXT NOT NULL,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, week_start)
);

CREATE INDEX idx_member_ai_digests_member ON public.member_ai_digests(member_id, week_start DESC);

ALTER TABLE public.member_ai_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members or admin/pm can view digests"
ON public.member_ai_digests FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_digests.member_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert digests"
ON public.member_ai_digests FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm')
  OR EXISTS (
    SELECT 1 FROM public.sysde_team_members m
    JOIN public.profiles p ON p.email = m.email
    WHERE m.id = member_ai_digests.member_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete digests"
ON public.member_ai_digests FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));