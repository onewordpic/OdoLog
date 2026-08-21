ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS has_reserve boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserve_litres numeric;

ALTER TABLE public.refuels
  ADD COLUMN IF NOT EXISTS tank_state text,
  ADD COLUMN IF NOT EXISTS reserve_km numeric;

ALTER TABLE public.refuels
  DROP CONSTRAINT IF EXISTS refuels_tank_state_check;
ALTER TABLE public.refuels
  ADD CONSTRAINT refuels_tank_state_check CHECK (tank_state IS NULL OR tank_state IN ('main','reserve'));