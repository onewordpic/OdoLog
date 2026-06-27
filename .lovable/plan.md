## Why your import fails today

The current `JsonImportModal` only understands two shapes: `{ vehicles: [{ refuels: [...] }] }` or `{ refuels: [...] }`. Your backup is shaped like:

```text
{ version, timestamp, data: {
    vehicles: [ { id, make, model, year, licensePlate, fuelType, odometer, ... } ],
    fuelLogs: [ { vehicleId, date, odometer, fuelAmount, cost, filled, ... } ],
    maintenanceLogs: [...],
    insurances:     [ { vehicleId, expiryDate, ... } ],
    puccs:          [ { vehicleId, expiryDate, ... } ]
} }
```

So the importer:
1. Never unwraps `data`, so it treats the whole object as one anonymous vehicle.
2. Doesn't know `fuelAmount` = litres, `cost` = amount, `filled` = full_tank.
3. Doesn't group the flat `fuelLogs` by `vehicleId` back onto each vehicle.
4. Throws away `insurances` / `puccs` / `maintenanceLogs`.

## Fix

Edit only `src/components/json-import-modal.tsx` (no DB / no other UI changes).

### 1. Unwrap and detect shape

In `detectVehicles(raw)`:
- If `raw.data` is an object, use that as the root.
- If the root has both `vehicles[]` and `fuelLogs[]` (or `refuels[]` / `logs[]` / `fills[]`) as siblings, group the flat logs by `vehicleId` / `vehicle_id` / `vehicle` and attach them to the matching vehicle's `refuels` before mapping. Logs whose `vehicleId` matches nothing get attached to an "Unassigned" synthetic vehicle so the user can still rescue them.

### 2. Expand field synonyms

Extend the key arrays:
- `LTR_KEYS`: add `fuelAmount`, `fuel_amount`.
- `AMT_KEYS`: add `cost`, `total_cost`, `totalCost`.
- `FULL_KEYS`: add `filled`, `is_filled`.
- Vehicle level: read `licensePlate` → `reg_number`; `year` → `model_year`; `fuelType` → `fuel_type`; derive display `name` from `make + " " + model` when `name` is absent.
- Normalise `fuelType` values: lowercase, map `gas`/`gasoline` → `petrol`; unknown → `petrol`.

### 3. Carry over insurance / PUC expiry (best-effort)

After grouping, for each vehicle look up the latest entry in `insurances[]` and `puccs[]` matching `vehicleId` and stash `insurance_expiry` / `puc_expiry` (ISO date from `expiryDate`/`endDate`) on the detected vehicle. Pass these through to `addVehicle({...})` so renewal reminders work straight after import.

### 4. Optional maintenance import

If `maintenanceLogs[]` exists, group by `vehicleId`, normalise into `{ service_type, service_date, odo_km, cost_inr, notes }` (synonyms: `description`/`type` → service_type, `date` → service_date, `odometer` → odo_km, `cost` → cost_inr), and after the refuels loop call `addMaintenance({...vehicle_id})` for each. If `addMaintenance` isn't yet exported from `@/lib/data-store`, skip this step rather than block the import, and surface the count as "X maintenance logs skipped — not yet supported" in the toast.

### 5. UX touches in the confirm step

- Show a small badge per vehicle: `N refuels · M maintenance · insurance ✓ · PUC ✓`.
- If any logs landed in the "Unassigned" bucket, render that card first with an amber warning explaining the user can rename it or delete it before importing.
- Update the example JSON in the `<details>` block to also show the wrapped `{ data: { vehicles, fuelLogs } }` shape so the help matches reality.

### 6. Verify

After the edit, run a typecheck and a quick smoke: paste the uploaded sample, confirm both KTM Duke 390 and Honda Unicorn 160 appear with their fuel logs grouped, model year, registration, and (if present) insurance / PUC dates pre-filled.

## Not changing

- Database schema, server functions, CSV importer, vehicle page, settings layout. Purely a parser/UI upgrade inside the JSON modal.
