
-- Profile fields for public garage
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_handle text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_avatar_url text;

-- Per-vehicle visibility
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS garage_visibility text NOT NULL DEFAULT 'private'
  CHECK (garage_visibility IN ('private','public'));

-- Handle slug validation
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_public_handle_slug_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_public_handle_slug_check
  CHECK (public_handle IS NULL OR public_handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$');

-- AI monthly summaries cache
CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid,
  month date NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, vehicle_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_summaries TO authenticated;
GRANT ALL ON public.ai_summaries TO service_role;

ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai summaries"
  ON public.ai_summaries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ai_summaries_set_updated_at
  BEFORE UPDATE ON public.ai_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security-definer RPC to fetch a public garage by handle.
-- Returns only safe fields (no reg_number, insurance, PUC, purchase price, owner_name).
CREATE OR REPLACE FUNCTION public.get_public_garage(_handle text)
RETURNS TABLE (
  display_name text,
  public_bio text,
  public_avatar_url text,
  default_city text,
  vehicles jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM public.profiles WHERE public_handle = lower(_handle);
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.display_name,
    p.public_bio,
    p.public_avatar_url,
    p.default_city,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'fuel_type', v.fuel_type,
        'icon', v.icon,
        'make', v.make,
        'model_year', v.model_year,
        'image_url', v.image_url,
        'created_at', v.created_at
      ) ORDER BY v.created_at)
      FROM public.vehicles v
      WHERE v.user_id = _user_id
        AND v.garage_visibility = 'public'
        AND v.is_guest = false
    ), '[]'::jsonb)
  FROM public.profiles p
  WHERE p.id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_garage(text) TO anon, authenticated;

-- Aggregated stats for a public garage (lifetime km + spend per vehicle, anonymous)
CREATE OR REPLACE FUNCTION public.get_public_garage_stats(_handle text)
RETURNS TABLE (
  vehicle_id uuid,
  total_spend numeric,
  total_litres numeric,
  refuel_count integer,
  min_odo numeric,
  max_odo numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM public.profiles WHERE public_handle = lower(_handle);
  IF _user_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    r.vehicle_id,
    COALESCE(SUM(r.amount_inr), 0)::numeric AS total_spend,
    COALESCE(SUM(r.litres), 0)::numeric AS total_litres,
    COUNT(*)::int AS refuel_count,
    MIN(r.odo_km)::numeric AS min_odo,
    MAX(r.odo_km)::numeric AS max_odo
  FROM public.refuels r
  JOIN public.vehicles v ON v.id = r.vehicle_id
  WHERE v.user_id = _user_id
    AND v.garage_visibility = 'public'
    AND v.is_guest = false
  GROUP BY r.vehicle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_garage_stats(text) TO anon, authenticated;
