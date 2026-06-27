// AI-powered monthly summary for OdoLog.
// Pulls refuels + trips + maintenance for a given month and asks Lovable AI for
// a structured digest (highlights, breakdown, tips). Results cache in
// `ai_summaries` so repeat opens are instant.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  /** YYYY-MM-01 (first of month). */
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehicleId: z.string().uuid().nullable().optional(),
  force: z.boolean().optional(),
});

export type MonthlyDigest = {
  headline: string;
  highlights: string[];
  spend_breakdown: { label: string; amount_inr: number }[];
  vs_last_month: string;
  tips: string[];
  projection_next_month: { spend_inr: number; litres: number } | null;
  totals: {
    spend_inr: number;
    litres: number;
    refuels: number;
    distance_km: number | null;
    co2_kg: number;
  };
  generated_at: string;
};

function monthBounds(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end, label: start.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

const EF: Record<string, number> = { petrol: 2.31, diesel: 2.68, cng: 2.75, electric: 0 };

export const generateMonthlySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<MonthlyDigest> => {
    const { supabase, userId } = context;
    const { start, end, label } = monthBounds(data.month);
    const vehicleId = data.vehicleId ?? null;

    // Cache check
    if (!data.force) {
      const { data: cached } = await supabase
        .from("ai_summaries")
        .select("payload")
        .eq("user_id", userId)
        .eq("month", data.month)
        .is("vehicle_id", vehicleId as any)
        .maybeSingle();
      if (cached?.payload) return cached.payload as MonthlyDigest;
    }

    // Fetch data
    let refuelsQ = supabase
      .from("refuels")
      .select("amount_inr, litres, rate_per_litre, odo_km, refuel_date, vehicle_id, fuel_subtype")
      .eq("user_id", userId)
      .gte("refuel_date", start.toISOString().slice(0, 10))
      .lt("refuel_date", end.toISOString().slice(0, 10));
    if (vehicleId) refuelsQ = refuelsQ.eq("vehicle_id", vehicleId);
    const { data: refuels = [] } = await refuelsQ;

    const prevStart = new Date(start);
    prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
    let prevQ = supabase
      .from("refuels")
      .select("amount_inr, litres")
      .eq("user_id", userId)
      .gte("refuel_date", prevStart.toISOString().slice(0, 10))
      .lt("refuel_date", start.toISOString().slice(0, 10));
    if (vehicleId) prevQ = prevQ.eq("vehicle_id", vehicleId);
    const { data: prev = [] } = await prevQ;

    const { data: vehicles = [] } = await supabase
      .from("vehicles")
      .select("id, name, fuel_type, make")
      .eq("user_id", userId);

    let maintQ = supabase
      .from("maintenance_logs")
      .select("service_type, cost_inr, service_date, vehicle_id")
      .eq("user_id", userId)
      .gte("service_date", start.toISOString().slice(0, 10))
      .lt("service_date", end.toISOString().slice(0, 10));
    if (vehicleId) maintQ = maintQ.eq("vehicle_id", vehicleId);
    const { data: maint = [] } = await maintQ;

    // Totals
    const vById = new Map((vehicles ?? []).map((v: any) => [v.id, v]));
    const totalSpend = (refuels ?? []).reduce((s: number, r: any) => s + Number(r.amount_inr || 0), 0);
    const totalLitres = (refuels ?? []).reduce((s: number, r: any) => s + Number(r.litres || 0), 0);
    const prevSpend = (prev ?? []).reduce((s: number, r: any) => s + Number(r.amount_inr || 0), 0);
    const maintCost = (maint ?? []).reduce((s: number, m: any) => s + Number(m.cost_inr || 0), 0);
    let co2 = 0;
    for (const r of refuels ?? []) {
      const ft = (vById.get((r as any).vehicle_id) as any)?.fuel_type ?? "petrol";
      co2 += Number((r as any).litres || 0) * (EF[ft] ?? 0);
    }
    // Distance from min/max odo per vehicle
    const odoByVeh = new Map<string, { min: number; max: number }>();
    for (const r of refuels ?? []) {
      const odo = Number((r as any).odo_km);
      if (!odo) continue;
      const cur = odoByVeh.get((r as any).vehicle_id);
      if (!cur) odoByVeh.set((r as any).vehicle_id, { min: odo, max: odo });
      else {
        cur.min = Math.min(cur.min, odo);
        cur.max = Math.max(cur.max, odo);
      }
    }
    let distance: number | null = null;
    if (odoByVeh.size) {
      distance = 0;
      for (const { min, max } of odoByVeh.values()) distance += Math.max(0, max - min);
    }

    const totals: MonthlyDigest["totals"] = {
      spend_inr: Math.round(totalSpend),
      litres: Math.round(totalLitres * 10) / 10,
      refuels: refuels?.length ?? 0,
      distance_km: distance != null ? Math.round(distance) : null,
      co2_kg: Math.round(co2 * 10) / 10,
    };

    // Build prompt
    const ctx = {
      month: label,
      scope: vehicleId ? (vById.get(vehicleId) as any)?.name ?? "vehicle" : "all vehicles",
      totals,
      previous_month_spend: Math.round(prevSpend),
      maintenance_count: maint?.length ?? 0,
      maintenance_cost_inr: Math.round(maintCost),
      maintenance_items: (maint ?? []).map((m: any) => m.service_type),
    };

    // Call Lovable AI Gateway (OpenAI-compatible)
    const apiKey = process.env.LOVABLE_API_KEY;
    let digest: MonthlyDigest;
    if (!apiKey || (refuels?.length ?? 0) === 0) {
      // Fallback: deterministic summary, no AI call.
      digest = fallback(ctx);
    } else {
      try {
        digest = await callAi(apiKey, ctx);
      } catch (e) {
        console.error("ai summary failed", e);
        digest = fallback(ctx);
      }
    }
    digest.totals = totals;
    digest.generated_at = new Date().toISOString();

    // Upsert cache
    await supabase
      .from("ai_summaries")
      .upsert(
        {
          user_id: userId,
          vehicle_id: vehicleId,
          month: data.month,
          payload: digest as any,
        },
        { onConflict: "user_id,vehicle_id,month" },
      );

    return digest;
  });

