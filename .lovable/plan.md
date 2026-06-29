# Mobile-first redesign, fuel brand, and Trip Planner

Three focused changes, no scope creep.

## 1. Mobile UI overhaul (vehicle dashboard + home)

Goal: on phones, the primary action is **Log Fuel**, with key stats glanceable above the fold. "Add Vehicle" moves out of the top bar.

**Home (`src/routes/app.index.tsx`) — mobile (<768px) only, desktop unchanged:**
- Top bar: greeting + theme/settings only. Remove the prominent "Add vehicle" CTA from the top.
- Hero stat strip (compact): Total spent (toggle All/Month), Total litres, Avg ₹/km — single horizontal scroll row of glass chips.
- Vehicle picker becomes a **horizontal snap carousel** of vehicle cards (avatar + name + last odo). Tapping a card selects it as "active vehicle".
- **Sticky bottom action bar** (mobile only): big primary "⛽ Log Fuel" button (opens refuel modal pre-filled with active vehicle) + secondary "＋ Trip" and a small "＋ Vehicle" text link tucked into an overflow menu.
- Move "Add vehicle" into: (a) overflow menu in bottom bar, (b) empty-state CTA, (c) a "+" tile at the end of the vehicle carousel.

**Vehicle page (`src/routes/app.vehicle.$id.tsx`) — mobile:**
- Collapse header (smaller avatar, single-line title, badges wrap below).
- Stat tiles reflow to 2-col compact grid; secondary cards (depreciation, insights) collapse into expandable sections.
- Floating "⛽ Log Fuel" FAB bottom-right (hidden for EV).
- Refuel form opens as a **bottom sheet** (`vaul` Drawer already in deps) instead of inline expand.

Desktop layout untouched; gated via `useIsMobile()`.

## 2. Fuel provider selector

Add fuel brand choice per refuel: **Indian Oil, Bharat Petroleum, Hindustan Petroleum, Nayara, Reliance Jio-bp, Shell, Other**.

- DB: add nullable `fuel_brand text` column to `refuels` (migration).
- `data-store.ts`: include `fuel_brand` in Refuel type + add/edit paths + localStorage shape.
- Refuel form: brand chip selector below fuel type (remembers last used per vehicle via `localStorage`).
- History row: small brand chip next to the fuel subtype.
- Analytics: optional "spend by brand" mini-breakdown (single donut row, only if >1 brand used). Defer if it inflates scope — flag as v-next.
- No price differentiation by brand for now (rates API stays city-based); brand is metadata.

## 3. Trip Planner with estimates

New entry point: "Plan a trip" button on home (in the bottom bar overflow) and on the vehicle page.

**Flow (bottom-sheet modal, `src/components/trip-planner-modal.tsx`):**
1. Free-text input: "Describe your trip" (e.g. "Trivandrum to Munnar and back").
2. Parse with light regex: extract origin, destination, detect "and back"/"return"/"round trip" → roundTrip flag. If parse fails, show two manual fields.
3. Distance estimate: use **OSRM public routing API** (`router.project-osrm.org`) via a `createServerFn` (`src/lib/trip-estimate.functions.ts`) — geocode with **Nominatim** (OpenStreetMap), then route. Both are free, no key. Double the distance if round trip.
4. Vehicle picker: chip row of user's vehicles (skip EVs from fuel cost but show kWh estimate if we have it — otherwise just distance for EV).
5. Estimate card shows:
   - Distance (km)
   - Estimated fuel (L) = distance / mileage
   - Estimated cost (₹) = litres × latest city fuel rate for that fuel type
   - Mileage source label: **"Your logs (last 5 refuels avg)"** if ≥2 full-tank segments exist, else **"ARAI claimed"** from `vehicle-catalog.ts`, else **"Generic default"** (petrol 18, diesel 22, CNG 25 km/kg).
6. Persistent disclaimer chip: *"Estimates only — actual usage varies with traffic, AC, terrain & driving style."*
7. CTA: **"Save as planned trip"** → inserts into existing `trips` table with `start_odo_km`/`end_odo_km` null and `notes` = parsed description + estimated km (reuse existing schema, no migration).

**Files:**
- New: `src/components/trip-planner-modal.tsx`, `src/lib/trip-estimate.functions.ts`.
- Edit: `src/routes/app.index.tsx` (entry), `src/routes/app.vehicle.$id.tsx` (entry next to Trip section).

## Out of scope (not in this plan)
- Per-brand price tracking, loyalty points, brand-themed visuals.
- Multi-stop trips, live traffic, elevation-based mileage.
- Desktop layout changes (only mobile is redesigned).

## Technical notes
- All mobile changes guarded by `useIsMobile()` to preserve desktop.
- OSRM/Nominatim called server-side (`createServerFn`) so we set a proper User-Agent (Nominatim requires it) and avoid CORS.
- Cache geocode + route results in-memory per server instance keyed by normalized query (cheap LRU, ~50 entries).
- Migration is additive + nullable → no breaking change for existing refuels.
