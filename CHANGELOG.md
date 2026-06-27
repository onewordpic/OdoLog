# Changelog

All notable changes to OdoLog are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.0] — 2026-06-27

### Added
- **Trip Logger** — per-trip cost, distance, purpose, notes
- **Trip Analytics** — total distance, avg cost/trip, top purposes, next-trip prediction from past intervals
- **Petrol subtypes** in the refuel form (Normal, E20, XP95, XP100)
- **CSV import** (Hammond, Fuelio, Drivvo, aCar) with column auto-detect + manual remap + preview
- **JSON import** with multi-vehicle wizard — supports wrapped `{ data: { ... } }` backups with flat `fuelLogs` / `maintenanceLogs` / `insurances` / `puccs` linked by `vehicleId`
- **Google Calendar** OAuth + sync for maintenance / PUC / insurance reminders
- **EV flow** — scooters & bikes block on "electric" with savings popup; EV cars allowed with EV-only maintenance presets (brakes, tyres, battery; no oil)
- **Weather chip** + contextual safety advisory on home (Open-Meteo)
- **15-year fitness-test reminder** for vehicles aged 13–15 years
- **Insurance + PUC expiry tracking** with ≤90 / ≤30 / lapsed badges and countdown ring
- **Depreciation card** (reducing-balance: 15%/yr cars, 12%/yr bikes & scooters), toggleable in Settings
- **Vehicle Health Score**, refuel estimates, achievement badges
- **Reports** route at `/app/reports`
- **CNG** fuel option for cars
- **Share button** to spread the word
- **Running cost per vehicle** on Analytics tab
- **Petrol vs Diesel** comparison within a single city + 12-month price history
- **ARAI claimed mileage** vs actual delta on vehicle page
- **First-run onboarding** (name + city; Kerala capital default — Thiruvananthapuram)
- **GitHub star nudge** in Settings
- **"Made with love in India by Safwan"** credits with X + website links
- **Delete-all-data** with double confirmation
- **Edit refuel logs** + ODO validation (must be strictly greater than last reading)
- **Liquid glass** elements; accent + gradient theming in Settings
- **PWA** manifest — installable on mobile/desktop
- **v2** label in Settings footer

### Changed
- Vehicle page order: **Refuel log first**, Maintenance below
- **Full-tank toggle defaults OFF** (ON only for CNG)
- **Refuel history table** overhauled — ODO segments, cost/km chips
- **Light mode** rebuilt (warm stone/aurora); dark mode unchanged
- **Garage list** scrolls past 4 vehicles (cap removed)
- Mobile-first refinements across the app
- Reverted brand-initial logos; car / bike / scooter icons restored
- Renamed app: Fuel Buddy → PitStop → OdoBay → **OdoLog**

### Fixed
- **Cost/km & mileage** compute reliably via ODO segments, with diagnostic alerts for missing data
- City alias handling (e.g. Thiruvananthapuram)
- SEO: single H1 on home; aria-labels on icon-only buttons
```
