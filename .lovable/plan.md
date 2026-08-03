## Goal

Two things: (1) strip dead and duplicated code so the app builds lean in Docker, (2) show a "next fuel-up" odometer suggestion and remaining range from the current tank.

## 1. Remove unused code

Verified by search across `src/` (excluding `src/components/ui`):

- **45 of 46 shadcn UI files are imported nowhere.** Only `ui/sonner` is used. Delete the rest (accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, switch, table, tabs, textarea, toggle, toggle-group, tooltip).
- **Orphan route `src/routes/app.insights.tsx`** — nothing links to `/app/insights`, and it is a near-duplicate of `src/components/ai-insights-panel.tsx` which is already rendered inside the Analytics tab. Delete the route, keep the panel.
- **Unused dependencies** (no import anywhere once the UI files go): all 27 `@radix-ui/*` packages, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `embla-carousel-react`, `vaul`, `cmdk`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `class-variance-authority`, `@fontsource/syne`, `@fontsource/plus-jakarta-sans` (only if the CSS doesn't reference them — will re-check `src/styles.css` before removing these two). Kept: react, tanstack, supabase, recharts, zod, lucide-react, sonner, clsx, tailwind-merge, tailwindcss.
- **Duplicated helpers**: several files re-implement INR/number/date formatting inline. Consolidate into `src/lib/format.ts` (`formatINR`, `formatKm`, `formatDate`) and reuse in vehicle, garage, reports, analytics, index.

I will not touch feature behaviour — only delete things nothing references, then typecheck and build to confirm.

## 2. Docker

Current `Dockerfile` is dev-only. Add a production stage: install → `bun run build` → serve the built output, so `docker compose up` can run either dev or the built app. Keep the existing dev target working.

## 3. Next fuel-up + range estimate

`NextRefuelEstimate` in `src/components/vehicle-insights.tsx` today only projects from *average* litres per refuel. Rework it to model the current tank:

- **Range left now** = (litres of the most recent fill) × (vehicle km/L from segment history, or ARAI figure if no history) − (km driven since that fill, if a newer ODO reading exists).
- **Suggested next fuel-up ODO** = last fill ODO + range, minus a 10% reserve buffer, rounded down to the nearest 10 km.
- Copy reads e.g. "Refuel around **41,250 km** — roughly **310 km** left on this tank (~4.2 L at 14.8 km/l)".
- Falls back gracefully: no mileage history → use claimed mileage and label it "estimated"; no data at all → card hidden as today.
- Surface it on the vehicle page (where it already lives) and as a one-line chip on each garage card, so it's visible without opening a vehicle.
- Hidden for EVs.

## Technical notes

- Deletions verified by `rg` for each module path; after removal I run a typecheck and a production build before finishing.
- Dependency removal via `bun remove`, lockfile regenerated so the Docker build stays reproducible.
- Range math lives in one exported helper (`src/lib/range.ts`) consumed by both the vehicle page and garage card — no duplicated calculation.
