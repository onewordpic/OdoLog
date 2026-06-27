import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Droplet,
  Gauge,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { listVehicles, listRecentRefuels, type Vehicle } from "@/lib/data-store";
import { useAuthed } from "@/lib/use-authed";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

type View = "monthly" | "yearly";

function ReportsPage() {
  const authed = useAuthed();
  const [view, setView] = useState<View>("monthly");
  const [cursor, setCursor] = useState(() => new Date());

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

  const year = cursor.getFullYear();
  const month = cursor.getMonth(); // 0-based

  const { periods, chartData } = useMemo(() => {
    if (!refuels.data) return { periods: [] as Period[], chartData: [] as ChartRow[] };

    const byKey: Record<string, Period> = {};

    for (const r of refuels.data) {
      const d = new Date(r.refuel_date + "T00:00:00");
      let key: string;
      let label: string;
      if (view === "monthly") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      } else {
        key = `${d.getFullYear()}`;
        label = key;
      }
      if (!byKey[key]) {
        byKey[key] = {
          key,
          label,
          spend: 0,
          litres: 0,
          count: 0,
          odoReadings: [] as number[],
        };
      }
      const p = byKey[key];
      p.spend += Number(r.amount_inr);
      p.litres += Number(r.litres);
      p.count += 1;
      if (r.odo_km != null) p.odoReadings.push(Number(r.odo_km));
    }

    const periods = Object.values(byKey).sort((a, b) => a.key.localeCompare(b.key)).reverse();

    // Chart only for monthly view (last 12 months)
    const chartData: ChartRow[] = [];
    if (view === "monthly") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(year, month - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const p = byKey[key];
        chartData.push({
          label: d.toLocaleDateString("en-IN", { month: "short" }) + (d.getMonth() === 0 ? ` '${String(d.getFullYear()).slice(-2)}` : ""),
          spend: p?.spend ?? 0,
        });
      }
    }

    return { periods, chartData };
  }, [refuels.data, view, year, month]);

  const filteredPeriods = useMemo(() => {
    if (view === "yearly") return periods;
    const target = `${year}-${String(month + 1).padStart(2, "0")}`;
    return periods.filter((p) => p.key === target);
  }, [periods, view, year, month]);

  const vehicleMap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    for (const v of vehicles.data ?? []) m.set(v.id, v);
    return m;
  }, [vehicles.data]);

  const hasData = refuels.data && refuels.data.length > 0;

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
            <h1 className="text-2xl font-light tracking-tight">Reports</h1>
            <p className="text-xs text-muted-foreground">
              Monthly and yearly fuel summaries.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* View toggle */}
      <div className="mb-4 flex items-center gap-2 animate-fade-in-up">
        <div className="glass-subtle flex rounded-full p-1 text-[11px]">
          {(["monthly", "yearly"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`press rounded-full px-3 py-1 transition ${
                view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
        {view === "monthly" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="press rounded-full p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium tabular-nums min-w-[8rem] text-center">
              {cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="press rounded-full p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {refuels.isLoading || vehicles.isLoading ? (
        <div className="glass flex h-24 items-center justify-center rounded-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !hasData ? (
        <div className="glass rounded-2xl px-6 py-12 text-center text-sm text-muted-foreground">
          No refuels logged yet. Start logging to see reports.
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in-up">
          {/* Chart for monthly */}
          {view === "monthly" && chartData.length > 0 && (
            <section className="glass rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                12-month spend trend
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.02 250 / 0.2)" />
                    <XAxis dataKey="label" stroke="oklch(0.5 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="oklch(0.5 0.02 250)" fontSize={11} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number) => [`₹${v.toFixed(0)}`, "Spend"]}
                    />
                    <Bar dataKey="spend" radius={[8, 8, 0, 0]} fill="oklch(0.6 0.15 150)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Period cards */}
          {filteredPeriods.length === 0 ? (
            <div className="glass rounded-2xl px-6 py-10 text-center text-sm text-muted-foreground">
              No refuels in this {view === "monthly" ? "month" : "year"}.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPeriods.map((p) => (
                <PeriodCard key={p.key} period={p} vehicleMap={vehicleMap} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

type Period = {
  key: string;
  label: string;
  spend: number;
  litres: number;
  count: number;
  odoReadings: number[];
};

type ChartRow = { label: string; spend: number };

function PeriodCard({ period, vehicleMap }: { period: Period; vehicleMap: Map<string, Vehicle> }) {
  const odoSorted = [...period.odoReadings].sort((a, b) => a - b);
  const minOdo = odoSorted[0] ?? null;
  const maxOdo = odoSorted[odoSorted.length - 1] ?? null;
  const km = minOdo != null && maxOdo != null ? maxOdo - minOdo : null;
  const kmpl = km != null && period.litres > 0 ? km / period.litres : null;
  const cpk = km != null && km > 0 ? period.spend / km : null;

  return (
    <div className="glass rounded-3xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{period.label}</h3>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          {period.count} refuel{period.count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={IndianRupee} label="Spend" value={`₹${Math.round(period.spend).toLocaleString("en-IN")}`} />
        <MiniStat icon={Droplet} label="Litres" value={`${period.litres.toFixed(1)} L`} />
        <MiniStat icon={Gauge} label="Distance" value={km != null ? `${km.toFixed(0)} km` : "—"} />
        <MiniStat
          icon={TrendingUp}
          label="Mileage"
          value={kmpl != null ? `${kmpl.toFixed(1)} km/l` : "—"}
          hint={cpk != null ? `₹${cpk.toFixed(2)}/km` : undefined}
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-subtle rounded-2xl p-3">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-medium tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
