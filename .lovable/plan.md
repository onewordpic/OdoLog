## Goal

The UI has grown crowded — too many top-bar icons, nudges, advisory cards, and bento tiles. Slim it down to the essentials and fully remove the Public Garage feature (page, settings card, vehicle visibility toggles, server functions, DB columns).

## 1. Remove Public Garage

- Delete files:
  - `src/routes/g.$handle.tsx` (public page)
  - `src/components/public-garage-card.tsx` (settings card)
- `src/routes/app.settings.tsx`: remove the `PublicGarageCard` import and its section.
- `src/lib/insights.functions.ts`: remove `fetchPublicGarage`, `setPublicHandle`, `setPublicBio`, `setVehicleVisibility`, and the `PublicGarage` type. Keep `generateMonthlySummary` (AI insights stays).
- `.lovable/plan.md`: drop the "Public garage profile" pillar so future passes don't re-suggest it.
- DB migration to drop public-garage surface:
  - `DROP FUNCTION IF EXISTS public.get_public_garage(text), public.get_public_garage_stats(text);`
  - `ALTER TABLE public.profiles DROP COLUMN IF EXISTS public_handle, DROP COLUMN IF EXISTS public_bio;`
  - `ALTER TABLE public.vehicles DROP COLUMN IF EXISTS garage_visibility;`
- Routes file `src/routeTree.gen.ts` is auto-regenerated — no manual edit.

## 2. Trim the dashboard (`src/routes/app.index.tsx`)

Top bar — collapse 7 buttons to 4:
- Keep: ThemeToggle, Analytics, Settings, Sign-in/out.
- Remove from header: ShareIconButton, Reports icon, AI-Insights icon. (Reports and Insights remain reachable from Analytics page / direct URLs; we can surface them as text links inside Analytics later if needed.)

Body cleanup:
- Remove `<WeatherAdvisory />` (keep the compact `<WeatherChip />` in the title row).
- Remove `<NameNudge />` (occasional name prompt). The greeting already falls back to "User".
- Drop the decorative bar-chart sparkline inside the "Litres" tile (purely cosmetic).
- Remove the standalone `<AchievementBadges />` block if rendered further down (verify in remainder of file; remove if present).

Spend hero stays, but the 4-pill range toggle (`All / Year / Month / 30d`) collapses to 2 pills: `All time` and `This month`. Simpler default, less visual noise.

## 3. Trim the vehicle page (`src/routes/app.vehicle.$id.tsx`)

- Remove the `EcoCard` import + render (eco grade tile is heavy and not part of core "fuel + odo" loop). Delete `src/components/eco-card.tsx` and `src/lib/eco.ts` since nothing else imports them.
- Keep insurance/PUC countdown, refuel log, maintenance, trips, insights — these are core.

## 4. Settings cleanup (`src/routes/app.settings.tsx`)

- Remove `PublicGarageCard` section (covered above).
- No other changes — settings is already opt-in dense.

## 5. Verify

After edits: `tsgo` typecheck should pass; visit `/`, `/app`, `/app/settings`, `/app/vehicle/:id`, `/app/analytics` and confirm no broken imports or empty sections.

## Technical notes

- Dropping `profiles.public_handle/public_bio` and `vehicles.garage_visibility` is destructive but the feature is brand new and unused in production data flows; acceptable.
- `insights.functions.ts` still exports `generateMonthlySummary` used by `/app/insights` — that page stays.
- No new dependencies.
