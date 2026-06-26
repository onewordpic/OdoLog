import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  RefreshCcw,
  TrendingUp,
  IndianRupee,

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
          <RunningCosts vehicles={vehicles.data} refuels={refuels.data} />
          <CityPriceTrends refuels={refuels.data} />
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

// ---------- Petrol vs diesel (single city) + price history ----------

type RefuelRow = Awaited<ReturnType<typeof listRecentRefuels>>[number];

function CityPriceTrends({ refuels }: { refuels: RefuelRow[] }) {
  const fetchPrice = useServerFn(fetchFuelPrice);
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [city, setCity] = useState<string>("Thiruvananthapuram");
  const [nonce, setNonce] = useState(0);

  // Default to profile city once loaded.
  useEffect(() => {
    const pc = (profile.data?.default_city ?? "").trim();
    if (!pc) return;
    const match = POPULAR_CITIES.find((c) => c.toLowerCase() === pc.toLowerCase());
    setCity(match ?? toTitleCase(pc));
  }, [profile.data?.default_city]);

  const queries = useQueries({
    queries: (["petrol", "diesel"] as const).map((fuelType) => ({
      queryKey: ["city-price", city, fuelType, nonce],
      queryFn: () => fetchPrice({ data: { city, fuelType } }),
      staleTime: 1000 * 60 * 10,
      enabled: !!city,
    })),
  });

  const [petrolQ, dieselQ] = queries;
  const petrol = petrolQ.data?.ok ? Number(petrolQ.data.price) : null;
  const diesel = dieselQ.data?.ok ? Number(dieselQ.data.price) : null;
  const loading = queries.some((q) => q.isLoading);

  const compareData = [
    { fuel: "Petrol", price: petrol ?? 0, color: "oklch(0.72 0.17 38)" },
    { fuel: "Diesel", price: diesel ?? 0, color: "oklch(0.55 0.18 250)" },
  ].filter((d) => d.price > 0);

  // ---- 12-month history derived from user's own logged refuels ----
  const history = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-IN", { month: "short" }) +
          (d.getMonth() === 0 ? ` '${String(d.getFullYear()).slice(-2)}` : ""),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    const bucket: Record<string, { p: number[]; d: number[] }> = {};
    for (const m of months) bucket[m.key] = { p: [], d: [] };
    for (const r of refuels) {
      const dt = new Date(r.refuel_date + "T00:00:00");
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (!bucket[k]) continue;
      const rate = Number(r.rate_per_litre);
      if (!isFinite(rate) || rate <= 0) continue;
      // We don't track fuel type per refuel row; bucket by vehicle fuel
      // type via the vehicle map carried on the row if available.
      const ft = (r as any).fuel_type ?? null;
      if (ft === "diesel") bucket[k].d.push(rate);
      else if (ft === "petrol") bucket[k].p.push(rate);
      else {
        // Unknown — count as petrol (most common) so the line isn't empty.
        bucket[k].p.push(rate);
      }
    }
    return months.map((m) => {
      const b = bucket[m.key];
      const avg = (arr: number[]) =>
        arr.length > 0 ? arr.reduce((s, n) => s + n, 0) / arr.length : null;
      return {
        month: m.label,
        petrol: avg(b.p),
        diesel: avg(b.d),
      };
    });
  }, [refuels]);

  const hasHistory = history.some((h) => h.petrol != null || h.diesel != null);

  return (
    <section className="glass animate-fade-in-up rounded-3xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-medium">Petrol vs diesel</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Today's pump rate in your city and how it has moved over the last year (your logs).
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-full glass-input px-3 py-1.5 text-xs"
        >
          {POPULAR_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {petrol != null && (
          <span className="rounded-full bg-[oklch(0.72_0.17_38_/_0.15)] px-2.5 py-1 text-[11px] font-semibold text-[oklch(0.55_0.18_38)]">
            Petrol ₹{petrol.toFixed(2)}/L
          </span>
        )}
        {diesel != null && (
          <span className="rounded-full bg-[oklch(0.55_0.18_250_/_0.15)] px-2.5 py-1 text-[11px] font-semibold text-[oklch(0.5_0.18_250)]">
            Diesel ₹{diesel.toFixed(2)}/L
          </span>
        )}
        {petrol != null && diesel != null && (
          <span className="text-[11px] text-muted-foreground">
            · Gap ₹{Math.abs(petrol - diesel).toFixed(2)}/L
          </span>
        )}
      </div>

      {loading && compareData.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : compareData.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No rates available for {city}. Try another city.
        </p>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.02 250 / 0.2)" />
              <XAxis dataKey="fuel" stroke="oklch(0.5 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.5 0.02 250)" fontSize={11} tickLine={false} axisLine={false} width={48}
                domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => [`₹${v.toFixed(2)} /L`, "rate"]} />
              <Bar dataKey="price" radius={[8, 8, 0, 0]} fill="oklch(0.6 0.15 30)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ---- 12-month price history (user logs) ---- */}
      <div className="mt-6 border-t border-foreground/10 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          12-month price history
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Monthly avg ₹/L from your logged refuels.
        </p>
        {hasHistory ? (
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.02 250 / 0.2)" />
                <XAxis dataKey="month" stroke="oklch(0.5 0.02 250)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.5 0.02 250)" fontSize={11} tickLine={false} axisLine={false} width={40}
                  domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any) => (v == null ? ["—", ""] : [`₹${Number(v).toFixed(2)}`, ""])} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="petrol" name="Petrol ₹/L" stroke="oklch(0.65 0.17 38)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="diesel" name="Diesel ₹/L" stroke="oklch(0.55 0.18 250)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 rounded-xl glass-subtle px-3 py-4 text-center text-xs text-muted-foreground">
            Log a few refuels and the historical trend will appear here automatically.
          </p>
        )}
      </div>

      {queries.some((q) => q.data && !q.data.ok) && (
        <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          {queries.map((q, i) =>
            q.data && !q.data.ok ? (
              <div key={i}>· {i === 0 ? "petrol" : "diesel"}: {q.data.error}</div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

function toTitleCase(s: string) {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}


function shortDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ---------- Running costs per vehicle ----------

function RunningCosts({
  vehicles,
  refuels,
}: {
  vehicles: Vehicle[];
  refuels: RefuelRow[];
}) {
  const rows = useMemo(() => {
    return vehicles
      .filter((v) => v.fuel_type !== "electric")
      .map((v) => {
        const rs = refuels.filter((r) => r.vehicle_id === v.id);
        const spend = rs.reduce(
          (s, r) => s + (r.amount_inr ? Number(r.amount_inr) : 0),
          0,
        );
        const litres = rs.reduce(
          (s, r) => s + (r.litres ? Number(r.litres) : 0),
          0,
        );
        const odos = rs
          .map((r) => (r.odo_km != null ? Number(r.odo_km) : null))
          .filter((n): n is number => n != null);
        const km = odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : 0;
        const cpk = km > 0 ? spend / km : null;
        return {
          id: v.id,
          name: v.name,
          fuel: v.fuel_type,
          fills: rs.length,
          spend,
          litres,
          km,
          cpk,
        };
      })
      .sort((a, b) => (b.cpk ?? -1) - (a.cpk ?? -1));
  }, [vehicles, refuels]);

  if (rows.length === 0) return null;

  return (
    <section className="glass rounded-3xl p-5 animate-fade-in-up">
      <div className="mb-4 flex items-center gap-2">
        <IndianRupee className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Running cost per vehicle
        </h2>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="glass-subtle flex items-center justify-between gap-3 rounded-2xl p-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.name}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {r.fills} fill{r.fills === 1 ? "" : "s"} ·{" "}
                {r.km > 0 ? `${r.km.toFixed(0)} km` : "no odo span"} · ₹
                {r.spend.toFixed(0)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-xl font-semibold tabular-nums">
                {r.cpk != null ? `₹${r.cpk.toFixed(2)}` : "—"}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                per km
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Running cost = total fuel spend ÷ distance covered (max − min odometer).
        Add odometer readings on refuels to make this accurate.
      </p>
    </section>
  );
}
