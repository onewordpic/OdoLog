import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Metric = "kmpl" | "cpk" | "spend" | "litres";

const METRICS: { id: Metric; label: string; color: string; unit: string }[] = [
  { id: "kmpl", label: "Mileage", color: "oklch(0.55 0.18 250)", unit: "km/l" },
  { id: "cpk", label: "Cost / km", color: "oklch(0.65 0.18 30)", unit: "₹/km" },
  { id: "spend", label: "Spend", color: "oklch(0.6 0.15 150)", unit: "₹" },
  { id: "litres", label: "Litres", color: "oklch(0.6 0.15 60)", unit: "L" },
];

export interface TrendChartProps {
  chart: { date: string; kmpl: number; cpk: number }[];
  refuels: { refuel_date: string; amount_inr: number; litres: number }[];
}

export function TrendChart({ chart, refuels }: TrendChartProps) {
  const [metric, setMetric] = useState<Metric>("kmpl");

  const data = useMemo(() => {
    if (metric === "kmpl" || metric === "cpk") {
      return chart.map((s) => ({ date: s.date, value: s[metric] }));
    }
    const asc = [...refuels].sort((a, b) =>
      a.refuel_date.localeCompare(b.refuel_date),
    );
    return asc.map((r) => ({
      date: new Date(r.refuel_date + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      value: metric === "spend" ? Number(r.amount_inr) : Number(r.litres),
    }));
  }, [metric, chart, refuels]);

  if (data.length < 2) return null;
  const cfg = METRICS.find((m) => m.id === metric)!;

  return (
    <section className="glass mt-6 rounded-2xl p-4 animate-fade-in-up">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Trend
        </div>
        <div className="glass-subtle flex rounded-full p-1 text-[11px]">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
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
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.02 250 / 0.2)" />
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
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v: number) => [
                metric === "spend" || metric === "cpk"
                  ? `${cfg.unit === "₹" ? "₹" : ""}${v.toFixed(2)}${cfg.unit !== "₹" ? ` ${cfg.unit}` : ""}`
                  : `${v.toFixed(2)} ${cfg.unit}`,
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
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default TrendChart;
