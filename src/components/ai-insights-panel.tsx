import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Droplet,
  Gauge,
  IndianRupee,
  Leaf,
  Loader2,
  RefreshCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { generateMonthlySummary, type MonthlyDigest } from "@/lib/insights.functions";
import { useAuthed } from "@/lib/use-authed";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

interface Props {
  vehicleOptions: { id: string; name: string }[];
}

export function AiInsightsPanel({ vehicleOptions }: Props) {
  const authed = useAuthed();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const month = monthKey(cursor);
  const label = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const generate = useServerFn(generateMonthlySummary);
  const summary = useQuery({
    queryKey: ["ai-summary", month, vehicleId, authed],
    queryFn: () => generate({ data: { month, vehicleId } }),
    enabled: !!authed,
    staleTime: 5 * 60 * 1000,
  });

  const regen = useMutation({
    mutationFn: () => generate({ data: { month, vehicleId, force: true } }),
    onSuccess: () => summary.refetch(),
  });

  function shift(months: number) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + months);
    if (d > new Date()) return;
    setCursor(d);
  }

  if (!authed) {
    return (
      <section className="glass animate-fade-in-up rounded-3xl p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> AI insights
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Sign in to unlock AI-powered monthly digests.
        </p>
      </section>
    );
  }

  const d = summary.data as MonthlyDigest | undefined;
  const loading = summary.isLoading || regen.isPending;

  return (
    <section className="glass animate-fade-in-up rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">AI insights</h2>
        <button
          onClick={() => regen.mutate()}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium glass-subtle hover:bg-foreground/5 disabled:opacity-50"
        >
          {regen.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
          Regenerate
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="rounded-full p-1.5 hover:bg-foreground/5"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-xs font-medium tabular-nums min-w-[10ch] text-center">{label}</div>
        <button
          onClick={() => shift(1)}
          aria-label="Next month"
          disabled={(() => {
            const n = new Date(cursor);
            n.setMonth(n.getMonth() + 1);
            return n > new Date();
          })()}
          className="rounded-full p-1.5 hover:bg-foreground/5 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <select
          className="ml-auto rounded-full glass-input px-3 py-1 text-[11px]"
          value={vehicleId ?? ""}
          onChange={(e) => setVehicleId(e.target.value || null)}
          aria-label="Vehicle filter"
        >
          <option value="">All vehicles</option>
          {vehicleOptions.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Crunching {label}…
        </div>
      ) : !d ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No data yet for this month.</p>
      ) : (
        <>
          <div className="rounded-2xl bg-foreground/5 p-4">
            <p className="text-sm font-semibold leading-snug">{d.headline}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{d.vs_last_month}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat icon={IndianRupee} label="Spent" value={`₹${d.totals.spend_inr.toLocaleString("en-IN")}`} />
            <MiniStat icon={Droplet} label="Fuel" value={`${d.totals.litres} L`} />
            <MiniStat icon={Gauge} label="Distance" value={d.totals.distance_km != null ? `${d.totals.distance_km} km` : "—"} />
            <MiniStat icon={Leaf} label="CO₂" value={`${d.totals.co2_kg} kg`} />
          </div>
          {d.highlights.length > 0 && (
            <ul className="space-y-1.5 text-xs">
              {d.highlights.slice(0, 4).map((h, i) => (
                <li key={i} className="flex gap-1.5">
                  <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {h}
                </li>
              ))}
            </ul>
          )}
          {d.tips.length > 0 && (
            <ul className="space-y-1.5 text-xs">
              {d.tips.slice(0, 3).map((t, i) => (
                <li key={i} className="flex gap-1.5">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {t}
                </li>
              ))}
            </ul>
          )}
          <div className="text-[10px] text-muted-foreground">
            Generated {new Date(d.generated_at).toLocaleString("en-IN")} · AI-assisted
          </div>
        </>
      )}
    </section>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-foreground/5 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
