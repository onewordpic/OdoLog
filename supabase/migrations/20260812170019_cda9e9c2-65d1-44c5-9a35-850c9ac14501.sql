CREATE TABLE public.perf_samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  route TEXT NOT NULL,
  device TEXT,
  connection TEXT,
  app_version TEXT,
  ttfb_ms NUMERIC,
  fcp_ms NUMERIC,
  lcp_ms NUMERIC,
  hydration_ms NUMERIC,
  route_load_ms NUMERIC,
  total_ms NUMERIC,
  slow_resources JSONB NOT NULL DEFAULT '[]'::jsonb
);

GRANT SELECT, INSERT, DELETE ON public.perf_samples TO authenticated;
GRANT ALL ON public.perf_samples TO service_role;

ALTER TABLE public.perf_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own perf samples" ON public.perf_samples
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own perf samples" ON public.perf_samples
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own perf samples" ON public.perf_samples
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX perf_samples_user_created_idx ON public.perf_samples (user_id, created_at DESC);