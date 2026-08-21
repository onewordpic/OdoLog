# Reserve tank tracking + mobile UI cleanup

Two things: (1) proper support for carburettor bikes that have a main/reserve fuel tap, and (2) a calmer, more mobile-friendly layout that hides rarely-used controls behind menus.

## 1. Reserve / main tank support

**Vehicle setting**
- New optional toggle on bikes and scooters (petrol only): "Has reserve tap (carburettor)". Off by default, shown in Add vehicle and Edit vehicle under a small "Advanced" area so it never clutters the common flow.
- When on, an optional "Reserve capacity (litres)" field (e.g. 2.0 L for older Royal Enfield / Hero models) with a sensible default guess.

**Refuel logging**
- For vehicles with a reserve tap, the refuel sheet shows one extra elegant segmented control: **Tank state when refuelling** — `Main` / `Switched to reserve`, plus an optional "km ridden on reserve" number.
- Nothing changes for every other vehicle: no extra field, no extra taps.

**What it gives back**
- Reserve-to-refuel distance tracked per fill, so the app can say "you typically ride ~35 km after hitting reserve".
- The next-fuel-up estimate on the vehicle page gains a second marker: the odometer where you'll likely hit reserve, before the empty estimate.
- A gentle warning in history when a fill was logged on reserve but the odo suggests it was very late (running the carb dry).

## 2. Mobile-friendly polish

- **Vehicle page:** collapse the secondary blocks (anomalies, breakdown, insights, depreciation, maintenance filters) into tidy expandable sections; keep Refuel history and the key stats immediately visible. Header actions (edit vehicle, export, delete, calendar sync) move into a single "..." menu instead of a row of icons.
- **Home:** header keeps only greeting + theme; city, weather, share, install and settings shortcuts collapse into one overflow menu on small screens.
- **Analytics / Reports:** stack panels vertically on mobile with a segmented picker at the top instead of everything rendered at once, so the page loads lighter.
- **Settings:** group into collapsible sections (Display, Reminders, Data, Integrations, About) — one open at a time on mobile.
- Larger tap targets (min 44px), consistent spacing scale, and the bottom bar stays as-is.

## Technical notes

- Migration: add `has_reserve boolean default false` and `reserve_litres numeric` to `vehicles`; add `tank_state text` ('main' | 'reserve') and `reserve_km numeric` to `refuels`. Both nullable/defaulted so existing rows are unaffected; grants + RLS follow the existing table pattern.
- Mirror the same fields in the localStorage guest store and in the CSV/JSON importers (ignored if absent).
- Reserve stats computed in a small helper next to `src/lib/range.ts`, reused by the vehicle page and insights.
- Collapsible sections use a shared local `<Section>` component so behaviour and styling stay consistent; no new dependencies.
