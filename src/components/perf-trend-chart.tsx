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
import type { PerfRow } from "@/lib/perf.functions";

type Metric = "lcp_ms" | "fcp_ms" | "ttfb_ms" | "hydration_ms";

const METRICS: { id: Metric; label: string; color: string }[] = [
  { id: "lcp_ms", label: "LCP", color: "oklch(0.55 0.18 250)" },
  { id: "fcp_ms", label: "FCP", color: "oklch(0.65 0.18 30)" },
  { id: "ttfb_ms", label: "TTFB", color: "oklch(0.6 0.15 150)" },
  { id: "hydration_ms", label: "Hydration", color: "oklch(0.6 0.15 60)" },
];

export function PerfTrendChart({ rows }: { rows: PerfRow[] }) {
  const [metric, setMetric] = useState<Metric>("lcp_ms");

  const data = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r) => ({
        date: new Date(r.created_at).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
        }),
        value: Number(r[metric]) || 0,
      }))
      .filter((d) => d.value > 0);
  }, [rows, metric]);

  if (data.length < 2) return null;
  const cfg = METRICS.find((m) => m.id === metric)!;

  return (
    <section className="glass mt-4 rounded-2xl p-4">
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
              width={44}
              unit="ms"
            />
            <Tooltip
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v: number) => [`${Math.round(v)} ms`, cfg.label]}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={cfg.label}
              stroke={cfg.color}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: cfg.color }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default PerfTrendChart;
