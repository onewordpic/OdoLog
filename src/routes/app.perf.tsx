import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Activity, Trash2, Download, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import {
  listPerfSamples,
  clearPerfSamples,
  type PerfRow,
} from "@/lib/perf.functions";
import { formatMs, percentile } from "@/lib/perf";

const PerfTrendChart = lazy(() =>
  import("@/components/perf-trend-chart").then((m) => ({ default: m.PerfTrendChart })),
);

export const Route = createFileRoute("/app/perf")({
  component: PerfPage,
  head: () => ({
    meta: [
      { title: "Performance profiler — OdoLog" },
      {
        name: "description",
        content:
          "Load-time profiling for OdoLog: TTFB, first paint, largest paint, hydration and the slowest network calls, tracked over time.",
      },
      { property: "og:title", content: "Performance profiler — OdoLog" },
      {
        property: "og:description",
        content: "Track OdoLog page-load performance and improvements over time.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const WINDOWS = [
  { id: "24", label: "24h", hours: 24 },
  { id: "168", label: "7d", hours: 168 },
  { id: "720", label: "30d", hours: 720 },
  { id: "all", label: "All", hours: 0 },
] as const;

type WindowId = (typeof WINDOWS)[number]["id"];

const PHASES = [
  { key: "ttfb_ms", label: "Server", color: "oklch(0.55 0.18 250)" },
  { key: "fcp_ms", label: "First paint", color: "oklch(0.65 0.18 30)" },
  { key: "hydration_ms", label: "Hydration", color: "oklch(0.6 0.15 150)" },
  { key: "route_load_ms", label: "Route data", color: "oklch(0.6 0.15 60)" },
] as const;

function PerfPage() {
  const qc = useQueryClient();
  const [win, setWin] = useState<WindowId>("168");
  const [route, setRoute] = useState("all");
  const [device, setDevice] = useState("all");
  const [open, setOpen] = useState<PerfRow | null>(null);

  const fetchSamples = useServerFn(listPerfSamples);
  const clearAll = useServerFn(clearPerfSamples);

  const hours = WINDOWS.find((w) => w.id === win)!.hours;

  const samples = useQuery({
    queryKey: ["perf-samples", win],
    queryFn: () => fetchSamples({ data: hours ? { sinceHours: hours } : {} }),
  });

  const clear = useMutation({
    mutationFn: () => clearAll({ data: undefined }),
    onSuccess: () => {
      toast.success("Performance history cleared");
      qc.invalidateQueries({ queryKey: ["perf-samples"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = samples.data ?? [];

  const routes = useMemo(
    () => Array.from(new Set(all.map((s) => s.route))).sort(),
    [all],
  );
  const devices = useMemo(
    () => Array.from(new Set(all.map((s) => s.device ?? "unknown"))).sort(),
    [all],
  );

  const rows = useMemo(
    () =>
      all.filter(
        (s) =>
          (route === "all" || s.route === route) &&
          (device === "all" || (s.device ?? "unknown") === device),
      ),
    [all, route, device],
  );

  // Split into current half vs previous half for the delta chips.
  const { current, previous } = useMemo(() => {
    const asc = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const mid = Math.floor(asc.length / 2);
    return { current: asc.slice(mid), previous: asc.slice(0, mid) };
  }, [rows]);

  const stat = (list: PerfRow[], key: keyof PerfRow, p: number) =>
    percentile(
      list.map((r) => Number(r[key])).filter((v) => Number.isFinite(v)),
      p,
    );

  const cards = (["lcp_ms", "fcp_ms", "ttfb_ms"] as const).map((key) => {
    const label = key === "lcp_ms" ? "LCP" : key === "fcp_ms" ? "FCP" : "TTFB";
    const med = stat(current, key, 50);
    const p75 = stat(current, key, 75);
    const prev = stat(previous, key, 50);
    const delta = med != null && prev != null ? med - prev : null;
    return { label, med, p75, delta };
  });

  const worstCalls = useMemo(() => {
    const map = new Map<string, { total: number; n: number; kind: string }>();
    for (const r of rows) {
      for (const c of r.slow_resources ?? []) {
        const cur = map.get(c.name) ?? { total: 0, n: 0, kind: c.kind };
        cur.total += c.duration_ms;
        cur.n += 1;
        map.set(c.name, cur);
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, kind: v.kind, avg: v.total / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  }, [rows]);

  const recent = useMemo(() => rows.slice(0, 24), [rows]);
  const maxTotal = Math.max(
    1,
    ...recent.map((r) =>
      PHASES.reduce((s, p) => s + (Number(r[p.key]) || 0), 0),
    ),
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "odolog-perf-samples.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/settings"
          className="press glass-subtle inline-flex h-9 w-9 items-center justify-center rounded-full"
          aria-label="Back to settings"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ["perf-samples"] })}
            className="press glass-subtle inline-flex h-9 w-9 items-center justify-center rounded-full"
            aria-label="Refresh"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="press glass-subtle inline-flex h-9 w-9 items-center justify-center rounded-full"
            aria-label="Export samples as JSON"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete all recorded performance samples?")) clear.mutate();
            }}
            className="press glass-subtle inline-flex h-9 w-9 items-center justify-center rounded-full text-destructive"
            aria-label="Clear performance history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <header className="mt-4 flex items-start gap-3">
        <div className="glass-subtle flex h-10 w-10 items-center justify-center rounded-xl">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-medium tracking-tight">Performance profiler</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Real load timings from your own visits — {rows.length} sample
            {rows.length === 1 ? "" : "s"} in view.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="glass-subtle flex rounded-full p-1 text-[11px]">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWin(w.id)}
              className={`press rounded-full px-3 py-1 transition ${
                win === w.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <select
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          aria-label="Filter by route"
          className="glass-input rounded-full px-3 py-1.5 text-xs"
        >
          <option value="all">All routes</option>
          {routes.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={device}
          onChange={(e) => setDevice(e.target.value)}
          aria-label="Filter by device"
          className="glass-input rounded-full px-3 py-1.5 text-xs"
        >
          <option value="all">All devices</option>
          {devices.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {samples.isLoading && (
        <div className="glass mt-4 h-28 animate-pulse rounded-2xl" />
      )}

      {samples.isError && (
        <section className="glass mt-4 rounded-2xl p-6 text-sm text-muted-foreground">
          Sign in to view your performance history — samples are stored in your
          account.
        </section>
      )}

      {!samples.isLoading && !samples.isError && rows.length === 0 && (

        <section className="glass mt-4 rounded-2xl p-6 text-sm text-muted-foreground">
          No samples yet. Keep profiling enabled in Settings and reload the app a
          few times — each visit records one sample once the page settles.
        </section>
      )}

      {rows.length > 0 && (
        <>
          {/* Summary cards */}
          <section className="mt-4 grid grid-cols-3 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="glass rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {c.label} median
                </div>
                <div className="mt-1 text-xl font-light tracking-tight">
                  {formatMs(c.med)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  p75 {formatMs(c.p75)}
                </div>
                {c.delta != null && (
                  <div
                    className={`mt-1 text-[11px] ${
                      c.delta <= 0 ? "text-emerald-500" : "text-destructive"
                    }`}
                  >
                    {c.delta <= 0 ? "▼" : "▲"} {formatMs(Math.abs(c.delta))} vs
                    earlier
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Phase breakdown */}
          <section className="glass mt-4 rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Where the time goes
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {PHASES.map((p) => (
                  <span key={p.key} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: p.color }}
                    />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {recent.map((r) => {
                const total = PHASES.reduce(
                  (s, p) => s + (Number(r[p.key]) || 0),
                  0,
                );
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setOpen(r)}
                    className="press flex w-full items-center gap-2 text-left"
                  >
                    <span className="w-24 shrink-0 truncate text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex h-4 flex-1 overflow-hidden rounded-full bg-foreground/5">
                      {PHASES.map((p) => {
                        const v = Number(r[p.key]) || 0;
                        if (!v) return null;
                        return (
                          <span
                            key={p.key}
                            style={{
                              width: `${(v / maxTotal) * 100}%`,
                              background: p.color,
                            }}
                          />
                        );
                      })}
                    </span>
                    <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                      {formatMs(total)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Trend */}
          <Suspense
            fallback={<div className="glass mt-4 h-56 animate-pulse rounded-2xl" />}
          >
            <PerfTrendChart rows={rows} />
          </Suspense>

          {/* Slowest calls */}
          {worstCalls.length > 0 && (
            <section className="glass mt-4 rounded-2xl p-4">
              <div className="mb-3 px-1 text-xs uppercase tracking-wider text-muted-foreground">
                Slowest calls (average)
              </div>
              <div className="space-y-1.5">
                {worstCalls.map((c) => (
                  <div
                    key={c.name}
                    className="glass-subtle flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.kind} · seen in {c.n} load{c.n === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs tabular-nums">
                      {formatMs(c.avg)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Drill-down */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(null)}
        >
          <div
            className="glass w-full max-w-md rounded-3xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium">{open.route}</div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(open.created_at).toLocaleString("en-IN")} ·{" "}
              {open.device ?? "unknown"} · {open.connection ?? "—"} ·{" "}
              {open.app_version ?? "—"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {[
                ["TTFB", open.ttfb_ms],
                ["FCP", open.fcp_ms],
                ["LCP", open.lcp_ms],
                ["Hydration", open.hydration_ms],
                ["Route data", open.route_load_ms],
                ["Total load", open.total_ms],
              ].map(([label, v]) => (
                <div
                  key={String(label)}
                  className="glass-subtle rounded-xl px-3 py-2"
                >
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="tabular-nums">{formatMs(v as number | null)}</div>
                </div>
              ))}
            </div>
            {(open.slow_resources ?? []).length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Slowest calls this load
                </div>
                {open.slow_resources.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="min-w-0 truncate">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatMs(c.duration_ms)}
                      {c.size_kb != null ? ` · ${c.size_kb} KB` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="press mt-4 w-full rounded-full bg-foreground px-4 py-2 text-sm text-background"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
