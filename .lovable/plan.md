## Mobile bottom bar redesign + Garage page

### Problems
- Active Vehicle card and bottom action bar are both mint green — they blend together visually.
- Bottom bar has a "+" Add Vehicle button that isn't needed daily.
- No single place to scan all vehicles with a quick summary.

### Changes

**1. Bottom action bar (`src/components/mobile-action-bar.tsx`)**
- Three actions only: **Log fuel** (prominent), **Trip insight**, **Garage**.
- Drop the "+" Add Vehicle button (still reachable from Garage page and dashboard).
- Log fuel = full pill with mint fill + fuel icon + label. The other two = compact icon-only circular buttons (neutral glass, no mint fill) so the primary action stands alone.
- Add a handedness toggle: Log fuel pinned **left** or **right**; the two secondary icons sit on the opposite side. Order flips via flex-direction.
- Persist choice in `localStorage` key `odolog.handed` (`left` | `right`, default `right` so it stays where it is today).

**2. Visual separation from Active Vehicle card**
- Switch the bar's surface from mint-tinted glass to a neutral dark/light glass pill (uses existing `--background` + border tokens), so it reads as chrome, not content.
- Keep mint only inside the Log fuel pill itself.
- Add a stronger shadow + subtle outline ring so it floats above the green card.

**3. New Garage page (`src/routes/app.garage.tsx`)**
- Route: `/app/garage`.
- Lists every vehicle (owned + guest garage) as cards, each showing: icon/photo, name + make, fuel type chip, last odo, last refuel date, lifetime ₹ spent, ₹/km, mileage.
- Tap card → existing `/app/vehicle/$id`.
- "Add vehicle" button lives at top of this page (replacing the bottom-bar "+").

**4. Settings (`src/routes/app.settings.tsx`)**
- New "Bottom bar position" segmented control: Left / Right. Writes to the same `odolog.handed` key. Reads on mount.

### Files touched
- edit: `src/components/mobile-action-bar.tsx`, `src/routes/app.settings.tsx`, `src/routes/app.index.tsx` (pass/remove `onAddVehicle` since bar no longer needs it; keep for backward compat but unused), `src/lib/prefs.ts` (add `getHanded`/`setHanded`).
- add: `src/routes/app.garage.tsx`.

### Out of scope
- No DB changes. No changes to refuel/maintenance flows or desktop nav.
