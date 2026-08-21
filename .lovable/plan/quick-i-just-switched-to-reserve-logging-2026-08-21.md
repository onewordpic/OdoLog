# Quick "I just switched to reserve" logging

Today the reserve-switch odometer can only be typed in later, at the pump, from memory. This adds an optional one-tap way to mark the moment you flip the tap mid-ride, so the reserve range is measured from a real reading.

## What you get

- On a vehicle that has a reserve tap, a small **"Switched to reserve"** action (vehicle page header menu, and inline next to the reserve card). Tapping it opens a tiny prompt with one field: current odometer, pre-filled with your last known odo + an estimate, plus Save.
- Once saved, the vehicle page shows a live **"On reserve since 41,208 km — 34 km so far"** strip, updating against your typical reserve range ("you usually get ~48 km").
- When you next open the refuel sheet, the switch-odo field is **already filled in** from that marker, and the tank state is pre-set to "on reserve". You can still edit or clear it.
- Saving the refuel consumes the marker. If you never refuel, the marker can be cleared manually from the same strip.
- Nothing changes for vehicles without a reserve tap.

## Accuracy notes

- The marker records odo + timestamp, so a reserve run is measured (fill odo − switch odo) instead of guessed.
- If a refuel is logged with a switch marker older than the fill's own date, the app keeps the marker but flags it lightly ("marker is 12 days old — check this reading").

## Technical notes

- Marker stored client-side per vehicle under `odolog.reserve_marker.<vehicleId>` (`{ odo, at }`) — no schema change, works for guests and signed-in users alike. The durable value still lands in the existing `refuels.reserve_switch_odo_km` column when the fill is saved.
- New helper `src/lib/reserve-marker.ts`: `getMarker`, `setMarker`, `clearMarker`, plus a `useReserveMarker(vehicleId)` hook reading in `useEffect` (no SSR access to localStorage).
- `RefuelSheet` in `src/routes/app.vehicle.$id.tsx` seeds `switchOdoInput` and `tankState` from the marker when opening a new (non-editing) refuel, and clears it on successful save.
- Reserve strip renders next to the existing `ReserveCard`; "km so far" uses the last known odo, so it only shows a distance once a newer odo exists.

Trade-off: because the marker is device-local, flipping the tap on your phone and logging the fill on another device won't carry it over. If you want it synced across devices, say so and it becomes a small column on `vehicles` instead.
