CREATE TABLE public.postcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  template text NOT NULL DEFAULT 'airmail',
  photo_path text,
  audio_path text,
  drawing_path text,
  message text NOT NULL DEFAULT '',
  sender text NOT NULL DEFAULT '',
  recipient text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  stickers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX postcards_slug_idx ON public.postcards (slug);

GRANT SELECT, INSERT ON public.postcards TO anon;
GRANT SELECT, INSERT ON public.postcards TO authenticated;
GRANT ALL ON public.postcards TO service_role;

ALTER TABLE public.postcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Postcards are readable by anyone with the link"
  ON public.postcards FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create a postcard"
  ON public.postcards FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can read postcard media"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'postcards');

CREATE POLICY "Anyone can upload postcard media"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'postcards');