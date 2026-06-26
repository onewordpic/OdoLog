ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS make text,
  ADD COLUMN IF NOT EXISTS model_year integer,
  ADD COLUMN IF NOT EXISTS reg_number text,
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.maintenance_logs
  ADD COLUMN IF NOT EXISTS condition text;