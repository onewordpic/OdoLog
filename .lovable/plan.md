## Goal

Make OdoLog feel snappier and more polished without changing features. Focus on initial load time (the dashboard is the entry point and currently pulls in charts, modals, and everything else eagerly) plus a small round of UI polish.

## 1. Load-time fixes (biggest wins)

**Problem:** `app.index.tsx` (1218 lines) is the mobile home screen but its bundle currently pulls in — directly or transitively — `recharts`, the CSV modal, JSON import wizard, Trip Planner, Google Calendar card, AI Insights panel, and every `lucide-react` icon used across sub-features. Recharts alone is ~150KB gzipped.

Actions:
- **Route-level code splitting**: rely on TanStack's automatic split, but stop exporting component functions from route files and stop referencing `Route.useLoaderData` in exported helpers (audit `app.index.tsx`, `app.vehicle.$id.tsx`, `app.analytics.tsx`, `app.reports.tsx`).
- **Lazy-load heavy modals** with `React.lazy` + `Suspense` on the home + vehicle pages:
  - `CSVImportModal`, `JSONImportModal`, `TripPlannerModal`, `AddVehicleModal` (only rendered when user clicks).
  - `AIInsightsPanel`, `TripAnalytics`, `AchievementBadges` inside Analytics tab.
- **Lazy-load recharts wrappers**: split each chart into its own file behind `React.lazy` so recharts is not in the analytics/vehicle critical chunk. Show a small skeleton (`h-40 rounded-2xl bg-foreground/5 animate-pulse`) as fallback.
- **Defer non-critical work on first paint**:
  - `WeatherChip` → fetch inside `useEffect` with `requestIdleCallback` fallback.
  - `InstallPrompt` → already delayed 4s, wrap the component in `React.lazy` too.
  - `initThemingFromStorage` → keep in `__root`, but move theme/accent CSS var writes into a tiny inline `<script>` in the root head to avoid FOUC.
- **Preload LCP**: add `head().links` preload for the hero avatar / mint gradient asset on the dashboard route.
- **Font strategy**: `@fontsource/plus-jakarta-sans` + `@fontsource/syne` ship every weight by default. Import only the weights actually used (e.g. 400/500/600/700) and add `font-display: swap` (fontsource does by default — confirm import paths use `/index.css` variants for the subset).
- **Icon tree-shaking check**: audit for `import * as Icons from "lucide-react"` (none expected, but confirm) and consolidate icons.
- **Query prefetching**: on the dashboard, keep the vehicle list query but mark it `staleTime: 60_000` to avoid refetch churn on tab switches.
- **Route `defaultPreloadStaleTime`** in `router.tsx` is currently `0` — bump to `10_000` and enable `defaultPreload: "intent"` so tapping a link on mobile primes the next route.

## 2. UI polish (small, targeted)

- **Hero card depth**: unify the Apple-style inner-highlight ring on both the "empty garage" and "active vehicle" hero variants so they match the bar's glass treatment.
- **Skeletons**: replace bare loading text ("Loading…") on Dashboard / Analytics / Reports with muted skeleton blocks (`rounded-2xl bg-foreground/5 animate-pulse`) matching final layout heights — no layout shift.
- **Tap targets**: audit icon-only buttons in headers to `min-h-11 min-w-11` for iOS HIG.
- **Sticky mobile bar padding**: ensure `padding-bottom: env(safe-area-inset-bottom)` on the scroll container so content isn't hidden behind the bar on iPhone.
- **Micro-transitions**: add `transition-[transform,opacity] duration-200 ease-out` on primary CTA press states; already have `.press`, standardize it.
- **Analytics/Reports tabs**: add a top segmented control instead of raw tab buttons so it visually matches the mobile bar's glass style.
- **Empty states**: single consistent empty-state component (icon + one line + one CTA) across Garage / Trips / Maintenance instead of the current three variants.

## 3. Files touched (implementation-side)

- `src/router.tsx` — `defaultPreload: "intent"`, `defaultPreloadStaleTime: 10000`.
- `src/routes/__root.tsx` — inline theme-init script, preload hero asset, lazy `InstallPrompt`.
- `src/routes/app.index.tsx` — lazy modals, skeletons, hero polish.
- `src/routes/app.analytics.tsx` — split charts into lazy chunks, lazy AI panel + Achievements.
- `src/routes/app.vehicle.$id.tsx` — lazy charts + edit/trip modals, skeleton loading.
- `src/routes/app.reports.tsx` — lazy chart chunk.
- `src/components/weather-chip.tsx` — defer fetch to idle.
- Any component still exported from a route file → convert to internal function.

## Non-goals

- No feature additions, no data-model changes, no route restructuring.
- No design-system overhaul; colors/tokens stay.

## Expected impact

Initial JS on the dashboard should drop by roughly the size of recharts + the four modal trees (~200–300KB gzipped combined), and first interaction on mobile should feel closer to native tab-bar snappiness. Actual numbers will be measured after the change with `vite build`'s bundle summary.
