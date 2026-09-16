-- Secure digital-mail foundation. Legacy share links remain readable, while every new mailed
-- postcard is split into trackable metadata and delivery-gated contents.

ALTER TABLE public.postcards
  ADD COLUMN sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN recipient_email text,
  ADD COLUMN status text NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN tracking_number text UNIQUE,
  ADD COLUMN postage_class text NOT NULL DEFAULT 'STANDARD_DIGITAL_POST',
  ADD COLUMN origin_label text,
  ADD COLUMN origin_postal_code text,
  ADD COLUMN destination_label text,
  ADD COLUMN destination_postal_code text,
  ADD COLUMN mailed_at timestamptz,
  ADD COLUMN estimated_delivery_at timestamptz,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN opened_at timestamptz,
  ADD COLUMN selected_stamp_id text,
  ADD COLUMN legacy_public boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT postcards_status_check CHECK (
    status IN ('DRAFT', 'READY_TO_MAIL', 'MAILED', 'ACCEPTED', 'ORIGIN_PROCESSING',
      'IN_TRANSIT', 'DESTINATION_PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'OPENED')
  ),
  ADD CONSTRAINT postcards_postage_class_check CHECK (
    postage_class IN ('STANDARD_DIGITAL_POST', 'EXPRESS_DIGITAL_POST', 'SPECIAL_DELIVERY')
  );

-- Rows from the original prototype keep their share-link behavior. New rows never receive this flag.
UPDATE public.postcards
SET legacy_public = true
WHERE sender_id IS NULL AND tracking_number IS NULL;

CREATE UNIQUE INDEX postcards_tracking_number_idx
  ON public.postcards (tracking_number)
  WHERE tracking_number IS NOT NULL;
CREATE INDEX postcards_sender_idx ON public.postcards (sender_id, mailed_at DESC);
CREATE INDEX postcards_recipient_email_idx ON public.postcards (lower(recipient_email), mailed_at DESC);

CREATE TABLE public.postcard_contents (
  postcard_id uuid PRIMARY KEY REFERENCES public.postcards(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1,
  template text NOT NULL,
  message text NOT NULL DEFAULT '',
  sender_label text NOT NULL DEFAULT '',
  recipient_label text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  stickers jsonb NOT NULL DEFAULT '[]'::jsonb,
  stamp_placement jsonb NOT NULL DEFAULT '{}'::jsonb,
  photo_path text,
  drawing_path text,
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  postcard_id uuid NOT NULL REFERENCES public.postcards(id) ON DELETE CASCADE,
  status text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  location_label text,
  detail text,
  delay_code text,
  CONSTRAINT tracking_events_status_check CHECK (
    status IN ('MAILED', 'ACCEPTED', 'ORIGIN_PROCESSING', 'IN_TRANSIT',
      'DESTINATION_PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'OPENED')
  ),
  CONSTRAINT tracking_events_delay_check CHECK (
    delay_code IS NULL OR delay_code IN ('WEATHER', 'HOLIDAY', 'TRANSIT')
  )
);
CREATE INDEX tracking_events_postcard_idx
  ON public.tracking_events (postcard_id, occurred_at);

CREATE TABLE public.catalog_items (
  id text PRIMARY KEY,
  item_type text NOT NULL CHECK (item_type IN ('STAMP', 'STICKER')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  artwork text NOT NULL,
  collection_id text,
  rarity text NOT NULL DEFAULT 'COMMON',
  is_premium boolean NOT NULL DEFAULT false,
  is_limited_edition boolean NOT NULL DEFAULT false,
  edition_size integer,
  available_from timestamptz,
  available_until timestamptz,
  creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location_rule jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.catalog_items (id, item_type, name, description, artwork)
VALUES ('classic-airmail', 'STAMP', 'Classic Airmail', 'The free starter stamp.', '5')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.user_inventory (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.catalog_items(id),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  PRIMARY KEY (owner_id, item_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  postcard_id uuid NOT NULL REFERENCES public.postcards(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.effective_postcard_status(
  stored_status text,
  mailed_at timestamptz,
  estimated_delivery_at timestamptz,
  opened_at timestamptz
) RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN opened_at IS NOT NULL THEN 'OPENED'
    WHEN estimated_delivery_at IS NOT NULL AND now() >= estimated_delivery_at THEN 'DELIVERED'
    WHEN mailed_at IS NULL THEN stored_status
    WHEN now() >= mailed_at + ((estimated_delivery_at - mailed_at) * 0.84) THEN 'OUT_FOR_DELIVERY'
    WHEN now() >= mailed_at + ((estimated_delivery_at - mailed_at) * 0.68) THEN 'DESTINATION_PROCESSING'
    WHEN now() >= mailed_at + ((estimated_delivery_at - mailed_at) * 0.34) THEN 'IN_TRANSIT'
    WHEN now() >= mailed_at + interval '3 hours' THEN 'ORIGIN_PROCESSING'
    WHEN now() >= mailed_at + interval '30 minutes' THEN 'ACCEPTED'
    ELSE 'MAILED'
  END
$$;

CREATE OR REPLACE FUNCTION public.add_business_days(start_at timestamptz, day_count integer)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  result timestamptz := start_at;
  remaining integer := day_count;
BEGIN
  WHILE remaining > 0 LOOP
    result := result + interval '1 day';
    IF extract(isodow FROM result) < 6 THEN
      remaining := remaining - 1;
    END IF;
  END LOOP;
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION public.make_postcard_tracking_number()
RETURNS text
LANGUAGE plpgsql VOLATILE
SET search_path = ''
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := 'PC-' || lpad((floor(random() * 10000))::int::text, 4, '0') || '-'
      || lpad((floor(random() * 10000))::int::text, 4, '0') || '-'
      || lpad((floor(random() * 10000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.postcards WHERE tracking_number = candidate
    );
  END LOOP;
  RETURN candidate;
END
$$;

CREATE OR REPLACE FUNCTION public.grant_starter_inventory(user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.user_inventory (owner_id, item_id, quantity)
  VALUES (user_id, 'classic-airmail', 20)
  ON CONFLICT (owner_id, item_id) DO NOTHING
$$;

CREATE OR REPLACE FUNCTION public.mail_postcard(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  card_id uuid;
  tracking text;
  mailed timestamptz := now();
  delivery timestamptz;
  recipient_id uuid;
  stamp_id text := coalesce(payload->>'stamp_id', '');
  transit_days integer;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF coalesce(payload->>'recipient_email', '') = '' THEN RAISE EXCEPTION 'Recipient email required'; END IF;
  IF stamp_id = '' THEN RAISE EXCEPTION 'A stamp is required'; END IF;

  PERFORM public.grant_starter_inventory(current_user_id);

  UPDATE public.user_inventory
  SET quantity = quantity - 1, last_used_at = mailed
  WHERE owner_id = current_user_id AND item_id = stamp_id AND quantity > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'You do not own an available copy of this stamp'; END IF;

  SELECT id INTO recipient_id
  FROM auth.users
  WHERE lower(email) = lower(payload->>'recipient_email')
  LIMIT 1;

  transit_days := CASE
    WHEN left(coalesce(payload->>'origin_postal_code', ''), 1) =
      left(coalesce(payload->>'destination_postal_code', ''), 1) THEN 2
    ELSE 3
  END;
  delivery := public.add_business_days(mailed, transit_days);
  tracking := public.make_postcard_tracking_number();

  INSERT INTO public.postcards (
    slug, template, sender, recipient, sender_id, recipient_user_id, recipient_email,
    status, tracking_number, postage_class, origin_label, origin_postal_code,
    destination_label, destination_postal_code, mailed_at, estimated_delivery_at,
    selected_stamp_id, legacy_public
  ) VALUES (
    payload->>'slug', payload->>'template', payload->>'sender_label', payload->>'recipient_label',
    current_user_id, recipient_id, lower(payload->>'recipient_email'), 'MAILED', tracking,
    'STANDARD_DIGITAL_POST', payload->>'origin_label', payload->>'origin_postal_code',
    payload->>'destination_label', payload->>'destination_postal_code', mailed, delivery,
    stamp_id, false
  ) RETURNING id INTO card_id;

  INSERT INTO public.postcard_contents (
    postcard_id, template, message, sender_label, recipient_label, note, stickers,
    stamp_placement, photo_path, drawing_path, audio_path
  ) VALUES (
    card_id, payload->>'template', coalesce(payload->>'message', ''),
    coalesce(payload->>'sender_label', ''), coalesce(payload->>'recipient_label', ''),
    coalesce(payload->>'note', ''), coalesce(payload->'stickers', '[]'::jsonb),
    coalesce(payload->'stamp_placement', '{}'::jsonb), payload->>'photo_path',
    payload->>'drawing_path', payload->>'audio_path'
  );

  INSERT INTO public.tracking_events (postcard_id, status, location_label, detail)
  VALUES (card_id, 'MAILED', payload->>'origin_label', 'Postcard entered digital mail transit');

  INSERT INTO public.notifications (
    recipient_id, recipient_email, postcard_id, kind, title, body
  ) VALUES (
    recipient_id, lower(payload->>'recipient_email'), card_id, 'INCOMING_MAIL',
    'You have mail coming', 'A postcard is traveling to you.'
  );

  RETURN jsonb_build_object(
    'postcard_id', card_id,
    'tracking_number', tracking,
    'mailed_at', mailed,
    'estimated_delivery_at', delivery
  );
END
$$;

CREATE OR REPLACE FUNCTION public.open_postcard(target_tracking_number text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  card public.postcards%ROWTYPE;
BEGIN
  SELECT * INTO card FROM public.postcards WHERE tracking_number = target_tracking_number;
  IF card.id IS NULL THEN RAISE EXCEPTION 'Postcard not found'; END IF;
  IF lower(coalesce(auth.jwt()->>'email', '')) <> lower(card.recipient_email) THEN
    RAISE EXCEPTION 'Only the recipient can open this postcard';
  END IF;
  IF now() < card.estimated_delivery_at THEN RAISE EXCEPTION 'This postcard has not arrived yet'; END IF;
  IF card.opened_at IS NULL THEN
    UPDATE public.postcards
    SET opened_at = now(), delivered_at = coalesce(delivered_at, estimated_delivery_at), status = 'OPENED',
      recipient_user_id = coalesce(recipient_user_id, auth.uid())
    WHERE id = card.id;
    INSERT INTO public.tracking_events (postcard_id, status, location_label, detail)
    VALUES (card.id, 'OPENED', card.destination_label, 'Opened by recipient');
  END IF;
END
$$;

ALTER TABLE public.postcard_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Postcards are readable by anyone with the link" ON public.postcards;
DROP POLICY IF EXISTS "Anyone can create a postcard" ON public.postcards;
CREATE POLICY "Legacy postcards remain readable"
  ON public.postcards FOR SELECT TO anon USING (legacy_public = true);
CREATE POLICY "Participants can track postcards"
  ON public.postcards FOR SELECT TO authenticated
  USING (
    legacy_public = true OR sender_id = auth.uid() OR
    lower(recipient_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

CREATE POLICY "Recipients can read delivered contents"
  ON public.postcard_contents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.postcards p
    WHERE p.id = postcard_id
      AND lower(p.recipient_email) = lower(coalesce(auth.jwt()->>'email', ''))
      AND now() >= p.estimated_delivery_at
  ));

CREATE POLICY "Participants can read tracking events"
  ON public.tracking_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.postcards p
    WHERE p.id = postcard_id AND (
      p.sender_id = auth.uid() OR
      lower(p.recipient_email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  ));

CREATE POLICY "Catalog is readable" ON public.catalog_items
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "Owners can read inventory" ON public.user_inventory
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Recipients can read notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (lower(recipient_email) = lower(coalesce(auth.jwt()->>'email', '')));
CREATE POLICY "Recipients can update notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (lower(recipient_email) = lower(coalesce(auth.jwt()->>'email', '')))
  WITH CHECK (lower(recipient_email) = lower(coalesce(auth.jwt()->>'email', '')));

DROP POLICY IF EXISTS "Public can read postcard media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload postcard media" ON storage.objects;
CREATE POLICY "Authenticated users can upload owned postcard media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'postcards' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Recipients can read delivered postcard media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'postcards' AND EXISTS (
      SELECT 1 FROM public.postcards p
      WHERE p.slug = (storage.foldername(name))[2]
        AND lower(p.recipient_email) = lower(coalesce(auth.jwt()->>'email', ''))
        AND now() >= p.estimated_delivery_at
    )
  );
CREATE POLICY "Legacy postcard media remains readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'postcards' AND EXISTS (
      SELECT 1 FROM public.postcards p
      WHERE p.slug = (storage.foldername(name))[1] AND p.legacy_public = true
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.postcards FROM anon, authenticated;
GRANT SELECT ON public.postcards, public.postcard_contents, public.tracking_events,
  public.catalog_items, public.user_inventory, public.notifications TO authenticated;
GRANT SELECT ON public.postcards, public.catalog_items TO anon;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
REVOKE ALL ON FUNCTION public.grant_starter_inventory(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mail_postcard(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_postcard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mail_postcard(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_postcard(text) TO authenticated;
