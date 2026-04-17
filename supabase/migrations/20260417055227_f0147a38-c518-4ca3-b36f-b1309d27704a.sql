-- Add personal identity fields to sysde_team_members
ALTER TABLE public.sysde_team_members
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS hire_date date;

-- Public storage bucket for member avatars and covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-avatars', 'team-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can view, authenticated can upload/update/delete
DROP POLICY IF EXISTS "team-avatars public read" ON storage.objects;
CREATE POLICY "team-avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-avatars');

DROP POLICY IF EXISTS "team-avatars auth upload" ON storage.objects;
CREATE POLICY "team-avatars auth upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'team-avatars');

DROP POLICY IF EXISTS "team-avatars auth update" ON storage.objects;
CREATE POLICY "team-avatars auth update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'team-avatars');

DROP POLICY IF EXISTS "team-avatars auth delete" ON storage.objects;
CREATE POLICY "team-avatars auth delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'team-avatars');