type Ctx = {
  month: string;
  scope: string;
  totals: MonthlyDigest["totals"];
  previous_month_spend: number;
  maintenance_count: number;
  maintenance_cost_inr: number;
  maintenance_items: string[];
};

function fallback(c: Ctx): MonthlyDigest {
  const diff = c.totals.spend_inr - c.previous_month_spend;
  return {
    headline:
      c.totals.refuels === 0
        ? `No refuels logged in ${c.month}.`
        : `You spent ₹${c.totals.spend_inr.toLocaleString("en-IN")} on fuel across ${c.totals.refuels} refuel${c.totals.refuels === 1 ? "" : "s"} in ${c.month}.`,
    highlights: [
      `${c.totals.litres} L of fuel · ${c.totals.co2_kg} kg CO₂`,
      c.totals.distance_km ? `Covered roughly ${c.totals.distance_km} km` : "Add odometer readings to see distance covered",
      c.maintenance_count > 0 ? `${c.maintenance_count} maintenance log${c.maintenance_count === 1 ? "" : "s"} (₹${c.maintenance_cost_inr.toLocaleString("en-IN")})` : "No maintenance this month",
    ],
    spend_breakdown: [
      { label: "Fuel", amount_inr: c.totals.spend_inr },
      ...(c.maintenance_cost_inr > 0 ? [{ label: "Maintenance", amount_inr: c.maintenance_cost_inr }] : []),
    ],
    vs_last_month:
      c.previous_month_spend === 0
        ? "No baseline yet — next month will compare."
        : diff === 0
          ? "Identical to last month."
          : diff > 0
            ? `Up ₹${diff.toLocaleString("en-IN")} vs last month.`
            : `Down ₹${Math.abs(diff).toLocaleString("en-IN")} vs last month.`,
    tips: [
      "Keep tyres at recommended PSI — improves mileage by 3-5%.",
      "Log every refuel as full-tank for the most accurate km/L.",
      "Check air filter every 10,000 km for cleaner combustion.",
    ],
    projection_next_month: c.totals.refuels > 0
      ? {
          spend_inr: c.totals.spend_inr,
          litres: c.totals.litres,
        }
      : null,
    totals: c.totals,
    generated_at: new Date().toISOString(),
  };
}

