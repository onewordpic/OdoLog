import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SlowResourceSchema = z.object({
  name: z.string().max(200),
  duration_ms: z.number(),
  size_kb: z.number().nullable(),
  kind: z.string().max(40),
});

const SampleSchema = z.object({
  route: z.string().max(200),
  device: z.string().max(20),
  connection: z.string().max(20).nullable(),
  app_version: z.string().max(20),
  ttfb_ms: z.number().nullable(),
  fcp_ms: z.number().nullable(),
  lcp_ms: z.number().nullable(),
  hydration_ms: z.number().nullable(),
  route_load_ms: z.number().nullable(),
  total_ms: z.number().nullable(),
  slow_resources: z.array(SlowResourceSchema).max(10),
  captured_at: z.string(),
});

export type PerfRow = {
  id: string;
  created_at: string;
  route: string;
  device: string | null;
  connection: string | null;
  app_version: string | null;
  ttfb_ms: number | null;
  fcp_ms: number | null;
  lcp_ms: number | null;
  hydration_ms: number | null;
  route_load_ms: number | null;
  total_ms: number | null;
  slow_resources: {
    name: string;
    duration_ms: number;
    size_kb: number | null;
    kind: string;
  }[];
};

export const recordPerfSamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ samples: z.array(SampleSchema).max(30) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ inserted: number }> => {
    const { supabase, userId } = context;
    if (!data.samples.length) return { inserted: 0 };
    const rows = data.samples.map((s) => ({
      user_id: userId,
      created_at: s.captured_at,
      route: s.route,
      device: s.device,
      connection: s.connection,
      app_version: s.app_version,
      ttfb_ms: s.ttfb_ms,
      fcp_ms: s.fcp_ms,
      lcp_ms: s.lcp_ms,
      hydration_ms: s.hydration_ms,
      route_load_ms: s.route_load_ms,
      total_ms: s.total_ms,
      slow_resources: s.slow_resources,
    }));
    const { error } = await supabase.from("perf_samples").insert(rows as never);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const listPerfSamples = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ sinceHours: z.number().int().positive().max(24 * 400).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<PerfRow[]> => {
    const { supabase, userId } = context;
    let q = supabase
      .from("perf_samples")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.sinceHours) {
      const since = new Date(Date.now() - data.sinceHours * 3600_000).toISOString();
      q = q.gte("created_at", since);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as PerfRow[];
  });

export const clearPerfSamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("perf_samples")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
