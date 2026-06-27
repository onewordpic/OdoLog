import { useMemo } from "react";
import { Leaf, TreePine, Sparkles } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Refuel, Vehicle } from "@/lib/data-store";
import { co2ForRefuels, treesToOffset, ecoScore, monthlyCO2Series } from "@/lib/eco";

export function EcoCard({
  vehicle,
  refuels,
  actualKmpl,
  claimedKmpl,
}: {
  vehicle: Vehicle;
  refuels: Refuel[];
  actualKmpl?: number | null;
  claimedKmpl?: number | null;
}) {
  const { lifetimeKg, last30Kg, trees, score, series } = useMemo(() => {
    const lifetimeKg = co2ForRefuels(refuels, vehicle.fuel_type);
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const last30 = refuels.filter((r) => new Date(r.refuel_date).getTime() >= cutoff);
    const last30Kg = co2ForRefuels(last30, vehicle.fuel_type);
    // crude monthly km proxy: assume 12 km/L petrol-equivalent if unknown
    const kmpl = actualKmpl ?? 14;
    const litres30 = last30.reduce((s, r) => s + (Number(r.litres) || 0), 0);
    const monthlyKm = litres30 * kmpl;
    return {
      lifetimeKg,
      last30Kg,
      trees: treesToOffset(lifetimeKg),
      score: ecoScore({
        fuelType: vehicle.fuel_type,
        actualKmpl,
        claimedKmpl,
        monthlyKm,
      }),
      series: monthlyCO2Series(refuels, vehicle.fuel_type, 6),
    };
  }, [refuels, vehicle.fuel_type, actualKmpl, claimedKmpl]);

  const gradeTint =
    score.grade === "A" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" :
    score.grade === "B" ? "bg-lime-500/15 text-lime-600 dark:text-lime-300" :
    score.grade === "C" ? "bg-amber-500/15 text-amber-600 dark:text-amber-300" :
    score.grade === "D" ? "bg-orange-500/15 text-orange-600 dark:text-orange-300" :
    "bg-red-500/15 text-red-600 dark:text-red-300";

  return (
    <section className="glass rounded-2xl p-4 sm:p-5 animate-fade-in">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold">Eco footprint</h3>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeTint}`}>
          {score.grade} · {score.score}
        </span>
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Tile
          value={vehicle.fuel_type === "electric" ? "0" : lifetimeKg < 1000 ? lifetimeKg.toFixed(0) : (lifetimeKg / 1000).toFixed(1) + "k"}
          unit={vehicle.fuel_type === "electric" ? "kg CO₂" : lifetimeKg < 1000 ? "kg CO₂ lifetime" : "kg CO₂ lifetime"}
        />
        <Tile
          value={vehicle.fuel_type === "electric" ? "0" : last30Kg.toFixed(0)}
          unit="kg · last 30d"
        />
        <Tile
          value={vehicle.fuel_type === "electric" ? "—" : trees.toFixed(1)}
          unit="trees / yr to offset"
          icon={<TreePine className="h-3 w-3" />}
        />
      </div>

      {vehicle.fuel_type !== "electric" && series.some((s) => s.kg > 0) && (
        <div className="mt-3 h-20 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <XAxis dataKey="month" hide />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v} kg`, "CO₂"]}
                labelFormatter={(l) => `Month ${l}`}
              />
              <Line
                type="monotone"
                dataKey="kg"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" /> {score.blurb}
      </p>
    </section>
  );
}

function Tile({ value, unit, icon }: { value: string; unit: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl glass-subtle px-2 py-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {unit}
      </div>
    </div>
  );
}
