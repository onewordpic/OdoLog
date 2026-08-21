# Better reserve tracking + a calmer mobile refuel sheet

## 1. Does "tank when you pulled in" give accurate analysis?

On its own, only partly. Today a refuel stores one value: whether you were on main or reserve when you rolled into the pump. That misses two things that actually affect the numbers:

- **How far you rode on reserve** is typed in by hand ("km ridden on reserve"), which most people won't know or will guess.
- **What happened after the fill.** Your case today — pulled in on reserve, filled up, tap back to main — is the clean case. But sometimes you top up ₹200 and stay on the reserve tap, and that fill is a partial fill: using it as a full-tank mileage anchor quietly skews km/L.

Changes:

**Two states instead of one**
- "When you pulled in": Still on main / On reserve (as today).
- "After filling": Back on main / Still on reserve. Only shown when the vehicle has a reserve tap; defaults to "Back on main" when the fill is a full tank.

**Stop asking you to guess reserve km**
- Replace the free-text "km ridden on reserve" with an optional **odometer when you flipped to reserve**. Reserve distance is then computed exactly (fill odo − switch odo), and the field pre-fills with the last known odo so it's one small correction, not a recall exercise.
- If left blank, the fill still counts as a reserve fill; only the distance stat skips it.

**Use it in the maths**
- A fill logged as "still on reserve afterwards" auto-suggests unticking Full tank, so partial fills don't pollute mileage segments.
- Reserve stats on the vehicle page get an honest sample count ("typical ~35 km on reserve, from 6 fills") and hide the number entirely below 2 samples instead of showing a one-off as a pattern.
- The "you'll hit reserve around X km" marker uses the measured median reserve distance when available, falling back to the reserve-litres estimate.

## 2. Mobile refuel sheet

The main cause of the "zoomed in" feel is that every input in the sheet uses 14px text — iOS Safari force-zooms the page whenever you focus a field under 16px, and never fully zooms back. Fixes:

- All form inputs, selects and date fields in the app go to 16px on touch screens (visually still compact via tighter padding), so focusing a field no longer zooms the page.
- Sheet layout: tighter vertical rhythm, Amount and Rate on one row with the computed litres inline, Odometer + Date paired on one row — fewer full-width stacked blocks, less scrolling.
- Sticky footer for Cancel / Save inside the sheet so the save button is always reachable with the keyboard open, with safe-area padding.
- Reserve controls and Full tank collapse into the same compact pill row style as the rest of the sheet, and the reserve block only appears for reserve-tap vehicles.

## Technical notes

- Migration: add `tank_state_after text` and `reserve_switch_odo_km numeric` to `refuels` (nullable, existing rows unaffected); keep `reserve_km` and derive it on save. Grants/RLS follow the existing table pattern.
- Mirror both fields in the localStorage guest store and the CSV/JSON importers (ignored when absent).
- `src/lib/reserve.ts` gains the sample-count guard and prefers measured reserve distance; vehicle page and insights read from it.
- Input sizing handled once in `src/styles.css` (`glass-input` base font-size 16px with `md:` step-down) rather than per-field edits.
