import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Droplet,
  IndianRupee,
  Leaf,
  Gauge,
} from "lucide-react";
import { generateMonthlySummary, type MonthlyDigest } from "@/lib/insights.functions";
import { listVehicles } from "@/lib/data-store";
import { useAuthed } from "@/lib/use-authed";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/app/insights")({
  component: InsightsPage,
});

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function InsightsPage() {
  const authed = useAuthed();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const month = monthKey(cursor);
  const label = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const vehicles = useQuery({
    queryKey: ["vehicles", authed],
    queryFn: listVehicles,
    enabled: authed !== null,
  });

  const generate = useServerFn(generateMonthlySummary);
  const summary = useQuery({
    queryKey: ["ai-summary", month, vehicleId, authed],
    queryFn: () => generate({ data: { month, vehicleId } }),
    enabled: !!authed,
    staleTime: 5 * 60 * 1000,
  });

  const regen = useMutation({
    mutationFn: () => generate({ data: { month, vehicleId, force: true } }),
    onSuccess: (d) => summary.refetch().then(() => d),
  });

  function shift(months: number) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + months);
    if (d > new Date()) return;
    setCursor(d);
  }

  if (authed === false) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">Sign in to use AI insights.</p>
        <Link to="/auth" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Sign in</Link>
      </div>
    );
  }

  const d = summary.data as MonthlyDigest | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 animate-fade-in">
      <header className="flex items-center justify-between">
        <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-5 w-5 text-primary" /> Monthly insights
        </h1>
      </div>

      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="rounded-full p-2 hover:bg-foreground/5"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium tabular-nums min-w-[10ch] text-center">{label}</div>
          <button
            onClick={() => shift(1)}
            aria-label="Next month"
            disabled={(() => {
              const n = new Date(cursor);
              n.setMonth(n.getMonth() + 1);
              return n > new Date();
            })()}
            className="rounded-full p-2 hover:bg-foreground/5 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <select
          className="rounded-full glass-input px-3 py-1.5 text-xs"
          value={vehicleId ?? ""}
          onChange={(e) => setVehicleId(e.target.value || null)}
        >
          <option value="">All vehicles</option>
          {(vehicles.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => regen.mutate()}
          disabled={regen.isPending || summary.isLoading}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium glass-subtle hover:bg-foreground/5 disabled:opacity-50"
        >
          {regen.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
          Regenerate
        </button>
      </div>

      {summary.isLoading || regen.isPending ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Crunching {label}…
        </div>
      ) : !d ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No data yet.
        </div>
      ) : (
        <>
          <section className="glass rounded-2xl p-5 sm:p-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <p className="mt-2 text-lg font-semibold leading-snug">{d.headline}</p>
            <p className="mt-2 text-xs text-muted-foreground">{d.vs_last_month}</p>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={IndianRupee} label="Spent" value={`₹${d.totals.spend_inr.toLocaleString("en-IN")}`} />
            <Stat icon={Droplet} label="Fuel" value={`${d.totals.litres} L`} />
            <Stat icon={Gauge} label="Distance" value={d.totals.distance_km != null ? `${d.totals.distance_km} km` : "—"} />
            <Stat icon={Leaf} label="CO₂" value={`${d.totals.co2_kg} kg`} />
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold">Highlights</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {d.highlights.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {h}
                </li>
              ))}
            </ul>
          </section>

          {d.spend_breakdown.length > 0 && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-sm font-semibold">Where your money went</h2>
              <div className="mt-3 space-y-2">
                {(() => {
                  const total = d.spend_breakdown.reduce((s, b) => s + b.amount_inr, 0) || 1;
                  return d.spend_breakdown.map((b, i) => (
                    <div key={i}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span>{b.label}</span>
                        <span className="tabular-nums">₹{b.amount_inr.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(b.amount_inr / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>
          )}

          <section className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold">OdoLog suggests</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {d.tips.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {t}
                </li>
              ))}
            </ul>
          </section>

          {d.projection_next_month && (
            <section className="glass-subtle rounded-2xl p-4 text-xs text-muted-foreground">
              Next month projection · ~₹{d.projection_next_month.spend_inr.toLocaleString("en-IN")} / {d.projection_next_month.litres} L at current pace
            </section>
          )}

          <div className="pt-2 text-center text-[10px] text-muted-foreground">
            Generated {new Date(d.generated_at).toLocaleString("en-IN")} · AI-assisted
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
