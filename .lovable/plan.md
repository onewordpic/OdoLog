
## 1. Fix standalone PWA top safe-area (mobile installed app)

**Cause:** When launched from the home screen with `display: standalone` + `apple-mobile-web-app-status-bar-style: black-translucent`, iOS/Android draw the app under the status bar. Our headers currently start at `top: 0` with no `env(safe-area-inset-top)` padding, so the status bar overlaps the top buttons (Reports, Settings, theme toggle, etc.) and swallows taps.

Fixes:
- Add a global `.safe-top` utility in `src/styles.css` that applies `padding-top: env(safe-area-inset-top)` (and a `.pt-safe` variant for sticky headers).
- Apply it to the top header row on:
  - `src/routes/app.index.tsx`
  - `src/routes/app.garage.tsx`
  - `src/routes/app.vehicle.$id.tsx`
  - `src/routes/app.analytics.tsx`
  - `src/routes/app.reports.tsx`
  - `src/routes/app.settings.tsx`
  - `src/routes/app.insights.tsx`
- Confirm `viewport-fit=cover` is set in `__root.tsx` head (it already is).
- Verify the mobile action bar's bottom `env(safe-area-inset-bottom)` still works (already handled).
- Leave `black-translucent` status bar style so the mint gradient still bleeds under the status bar — only the interactive header row gets pushed down.

## 2. More accent colors and gradient options

Extend `src/lib/theming.ts`:
- **Accents** (add to existing mint/coral/violet/sky/amber): `rose`, `lime`, `teal`, `indigo`, `fuchsia`, `slate`. Each gets a `light` and `dark` hex.
- **Gradients** (add to aurora/paper/sunrise/ocean): `midnight` (indigo → slate), `peach` (rose → amber), `forest` (teal → lime), `candy` (fuchsia → sky), `mono` (stone tones).
- Register matching CSS variables in `src/styles.css` under the existing `[data-accent="…"]` and `[data-gradient="…"]` selectors so the new options actually paint.
- The Settings picker in `src/routes/app.settings.tsx` already maps over the arrays, so new entries appear automatically as swatches.

## 3. Docker

Short answer: not the natural fit for hosting, but yes for dev/CI.

- OdoLog builds for **Cloudflare Workers** (edge runtime) via TanStack Start's Vite plugin — production doesn't run in Node, so a "run the server in Docker" image is not equivalent to the deployed app and would need a Node adapter swap (out of scope for this pass).
- What we *can* ship without changing the runtime: a **Dockerfile for local dev / self-hosted static preview** — `oven/bun` base, install deps, `bun run build`, serve `.output/public` with a tiny static server. Useful for reproducible builds, CI, or hosting the static shell behind your own reverse proxy, but server functions (`createServerFn`, fuel-price scraper, GCal callback) won't run in that image.

I'll add this only if you want it. Two options:
- **A — Dev/build image only:** `Dockerfile` + `docker-compose.yml` that runs `bun dev` on port 8080 for local containerized development. Simple, no runtime tradeoffs.
- **B — Skip Docker for now:** keep deploying via Lovable / Cloudflare; revisit if you want a self-hosted Node build.

## Files touched

- `src/styles.css` — safe-area utility + new accent/gradient CSS vars
- `src/lib/theming.ts` — extended `ACCENTS` and `GRADIENTS` arrays
- All `src/routes/app.*.tsx` files listed above — add `safe-top` class to top header
- (Optional, pending your pick) `Dockerfile`, `.dockerignore`, `docker-compose.yml`

## Question before I build

For Docker: **A (dev/build container)** or **B (skip)**?
