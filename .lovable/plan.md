## Restore Eco, AI Insights, Reports + Liquid Glass toggle

### 1. Eco Card (CO₂ + grade)
- Reuse/restore `src/lib/eco.ts` (CO₂ math by fuel type + A–F grade).
- New `src/components/eco-card.tsx`:
  - Per-vehicle: total kg CO₂ (lifetime + last 30d), kg/km, eco grade chip.
  - Per-trip: kg CO₂ + grade chip rendered inside `TripSection` list rows.
- Mount the per-vehicle card on `src/routes/app.vehicle.$id.tsx` below the stats row.
- EV vehicles → show "Zero tailpipe" badge instead of CO₂ math.

### 2. AI Insights (moved into Analytics)
- Restore `src/lib/insights.functions.ts` flow (monthly digest via Lovable AI Gateway, cached in `ai_summaries` table — already exists).
- New `src/components/ai-insights-panel.tsx` with "Generate" button + cached summary render (markdown).
- Mount as a new section inside `src/routes/app.analytics.tsx` (above Achievement Badges). No standalone `/app/insights` route.

### 3. Reports tab (restore)
- New `src/routes/app.reports.tsx`:
  - Monthly spend table (last 12 months) per vehicle + combined.
  - Mileage trend, cost/km trend, top fuel brand, total distance, total CO₂.
  - CSV export button (client-side blob).
- Add "Reports" link to desktop top nav and mobile action bar overflow.

### 4. Settings → Glass UI toggles
- Extend `src/lib/theming.ts` with two booleans persisted to localStorage + applied as `<html>` data attributes:
  - `glassMode`: `off | standard | liquid` (replaces ad-hoc liquid class usage).
- In `src/styles.css`: gate `.glass` / `.liquid-glass` styles on `html[data-glass="standard"]` / `html[data-glass="liquid"]`; `off` falls back to solid surfaces using existing tokens.
- In `src/routes/app.settings.tsx`: add a "Surface style" segmented control (Off / Glass / Liquid Glass) under the existing appearance block.

### 5. Wiring
- No DB migrations needed (ai_summaries table already present from earlier sprint).
- Update analytics tab order: Trends → AI Insights → Achievements → City comparisons.
- Keep all changes additive; do not touch refuel/maintenance flows.

### Files touched
- add: `src/components/eco-card.tsx`, `src/components/ai-insights-panel.tsx`, `src/routes/app.reports.tsx`
- restore/edit: `src/lib/eco.ts`, `src/lib/insights.functions.ts`
- edit: `src/lib/theming.ts`, `src/styles.css`, `src/routes/app.settings.tsx`, `src/routes/app.analytics.tsx`, `src/routes/app.vehicle.$id.tsx`, `src/components/trip-section.tsx` (or equivalent), nav components
