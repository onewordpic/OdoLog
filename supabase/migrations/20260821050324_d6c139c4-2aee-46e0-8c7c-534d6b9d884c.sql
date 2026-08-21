ALTER TABLE public.refuels
  ADD COLUMN IF NOT EXISTS tank_state_after text,
  ADD COLUMN IF NOT EXISTS reserve_switch_odo_km numeric;