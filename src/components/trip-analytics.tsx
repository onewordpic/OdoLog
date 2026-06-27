import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTrips, type Trip } from "@/lib/data-store";
import { Route, MapPin, Sparkles, TrendingUp, IndianRupee, CalendarClock } from "lucide-react";

interface Props {
  vehicleId: string;
  costPerKm: number | null;
}

function daysBetween(a: string, b: string) {
  return Math.abs(
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000),
  );
}

export function TripAnalytics({ vehicleId, costPerKm }: Props) {
  const tripsQ = useQuery({
    queryKey: ["trips", vehicleId],
    queryFn: () => listTrips(vehicleId),
  });

  const stats = useMemo(() => computeTripStats(tripsQ.data ?? [], costPerKm), [
    tripsQ.data,
    costPerKm,
  ]);

  if (tripsQ.isLoading) return null;
  if (!stats || stats.totalTrips === 0) return null;

  return (
    <div className="mt-6 animate-fade-in">
      <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[var(--cockpit-text-mute)]" /> Trip analytics
      </h3>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Stat
          icon={<Route className="h-3.5 w-3.5" />}
          label="Total distance"
          value={`${stats.totalKm.toFixed(0)} km`}
        />
        <Stat
          icon={<IndianRupee className="h-3.5 w-3.5" />}
          label="Avg cost / trip"
          value={stats.avgCost != null ? `₹${stats.avgCost.toFixed(0)}` : "—"}
        />
        <Stat
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Total trips"
          value={String(stats.totalTrips)}
        />
      </div>

      {stats.topPurposes.length > 0 && (
        <div className="mt-3 glass rounded-2xl p-4">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
            <MapPin className="h-3.5 w-3.5" /> Top purposes
          </div>
          <div className="space-y-1.5">
            {stats.topPurposes.map((p) => (
              <div key={p.label} className="flex items-center justify-between text-sm">
                <span className="truncate">{p.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {p.count}× · {p.km.toFixed(0)} km
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.nextTripPrediction && (
        <div className="mt-3 glass rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <CalendarClock className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">Next trip likely</div>
            <p className="text-xs text-muted-foreground">
              Based on your typical{" "}
              <span className="font-semibold text-foreground">
                {stats.nextTripPrediction.avgDays}-day
              </span>{" "}
              gap, expect another trip around{" "}
              <span className="font-semibold text-foreground">
                {stats.nextTripPrediction.dateLabel}
              </span>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function computeTripStats(trips: Trip[], costPerKm: number | null) {
  if (trips.length === 0) return null;
  const valid = trips.filter(
    (t) =>
      t.start_odo_km != null &&
      t.end_odo_km != null &&
      Number(t.end_odo_km) > Number(t.start_odo_km),
  );

  const totalKm = valid.reduce(
    (s, t) => s + (Number(t.end_odo_km) - Number(t.start_odo_km)),
    0,
  );

  const costs = valid
    .map((t) => {
      const dist = Number(t.end_odo_km) - Number(t.start_odo_km);
      const fuel = costPerKm != null ? dist * costPerKm : 0;
      return fuel + (Number(t.tolls_inr) || 0);
    })
    .filter((c) => c > 0);
  const avgCost = costs.length > 0 ? costs.reduce((s, c) => s + c, 0) / costs.length : null;

  // Top purposes
  const byPurpose = new Map<string, { count: number; km: number }>();
  for (const t of valid) {
    const key = (t.purpose || "Other").trim() || "Other";
    const cur = byPurpose.get(key) ?? { count: 0, km: 0 };
    cur.count += 1;
    cur.km += Number(t.end_odo_km) - Number(t.start_odo_km);
    byPurpose.set(key, cur);
  }
  const topPurposes = [...byPurpose.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // Next trip prediction based on date gaps
  let nextTripPrediction: { avgDays: number; dateLabel: string } | null = null;
  if (trips.length >= 2) {
    const asc = [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date));
    const gaps: number[] = [];
    for (let i = 1; i < asc.length; i++) {
      gaps.push(daysBetween(asc[i - 1].trip_date, asc[i].trip_date));
    }
    const filtered = gaps.filter((g) => g > 0 && g < 90);
    if (filtered.length > 0) {
      const avg = Math.round(filtered.reduce((s, g) => s + g, 0) / filtered.length);
      const last = new Date(asc[asc.length - 1].trip_date);
      const next = new Date(last.getTime() + avg * 86400000);
      nextTripPrediction = {
        avgDays: avg,
        dateLabel: next.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        }),
      };
    }
  }

  return {
    totalKm,
    totalTrips: valid.length,
    avgCost,
    topPurposes,
    nextTripPrediction,
  };
}
