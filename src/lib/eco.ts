// Pure eco / carbon calculations. No I/O.
//
// Emission factors (kg CO₂ per unit fuel) — IPCC / Indian Petroleum Conservation
// Research Association figures, rounded.
//   Petrol  2.31 kg CO₂ / L
//   Diesel  2.68 kg CO₂ / L
//   CNG     2.75 kg CO₂ / kg (stored as kg in the litres field for CNG vehicles)
// EVs use the India grid average ≈ 0.71 kg CO₂ / kWh, but we don't yet log kWh,
// so EVs report "Zero tailpipe" and are excluded from numeric kg totals.

import type { Refuel, Vehicle } from "./data-store";

export const EMISSION_FACTOR: Record<Vehicle["fuel_type"], number> = {
  petrol: 2.31,
  diesel: 2.68,
  cng: 2.75,
  electric: 0,
};

/** Total kg CO₂ for a list of refuels under a given fuel type. */
export function co2ForRefuels(refuels: Refuel[], fuelType: Vehicle["fuel_type"]): number {
  if (fuelType === "electric") return 0;
  const f = EMISSION_FACTOR[fuelType] ?? 0;
  let total = 0;
  for (const r of refuels) total += (Number(r.litres) || 0) * f;
  return total;
}

/** Trees needed to offset given kg CO₂ over a year (avg tree ≈ 21 kg/yr). */
export function treesToOffset(kgCO2: number): number {
  return kgCO2 / 21;
}

export type EcoScore = {
  /** 0–100 */
  score: number;
  /** A–E */
  grade: "A" | "B" | "C" | "D" | "E";
  blurb: string;
};

/**
 * Eco score blends:
 *  - mileage delta vs ARAI / brand claim (50%)
 *  - fuel-type baseline (30%) — EV>CNG>Petrol>Diesel
 *  - recent activity penalty (20%) — heavier monthly km lowers score slightly
 *
 * All inputs optional; missing pieces fall back to neutral.
 */
export function ecoScore(opts: {
  fuelType: Vehicle["fuel_type"];
  actualKmpl?: number | null;
  claimedKmpl?: number | null;
  monthlyKm?: number | null;
}): EcoScore {
  if (opts.fuelType === "electric") {
    return { score: 95, grade: "A", blurb: "Zero tailpipe emissions ✨" };
  }

  // Base by fuel type
  const base =
    opts.fuelType === "cng" ? 70 :
    opts.fuelType === "petrol" ? 55 :
    /* diesel */ 45;

  // Mileage delta: ±25 points
  let mileageBonus = 0;
  if (opts.actualKmpl != null && opts.claimedKmpl != null && opts.claimedKmpl > 0) {
    const ratio = opts.actualKmpl / opts.claimedKmpl;
    mileageBonus = Math.max(-25, Math.min(25, (ratio - 1) * 80));
  }

  // Distance penalty: 0 to −15 once you cross 1500 km/month
  let distPenalty = 0;
  if (opts.monthlyKm != null && opts.monthlyKm > 1500) {
    distPenalty = -Math.min(15, ((opts.monthlyKm - 1500) / 1000) * 10);
  }

  const raw = base + mileageBonus + distPenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const grade: EcoScore["grade"] =
    score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";

  const blurb =
    grade === "A" ? "Cleaner than most. Keep it up." :
    grade === "B" ? "Solid eco performance." :
    grade === "C" ? "Average — small tweaks help." :
    grade === "D" ? "Room to improve. Check tyre pressure and driving style." :
    "Heavy footprint. Consider service tune-up.";

  return { score, grade, blurb };
}

/** Group kg CO₂ by YYYY-MM for the last `months` months (chronological). */
export function monthlyCO2Series(
  refuels: Refuel[],
  fuelType: Vehicle["fuel_type"],
  months = 6,
): { month: string; kg: number }[] {
  const f = EMISSION_FACTOR[fuelType] ?? 0;
  const buckets = new Map<string, number>();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(k, 0);
  }
  for (const r of refuels) {
    const d = new Date(r.refuel_date);
    if (Number.isNaN(d.getTime())) continue;
    if (d < start) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(k)) continue;
    buckets.set(k, (buckets.get(k) ?? 0) + (Number(r.litres) || 0) * f);
  }
  return Array.from(buckets.entries()).map(([month, kg]) => ({
    month: month.slice(5) + "/" + month.slice(2, 4),
    kg: Math.round(kg * 10) / 10,
  }));
}
