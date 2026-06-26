import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useServerFn } from "@tanstack/react-start";
import {
  listVehicles,
  listRecentRefuels,
  getProfile,
  type Vehicle,
} from "@/lib/data-store";
import { fetchFuelPrice } from "@/lib/fuel-price.functions";
import { useAuthed } from "@/lib/use-authed";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/app/analytics")({
  component: AnalyticsPage,
});

const POPULAR_CITIES = [
  "Thiruvananthapuram",
  "Kochi",
  "Kozhikode",
  "Delhi",
  "Mumbai",
  "Bangalore",
  "Chennai",
  "Kolkata",
  "Hyderabad",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Chandigarh",
];

type Metric = "rate" | "spend" | "litres" | "kmpl";
const METRIC_OPTS: { id: Metric; label: string; unit: string; color: string }[] = [
  { id: "rate", label: "Rate paid", unit: "₹/L", color: "oklch(0.65 0.18 30)" },
  { id: "spend", label: "Spend", unit: "₹", color: "oklch(0.6 0.15 150)" },
  { id: "litres", label: "Litres", unit: "L", color: "oklch(0.6 0.15 60)" },
  { id: "kmpl", label: "Mileage", unit: "km/L", color: "oklch(0.55 0.18 250)" },
];

function AnalyticsPage() {
  const authed = useAuthed();

  const vehicles = useQuery({
    queryKey: ["vehicles", authed],
    queryFn: listVehicles,
    enabled: authed !== null,
  });

  const refuels = useQuery({
    queryKey: ["analytics-refuels", authed],
    queryFn: () => listRecentRefuels(2000),
    enabled: authed !== null,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-center justify-between gap-3 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="glass press flex h-9 w-9 items-center justify-center rounded-full hover-lift"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-light tracking-tight">Analytics</h1>
            <p className="text-xs text-muted-foreground">
              Fuel & price trends across your garage and cities.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {(vehicles.isLoading || refuels.isLoading) && (
        <div className="glass flex h-24 items-center justify-center rounded-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {vehicles.data && refuels.data && (
        <div className="space-y-6">
          <VehicleTrends vehicles={vehicles.data} refuels={refuels.data} />
          <CityPriceTrends />
        </div>
      )}
    </main>
  );
}

// ---------- Vehicle trends ----------

function VehicleTrends({
  vehicles,
  refuels,
}: {
  vehicles: Vehicle[];
  refuels: Awaited<ReturnType<typeof listRecentRefuels>>;
}) {
  const [vehicleId, setVehicleId] = useState<string>(
    () => vehicles[0]?.id ?? "",
  );
  const [metric, setMetric] = useState<Metric>("rate");

  const data = useMemo(() => {
    if (!vehicleId) return [];
    const rs = refuels
      .filter((r) => r.vehicle_id === vehicleId)
      .sort((a, b) => a.refuel_date.localeCompare(b.refuel_date));

    if (metric !== "kmpl") {
      return rs.map((r) => ({
        date: shortDate(r.refuel_date),
        value:
          metric === "rate"
            ? Number(r.rate_per_litre)
            : metric === "spend"
              ? Number(r.amount_inr)
              : Number(r.litres),
      }));
    }

    // mileage between consecutive full-tank refuels with odo
    const full = rs.filter((r) => r.full_tank && r.odo_km != null);
    const out: { date: string; value: number }[] = [];
    for (let i = 1; i < full.length; i++) {
      const prev = full[i - 1];
      const cur = full[i];
      const km = Number(cur.odo_km) - Number(prev.odo_km);
      let litres = 0;
      for (const r of rs) {
        if (
          r.refuel_date > prev.refuel_date &&
          r.refuel_date <= cur.refuel_date
        ) {
          litres += Number(r.litres);
        }
      }
      if (km > 0 && litres > 0) {
        out.push({ date: shortDate(cur.refuel_date), value: km / litres });
      }
    }
    return out;
  }, [vehicleId, metric, refuels]);

  const cfg = METRIC_OPTS.find((m) => m.id === metric)!;
  const hasVehicles = vehicles.length > 0;

  return (
    <section className="glass animate-fade-in-up rounded-3xl p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Vehicle fuel trends</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track rate, spend, litres or mileage across refuels.
          </p>
        </div>
      </div>

      {!hasVehicles ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Add a vehicle to start seeing trends.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="rounded-full glass-input px-3 py-1.5 text-xs"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make ? `${v.make} ${v.name}` : v.name}
                </option>
              ))}
            </select>
            <div className="glass-subtle flex rounded-full p-1 text-[11px]">
              {METRIC_OPTS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  className={`press rounded-full px-3 py-1 transition ${
                    metric === m.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {data.length < 2 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Need at least 2 data points. Log a few more refuels.
            </p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.7 0.02 250 / 0.2)"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="oklch(0.5 0.02 250)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="oklch(0.5 0.02 250)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [
                      `${v.toFixed(2)} ${cfg.unit}`,
                      cfg.label,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={cfg.label}
                    stroke={cfg.color}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: cfg.color }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------- City price comparison ----------

function CityPriceTrends() {
  const fetchPrice = useServerFn(fetchFuelPrice);
  const [cities, setCities] = useState<string[]>([
    "Delhi",
    "Mumbai",
    "Bangalore",
    "Chennai",
  ]);
  const [fuelType, setFuelType] = useState<"petrol" | "diesel">("petrol");
  const [nonce, setNonce] = useState(0);

  function toggleCity(c: string) {
    setCities((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].slice(0, 8),
    );
  }

  const queries = useQueries({
    queries: cities.map((city) => ({
      queryKey: ["city-price", city, fuelType, nonce],
      queryFn: () => fetchPrice({ data: { city, fuelType } }),
      staleTime: 1000 * 60 * 10,
    })),
  });

  const loading = queries.some((q) => q.isLoading);
  const chartData = cities
    .map((city, i) => {
      const r = queries[i].data;
      return {
        city,
        price: r && r.ok ? Number(r.price) : null,
        error: r && !r.ok ? r.error : null,
      };
    })
    .filter((x) => x.price != null);

  return (
    <section className="glass animate-fade-in-up rounded-3xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-medium">City fuel prices</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live rates from goodreturns.in. Pick cities to compare.
            </p>
          </div>
        </div>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="press flex items-center gap-1 rounded-full glass-subtle px-3 py-1.5 text-[11px] font-medium hover:bg-foreground/5"
        >
          <RefreshCcw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="glass-subtle flex rounded-full p-1 text-[11px]">
          {(["petrol", "diesel"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFuelType(f)}
              className={`press rounded-full px-3 py-1 capitalize transition ${
                fuelType === f
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {POPULAR_CITIES.map((c) => {
          const active = cities.includes(c);
          return (
            <button
              key={c}
              onClick={() => toggleCity(c)}
              className={`press rounded-full px-2.5 py-1 text-[11px] transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "glass-subtle text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {loading && chartData.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : chartData.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          No rates available for the selected cities.
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.7 0.02 250 / 0.2)"
              />
              <XAxis
                dataKey="city"
                stroke="oklch(0.5 0.02 250)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                stroke="oklch(0.5 0.02 250)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`₹${v.toFixed(2)} /L`, fuelType]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="price"
                name={`${fuelType} ₹/L`}
                fill={fuelType === "petrol" ? "oklch(0.72 0.17 38)" : "oklch(0.55 0.18 250)"}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {queries.some((q) => q.data && !q.data.ok) && (
        <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          {queries.map((q, i) =>
            q.data && !q.data.ok ? (
              <div key={cities[i]}>
                · {cities[i]}: {q.data.error}
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

function shortDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
