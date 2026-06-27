import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listMaintenance, type Vehicle, type Refuel } from "@/lib/data-store";
import { HeartPulse, Fuel, TrendingUp } from "lucide-react";

// ---------- Vehicle Health Score ----------

export function VehicleHealthScore({
  vehicle,
  latestOdo,
}: {
  vehicle: Vehicle;
  latestOdo: number | null;
}) {
  const logs = useQuery({
    queryKey: ["maintenance", vehicle.id],
    queryFn: () => listMaintenance(vehicle.id),
  });

  const score = useMemo(() => {
    return computeHealthScore(vehicle, logs.data ?? [], latestOdo);
  }, [vehicle, logs.data, latestOdo]);

  const color = score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-4 animate-fade-in">
      <div className="relative shrink-0">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-foreground/10"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold tabular-nums">{score}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <HeartPulse className="h-4 w-4 text-primary" />
          Vehicle health
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {score >= 80
            ? "Looking good. Keep up with services."
            : score >= 50
              ? "A few things need attention."
              : "Several items are overdue. Check maintenance."}
        </p>
      </div>
    </div>
  );
}

function computeHealthScore(
  vehicle: Vehicle,
  logs: Awaited<ReturnType<typeof listMaintenance>>,
  latestOdo: number | null,
): number {
  let score = 100;
  const today = new Date().toISOString().slice(0, 10);

  const overdue = logs.filter((m) => {
    const dueByDate = m.next_service_date && m.next_service_date <= today;
    const dueByOdo =
      m.next_service_odo_km != null &&
      latestOdo != null &&
      latestOdo >= Number(m.next_service_odo_km);
    return dueByDate || dueByOdo;
  });
  score -= Math.min(overdue.length * 20, 40);

  if (vehicle.insurance_expiry) {
    const days = Math.ceil(
      (new Date(vehicle.insurance_expiry).getTime() - Date.now()) / 86400000,
    );
    if (days <= 0) score -= 15;
    else if (days <= 30) score -= 10;
  }

  if (vehicle.puc_expiry) {
    const days = Math.ceil(
      (new Date(vehicle.puc_expiry).getTime() - Date.now()) / 86400000,
    );
    if (days <= 0) score -= 15;
    else if (days <= 30) score -= 10;
  }

  if (vehicle.model_year) {
    const age = new Date().getFullYear() - vehicle.model_year;
    if (age >= 13 && age <= 15) score -= 10;
  }

  return Math.max(0, score);
}

// ---------- Next Refuel Estimate ----------

export function NextRefuelEstimate({
  refuels,
  summary,
}: {
  refuels: Refuel[];
  summary: {
    kmPerL: number | null;
    latestOdo: number | null;
    totalLitres: number;
    totalKm: number | null;
  };
}) {
  const estimate = useMemo(() => {
    if (
      summary.kmPerL == null ||
      summary.latestOdo == null ||
      refuels.length === 0
    )
      return null;

    // Average litres per refuel (only refuels with valid data)
    const valid = refuels.filter(
      (r) => Number(r.amount_inr) > 0 && Number(r.litres) > 0,
    );
    if (valid.length === 0) return null;
    const avgLitres =
      valid.reduce((s, r) => s + Number(r.litres), 0) / valid.length;
    const projectedKm = summary.kmPerL * avgLitres;
    const nextOdo = summary.latestOdo + projectedKm;
    return { nextOdo, projectedKm, avgLitres };
  }, [refuels, summary]);

  if (!estimate) return null;

  return (
    <div className="mt-3 glass rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Fuel className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">Next refuel estimate</div>
        <p className="text-xs text-muted-foreground">
          Around{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {estimate.nextOdo.toFixed(0)} km
          </span>{" "}
          · ~{estimate.projectedKm.toFixed(0)} km from now (based on{" "}
          {estimate.avgLitres.toFixed(1)} L avg)
        </p>
      </div>
    </div>
  );
}

// ---------- Cost Projection ----------

export function CostProjection({ refuels }: { refuels: Refuel[] }) {
  const projection = useMemo(() => {
    if (refuels.length < 2) return null;
    const asc = [...refuels].sort((a, b) =>
      a.refuel_date.localeCompare(b.refuel_date),
    );
    const first = new Date(asc[0].refuel_date);
    const last = new Date(asc[asc.length - 1].refuel_date);
    const months = Math.max(
      1,
      Math.ceil((last.getTime() - first.getTime()) / (30 * 86400000)),
    );
    const totalSpend = refuels.reduce(
      (s, r) => s + Number(r.amount_inr),
      0,
    );
    const avgMonthly = totalSpend / months;
    const yearly = avgMonthly * 12;
    return { avgMonthly, yearly, months };
  }, [refuels]);

  if (!projection) return null;

  const fmt = (n: number) =>
    `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="mt-3 glass rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <TrendingUp className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">Projected yearly spend</div>
        <p className="text-xs text-muted-foreground">
          Around{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {fmt(projection.yearly)}
          </span>{" "}
          · avg{" "}
          <span className="font-semibold tabular-nums">
            {fmt(projection.avgMonthly)}
          </span>{" "}
          / mo (over {projection.months} mo)
        </p>
      </div>
    </div>
  );
}
