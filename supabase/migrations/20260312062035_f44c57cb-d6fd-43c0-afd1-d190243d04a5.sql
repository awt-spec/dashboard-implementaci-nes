
-- Add media_urls column to presentation_feedback for audio/video recordings
ALTER TABLE public.presentation_feedback ADD COLUMN IF NOT EXISTS media_urls jsonb DEFAULT '[]'::jsonb;

-- Add priority_rankings column for client prioritization data
ALTER TABLE public.presentation_feedback ADD COLUMN IF NOT EXISTS priority_rankings jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for presentation media (audio/video recordings)
INSERT INTO storage.buckets (id, name, public) VALUES ('presentation-media', 'presentation-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to presentation-media bucket
CREATE POLICY "Allow public upload to presentation-media" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'presentation-media');
CREATE POLICY "Allow public read from presentation-media" ON storage.objects FOR SELECT TO public USING (bucket_id = 'presentation-media');
