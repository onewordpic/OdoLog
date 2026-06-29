// Eco / CO₂ helpers for OdoLog.
// Emission factors are tail-pipe kg CO₂ per litre / kg of fuel.
// Sources: IPCC / India MoEF averages — close enough for personal tracking.

export type FuelType = "petrol" | "diesel" | "cng" | "electric";

export const EMISSION_FACTOR: Record<FuelType, number> = {
  petrol: 2.31, // kg CO₂ per litre
  diesel: 2.68,
  cng: 2.75, // per kg
  electric: 0,
};

export type EcoGrade = "A" | "B" | "C" | "D" | "E" | "F";

/**
 * Grade by kg CO₂ per km. Based on rough EU passenger-car bands
 * (g/km → kg/km) but tuned for two-wheeler-friendly thresholds.
 */
export function gradeFromKgPerKm(kgPerKm: number | null | undefined): EcoGrade | null {
  if (kgPerKm == null || !isFinite(kgPerKm) || kgPerKm < 0) return null;
  const g = kgPerKm * 1000; // grams / km
  if (g <= 50) return "A";
  if (g <= 95) return "B";
  if (g <= 130) return "C";
  if (g <= 170) return "D";
  if (g <= 220) return "E";
  return "F";
}

export function gradeColor(grade: EcoGrade | null): string {
  switch (grade) {
    case "A": return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300";
    case "B": return "bg-lime-500/20 text-lime-600 dark:text-lime-300";
    case "C": return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-300";
    case "D": return "bg-amber-500/20 text-amber-600 dark:text-amber-300";
    case "E": return "bg-orange-500/20 text-orange-600 dark:text-orange-300";
    case "F": return "bg-rose-500/20 text-rose-600 dark:text-rose-300";
    default: return "bg-foreground/10 text-muted-foreground";
  }
}

export function co2FromLitres(litres: number, fuel: FuelType): number {
  return Math.max(0, litres) * (EMISSION_FACTOR[fuel] ?? 0);
}

/** kg CO₂ for a trip given distance + average mileage (km/l) + fuel type. */
export function co2FromTrip(
  distanceKm: number,
  kmPerL: number | null | undefined,
  fuel: FuelType,
): number | null {
  if (fuel === "electric") return 0;
  if (!kmPerL || kmPerL <= 0 || !isFinite(kmPerL)) return null;
  return co2FromLitres(distanceKm / kmPerL, fuel);
}
