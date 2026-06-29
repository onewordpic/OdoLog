import { Leaf, Zap } from "lucide-react";
import {
  co2FromLitres,
  gradeColor,
  gradeFromKgPerKm,
  type FuelType,
} from "@/lib/eco";

interface Props {
  fuelType: FuelType;
  totalLitres: number;
  totalKm: number | null;
}

export function EcoCard({ fuelType, totalLitres, totalKm }: Props) {
  if (fuelType === "electric") {
    return (
      <section className="glass animate-fade-in-up rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Eco footprint</h3>
            <p className="text-xs text-muted-foreground">
              Zero tailpipe emissions — nice ride.
            </p>
          </div>
          <span className="ml-auto rounded-full px-2.5 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            A+
          </span>
        </div>
      </section>
    );
  }

  const totalKg = co2FromLitres(totalLitres, fuelType);
  const kgPerKm = totalKm && totalKm > 0 ? totalKg / totalKm : null;
  const grade = gradeFromKgPerKm(kgPerKm);
  const trees = totalKg / 21; // ~21 kg CO₂ per tree / year

  return (
    <section className="glass animate-fade-in-up rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
          <Leaf className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Eco footprint</h3>
          <p className="text-xs text-muted-foreground">
            Estimated tailpipe CO₂ from logged fuel.
          </p>
        </div>
        {grade && (
          <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-bold ${gradeColor(grade)}`}>
            {grade}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-foreground/5 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total CO₂</div>
          <div className="mt-1 text-base font-semibold tabular-nums">
            {totalKg < 1000 ? `${totalKg.toFixed(0)} kg` : `${(totalKg / 1000).toFixed(2)} t`}
          </div>
        </div>
        <div className="rounded-2xl bg-foreground/5 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CO₂ / km</div>
          <div className="mt-1 text-base font-semibold tabular-nums">
            {kgPerKm != null ? `${(kgPerKm * 1000).toFixed(0)} g` : "—"}
          </div>
        </div>
        <div className="rounded-2xl bg-foreground/5 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">≈ trees / yr</div>
          <div className="mt-1 text-base font-semibold tabular-nums">
            {trees > 0 ? trees.toFixed(1) : "—"}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Based on standard emission factors. EVs and hybrids vary with grid mix.
      </p>
    </section>
  );
}