async function callAi(apiKey: string, ctx: Ctx): Promise<MonthlyDigest> {
  const system = `You are OdoLog's insights writer. You produce concise, friendly monthly summaries for an Indian vehicle owner. Currency is INR. Be specific and reference numbers. Tone: warm, expert, never preachy. Avoid clichés.`;

  const user = `Generate the JSON monthly digest for ${ctx.month}. Scope: ${ctx.scope}.
Data:
${JSON.stringify(ctx, null, 2)}

Respond with ONLY this JSON shape (no markdown, no code fence):
{
  "headline": "one-sentence summary, ≤140 chars",
  "highlights": ["3-4 short bullets"],
  "spend_breakdown": [{"label": "...", "amount_inr": 0}],
  "vs_last_month": "one sentence comparing to previous month",
  "tips": ["3 actionable tips tailored to the data"],
  "projection_next_month": {"spend_inr": 0, "litres": 0}
}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  return {
    headline: String(parsed.headline ?? "Monthly summary"),
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String).slice(0, 5) : [],
    spend_breakdown: Array.isArray(parsed.spend_breakdown)
      ? parsed.spend_breakdown
          .map((b: any) => ({ label: String(b.label ?? ""), amount_inr: Number(b.amount_inr) || 0 }))
          .filter((b: any) => b.label)
      : [],
    vs_last_month: String(parsed.vs_last_month ?? ""),
    tips: Array.isArray(parsed.tips) ? parsed.tips.map(String).slice(0, 4) : [],
    projection_next_month:
      parsed.projection_next_month &&
      typeof parsed.projection_next_month === "object"
        ? {
            spend_inr: Number(parsed.projection_next_month.spend_inr) || 0,
            litres: Number(parsed.projection_next_month.litres) || 0,
          }
        : null,
    totals: ctx.totals,
    generated_at: new Date().toISOString(),
  };
}

// ---------- Public garage handle ----------

const HandleSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,29}$/, "Use 3-30 chars: a-z, 0-9, _ or -").nullable(),
});

export const setPublicHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => HandleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.handle) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("public_handle", data.handle)
        .neq("id", userId)
        .maybeSingle();
      if (existing) {
        throw new Error("That handle is already taken");
      }
    }
    const { error } = await supabase
      .from("profiles")
      .update({ public_handle: data.handle })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, handle: data.handle };
  });

const BioSchema = z.object({
  bio: z.string().max(280).nullable(),
});

export const setPublicBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BioSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ public_bio: data.bio })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const VisibilitySchema = z.object({
  vehicleId: z.string().uuid(),
  visibility: z.enum(["private", "public"]),
});

export const setVehicleVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => VisibilitySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("vehicles")
      .update({ garage_visibility: data.visibility })
      .eq("id", data.vehicleId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Public garage fetch (anon-callable via RPC) ----------

const HandleParam = z.object({ handle: z.string().min(1) });

export type PublicGarage = {
  display_name: string | null;
  public_bio: string | null;
  public_avatar_url: string | null;
  default_city: string | null;
  vehicles: Array<{
    id: string;
    name: string;
    fuel_type: "petrol" | "diesel" | "cng" | "electric";
    icon: "car" | "bike" | "scooter";
    make: string | null;
    model_year: number | null;
    image_url: string | null;
    created_at: string;
    total_spend: number;
    total_litres: number;
    refuel_count: number;
    lifetime_km: number | null;
    co2_kg: number;
  }>;
};

export const fetchPublicGarage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => HandleParam.parse(data))
  .handler(async ({ data }): Promise<PublicGarage | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const handle = data.handle.toLowerCase();
    const [garageRes, statsRes] = await Promise.all([
      sb.rpc("get_public_garage", { _handle: handle }),
      sb.rpc("get_public_garage_stats", { _handle: handle }),
    ]);
    if (garageRes.error) throw new Error(garageRes.error.message);
    const row = (garageRes.data ?? [])[0];
    if (!row) return null;
    const statsByVeh = new Map<string, any>();
    for (const s of statsRes.data ?? []) statsByVeh.set((s as any).vehicle_id, s);

    const vehicles = (Array.isArray(row.vehicles) ? row.vehicles : []).map((v: any) => {
      const s = statsByVeh.get(v.id);
      const litres = Number(s?.total_litres ?? 0);
      const ft = v.fuel_type as keyof typeof EF;
      return {
        id: v.id,
        name: v.name,
        fuel_type: v.fuel_type,
        icon: v.icon,
        make: v.make ?? null,
        model_year: v.model_year ?? null,
        image_url: v.image_url ?? null,
        created_at: v.created_at,
        total_spend: Math.round(Number(s?.total_spend ?? 0)),
        total_litres: Math.round(litres * 10) / 10,
        refuel_count: Number(s?.refuel_count ?? 0),
        lifetime_km:
          s?.min_odo != null && s?.max_odo != null
            ? Math.max(0, Number(s.max_odo) - Number(s.min_odo))
            : null,
        co2_kg: Math.round(litres * (EF[ft] ?? 0) * 10) / 10,
      };
    });

    return {
      display_name: row.display_name ?? null,
      public_bio: row.public_bio ?? null,
      public_avatar_url: row.public_avatar_url ?? null,
      default_city: row.default_city ?? null,
      vehicles,
    };
  });
