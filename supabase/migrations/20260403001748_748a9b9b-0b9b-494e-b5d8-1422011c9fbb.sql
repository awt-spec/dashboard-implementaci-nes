
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_name, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on message_reactions" ON public.message_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert on message_reactions" ON public.message_reactions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all delete on message_reactions" ON public.message_reactions FOR DELETE TO public USING (true);
