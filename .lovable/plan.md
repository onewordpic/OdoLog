# Performance profiling dashboard

A hidden dev page at `/app/perf` that records how fast the app loads on real visits, stores the samples in your account, and charts them over time so you can see whether a change actually helped.

## What gets measured

Captured on every page load, after the page settles:

- **TTFB** — time until the server's first byte
- **FCP** — first pixel painted
- **LCP** — largest content painted (the perceived "it's loaded" moment)
- **Hydration** — React taking over the server HTML
- **Route load** — time for the route's own data/chunks to resolve
- **Slowest network calls** — top 5 resources/API calls of that load, with duration and size

Each sample also records route, device type, connection type, and app version, so a mobile 4G load isn't compared against desktop wifi.

## The dashboard

At `/app/perf`, reachable only from a "Performance profiling" toggle in Settings (off by default; when off nothing is recorded and the page is not linked).

- Header cards: median and 75th-percentile LCP, FCP, TTFB across the selected window, each with the delta vs the previous window (green when it improved).
- A stacked bar per load showing where the time went: server → first paint → hydration → route data. This is what answers "what causes the 5 seconds".
- A trend line of LCP/FCP over time, with filters for route, device, and time range (24h / 7d / 30d / all).
- A "slowest calls" table aggregated across samples: which endpoints or assets cost the most on average.
- Per-load drill-down: tap a bar to see that single load's full phase and network breakdown.
- Buttons to clear history and to export samples as JSON.

## Technical notes

- New table `public.perf_samples` (user_id, created_at, route, metrics as numeric columns, device/connection, app_version, `slow_resources` jsonb). RLS: owner-only select/insert/delete via `auth.uid()`; GRANTs for `authenticated` and `service_role`, no `anon`.
- Collection in a small `src/lib/perf.ts` using `PerformanceObserver` (LCP/FCP), the Navigation Timing entry (TTFB), and marks around hydration; buffered in `sessionStorage` and flushed on `visibilitychange` so it never blocks rendering. Guest/signed-out loads buffer locally and upload on next sign-in.
- Writes go through a `src/lib/perf.functions.ts` server function with `requireSupabaseAuth`; the dashboard reads via a component-level query (not a route loader) so prerender never 401s.
- Chart reuses the existing lazy `recharts` pattern, so the profiler never adds weight to normal loads.
- Toggle stored in the existing `src/lib/prefs.ts` as `perfProfiling`; the whole page and collector are lazy-loaded and inert when off.
