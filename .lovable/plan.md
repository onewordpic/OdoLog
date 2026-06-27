## OdoLog v2.1 — three new pillars

Building on your picks: **Carbon footprint & eco score**, **Monthly AI summary**, and **Public garage profile**.

---

### 1. Carbon footprint & eco score

A per-vehicle and garage-wide CO₂ tracker that turns your refuel logs into a tangible "how green am I" number.

- New `EcoCard` on each vehicle page + a garage-total card on the dashboard.
- Computes kg CO₂ per refuel using standard emission factors (petrol 2.31 kg/L, diesel 2.68, CNG 2.75 kg/kg). EVs show grid-mix estimate based on city (India avg 0.71 kg/kWh) once we add kWh logging — for now EVs show "Zero tailpipe ✅".
- **Eco Score 0–100** per vehicle = blended mileage-vs-ARAI delta + monthly km trend + fuel type weighting. Letter grade A–E with a friendly one-liner ("Cleaner than 72% of similar bikes").
- **Trees-to-offset** widget: kg CO₂ ÷ 21 (avg tree absorption/yr) with a small leaf animation.
- Monthly + lifetime totals, sparkline of last 6 months.

### 2. Monthly AI summary

End-of-month digest powered by Lovable AI (`google/gemini-3-flash-preview`, free on Lovable Cloud).

- New route `/app/insights` with a month picker.
- Server function `generateMonthlySummary` pulls refuels, trips, maintenance, and eco data for the selected month and returns a structured JSON (highlights, spend breakdown, mileage trend, anomalies, 3 tips, next-month projection).
- Rendered as a magazine-style card stack: "This month at a glance", "Where your money went", "What changed vs last month", "OdoLog suggests".
- "Regenerate" + "Copy as text" + "Share to garage" buttons.
- Auto-triggered on the 1st of each month via `pg_cron` → `/api/public/hooks/monthly-digest` that pre-generates summaries so opening the tab is instant. Cached in a new `ai_summaries` table keyed by (user, vehicle_id|null, month).

### 3. Public garage profile

A shareable read-only page like `odolog.app/g/safwan` showing your garage as a clean portfolio.

- New `public_handle` column on `profiles` (unique, slug-validated, claimable in Settings).
- New `garage_visibility` per-vehicle ('private' | 'public') — defaults private.
- Public route `/g/$handle` (no auth) renders: avatar, display name, city, total km, total ₹ spent, eco score, vehicle cards (photo, name, year, lifetime mileage, eco grade). No refuel-level data, no PII (reg number / insurance / PUC hidden).
- SSR'd via a server publishable client (anon SELECT policy on a narrow view), so it gets proper OG tags + share image per garage.
- "Share my garage" button in dashboard → copies link + native share sheet.
- Settings toggle: claim handle, per-vehicle visibility switches, "remove from public garage" kill switch.

---

### Technical notes

- **DB migrations**
  - `ai_summaries(user_id, vehicle_id null, month date, payload jsonb, created_at)` — RLS user-scoped + `anon SELECT` denied.
  - `profiles.public_handle text unique`, `profiles.public_bio text`.
  - `vehicles.garage_visibility text default 'private'`.
  - Public read view `public.garage_public_v` exposing only safe columns; `GRANT SELECT ... TO anon` with handle-based filter via RLS on underlying tables (or SECURITY DEFINER function returning the row).
- **Server functions** (`src/lib/insights.functions.ts`)
  - `generateMonthlySummary({ month, vehicleId? })` — `requireSupabaseAuth`, calls Lovable AI Gateway with structured Output schema (Zod), persists to `ai_summaries`.
  - `claimHandle({ handle })` — uniqueness + slug regex.
- **Server route** `src/routes/api/public/hooks/monthly-digest.ts` — `apikey` header auth, pg_cron monthly on the 1st at 03:00 IST, iterates users with ≥1 refuel last month, generates & stores summaries.
- **Eco math** lives in `src/lib/eco.ts` (pure functions, fully tested by reuse).
- **Public garage page** `src/routes/g.$handle.tsx` — SSR via server publishable client; per-route `head()` sets `<title>{name}'s Garage · OdoLog</title>`, og:image = first vehicle photo or generated gradient.

### Out of scope (saved for later)

Receipt OCR, voice log, anomaly alerts, station map, document vault, resale helper, multi-driver, fuel budget. We can pick these up in v2.2.

### Suggested build order

1. Eco score (lowest risk, no new infra).
2. Public garage profile (DB + new public route).
3. Monthly AI summary (AI + cron, depends on eco numbers being available).

Approve and I'll start with the eco card.
