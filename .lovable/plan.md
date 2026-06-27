# Plan: Add CHANGELOG.md for OdoLog v2

Create a single `CHANGELOG.md` at the project root documenting every change shipped since v1, following Keep-a-Changelog conventions.

## File

`CHANGELOG.md` (new, project root)

## Structure

```
# Changelog

## [2.0.0] — 2026-06-27

### Added
- Trip Logger with per-trip cost, distance, purpose, notes
- Trip Analytics (total distance, avg cost/trip, top purposes, next-trip prediction)
- Petrol subtypes in refuel form (Normal, E20, XP95, XP100)
- CSV import (Hammond, Fuelio, Drivvo, aCar) with column auto-detect + manual remap
- JSON import with multi-vehicle wizard, supports wrapped `{data:{...}}` backups with flat fuelLogs/maintenanceLogs/insurances/puccs
- Google Calendar OAuth + sync for maintenance / PUC / insurance reminders
- EV flow: scooters & bikes block on "electric" with savings popup; EV cars allowed with EV-only maintenance presets (no oil)
- Weather chip + contextual safety advisory (Open-Meteo) on home
- 15-year fitness-test reminder (13–15 yr vehicles)
- Insurance + PUC expiry tracking with ≤90/≤30/lapsed badges and countdown ring
- Depreciation card (reducing-balance, toggle in Settings)
- Vehicle Health Score, refuel estimates, achievement badges
- Reports route (`/app/reports`)
- CNG fuel option for cars
- Share button to spread the word
- Running cost per vehicle on Analytics tab
- Petrol-vs-Diesel single-city comparison + 12-month price history
- ARAI claimed mileage vs actual delta on vehicle page
- First-run onboarding (name + city, Kerala capital default)
- GitHub star nudge in Settings
- "Made with love in India by Safwan" credits + X/website links
- Delete-all-data with double confirmation
- Edit refuel logs; ODO validation (must be strictly greater than last)
- Liquid glass elements, accent + gradient theming in Settings
- PWA manifest + installable
- v2 label in Settings footer

### Changed
- Vehicle page order: Refuel log first, Maintenance below
- Full-tank toggle defaults OFF (ON only for CNG)
- Refuel history table overhaul (ODO segments, cost/km chips)
- Light mode rebuilt (warm stone/aurora); dark mode unchanged
- Garage list scrolls past 4 vehicles (cap removed)
- Mobile-first refinements across app
- Reverted brand-initial logos; car/bike/scooter icons restored
- Renamed app: Fuel Buddy → PitStop → OdoBay → **OdoLog**

### Fixed
- Cost/km & mileage now compute reliably via ODO segments with diagnostic alerts for missing data
- City alias handling (e.g. Thiruvananthapuram)
- SEO: single H1 on home; aria-labels on icon-only buttons
```

## Notes

- Pure documentation file; no code/route changes.
- Dates and version pulled from current Settings footer (`v2`) and today's date.
- If you'd like, I can also link this from Settings later — not included in this plan.
