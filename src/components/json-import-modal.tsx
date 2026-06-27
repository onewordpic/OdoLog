import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Car,
  ArrowRight,
  ArrowLeft,
  Wrench,
  ShieldCheck,
} from "lucide-react";
import {
  addRefuel,
  addVehicle,
  addMaintenance,
  type Vehicle,
} from "@/lib/data-store";
import { toast } from "sonner";

/**
 * JSON importer. Accepts a wide range of shapes:
 *   - { vehicles: [{ refuels: [...] }] }
 *   - { data: { vehicles: [...], fuelLogs: [...], maintenanceLogs?, insurances?, puccs? } }
 *   - [{ ...vehicle }, ...]
 *   - { refuels: [...] } (single anonymous vehicle)
 *
 * Flat fuel logs / maintenance logs / insurance / PUC records linked via
 * `vehicleId` are grouped back onto their owning vehicle automatically.
 */

interface Props {
  open: boolean;
  onClose: () => void;
}

type ParsedRefuel = {
  refuel_date: string;
  amount_inr: number;
  rate_per_litre: number;
  litres: number;
  odo_km: number | null;
  full_tank: boolean;
};

type ParsedMaintenance = {
  service_date: string;
  service_type: string;
  odo_km: number | null;
  cost_inr: number | null;
  notes: string | null;
};

type DetectedVehicle = {
  source_id: string | null;
  source_name: string;
  name: string;
  make: string;
  model_year: string;
  fuel_type: "petrol" | "diesel" | "cng" | "electric";
  icon: "car" | "bike" | "scooter";
  reg_number: string;
  insurance_expiry: string | null;
  puc_expiry: string | null;
  refuels: ParsedRefuel[];
  maintenance: ParsedMaintenance[];
  errors: string[];
  unassigned?: boolean;
};

const DATE_KEYS = ["refuel_date", "date", "fill_date", "filldate", "datetime", "day"];
const ODO_KEYS = ["odo_km", "odo", "odometer", "odometer_km", "mileage", "kms", "kilometers"];
const AMT_KEYS = ["amount_inr", "amount", "cost", "total_cost", "totalCost", "total", "price", "expense"];
const RATE_KEYS = ["rate_per_litre", "rate", "unit_price", "price_per_litre", "price_per_liter", "ppl"];
const LTR_KEYS = ["litres", "liters", "volume", "quantity", "qty", "litre", "liter", "fuel_volume", "fuelAmount", "fuel_amount"];
const FULL_KEYS = ["full_tank", "full", "is_full", "fulltank", "filled", "is_filled"];
const VID_KEYS = ["vehicleId", "vehicle_id", "vehicle", "vid"];
const EXPIRY_KEYS = ["expiryDate", "expiry_date", "expiresAt", "expires_at", "endDate", "end_date", "validTill", "valid_till"];

function pickFirst(row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
    const lk = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase());
    if (lk && row[lk] != null && row[lk] !== "") return row[lk];
  }
  return undefined;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[₹$,\s]/g, ""));
  return isFinite(n) ? n : null;
}

function normaliseDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
  if (iso) return iso[0];
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function normFuel(v: unknown): DetectedVehicle["fuel_type"] {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "diesel") return "diesel";
  if (s === "cng") return "cng";
  if (s === "electric" || s === "ev") return "electric";
  return "petrol"; // includes gas/gasoline/unknown
}

function normIcon(v: unknown): DetectedVehicle["icon"] {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "bike" || s === "motorcycle") return "bike";
  if (s === "scooter") return "scooter";
  return "car";
}

function buildRefuel(
  row: Record<string, unknown>,
): { ok: true; payload: ParsedRefuel } | { ok: false; reason: string } {
  const date = normaliseDate(pickFirst(row, DATE_KEYS));
  if (!date) return { ok: false, reason: "missing/invalid date" };

  let amount = toNum(pickFirst(row, AMT_KEYS));
  let rate = toNum(pickFirst(row, RATE_KEYS));
  let litres = toNum(pickFirst(row, LTR_KEYS));

  if (amount == null && rate != null && litres != null) amount = rate * litres;
  if (rate == null && amount != null && litres && litres > 0) rate = amount / litres;
  if (litres == null && amount != null && rate && rate > 0) litres = amount / rate;

  if (amount == null || rate == null || litres == null || rate <= 0 || litres <= 0) {
    return { ok: false, reason: "needs amount + (rate or litres)" };
  }
  const odo = toNum(pickFirst(row, ODO_KEYS));
  const fullRaw = pickFirst(row, FULL_KEYS);
  const full =
    fullRaw == null
      ? false
      : typeof fullRaw === "boolean"
        ? fullRaw
        : ["true", "1", "yes", "y", "full"].includes(String(fullRaw).toLowerCase());

  return {
    ok: true,
    payload: {
      refuel_date: date,
      amount_inr: Number(amount.toFixed(2)),
      rate_per_litre: Number(rate.toFixed(3)),
      litres: Number(litres.toFixed(3)),
      odo_km: odo,
      full_tank: full,
    },
  };
}

function buildMaintenance(
  row: Record<string, unknown>,
): ParsedMaintenance | null {
  const date = normaliseDate(pickFirst(row, ["service_date", "date", "serviceDate"]));
  if (!date) return null;
  const type = String(
    pickFirst(row, ["service_type", "type", "description", "title", "category"]) ?? "Service",
  ).trim() || "Service";
  return {
    service_date: date,
    service_type: type,
    odo_km: toNum(pickFirst(row, ODO_KEYS)),
    cost_inr: toNum(pickFirst(row, AMT_KEYS)),
    notes: (() => {
      const n = pickFirst(row, ["notes", "note", "remarks", "comment", "serviceCenter"]);
      return n == null ? null : String(n);
    })(),
  };
}

function latestExpiry(rows: Array<Record<string, unknown>>): string | null {
  let best: string | null = null;
  for (const r of rows) {
    const d = normaliseDate(pickFirst(r, EXPIRY_KEYS));
    if (d && (!best || d > best)) best = d;
  }
  return best;
}

function detectVehicles(raw: unknown): DetectedVehicle[] {
  // Unwrap common backup wrappers: { data: {...} }
  let root: any = raw;
  if (root && typeof root === "object" && !Array.isArray(root) && root.data && typeof root.data === "object") {
    root = root.data;
  }

  // Decide where vehicles + flat logs come from.
  let vehicleRows: Array<Record<string, unknown>> = [];
  let flatFuel: Array<Record<string, unknown>> | null = null;
  let flatMaint: Array<Record<string, unknown>> | null = null;
  let flatInsurance: Array<Record<string, unknown>> | null = null;
  let flatPuc: Array<Record<string, unknown>> | null = null;

  if (Array.isArray(root)) {
    vehicleRows = root as Array<Record<string, unknown>>;
  } else if (root && typeof root === "object") {
    const r = root as Record<string, unknown>;
    if (Array.isArray(r.vehicles)) {
      vehicleRows = r.vehicles as Array<Record<string, unknown>>;
      if (Array.isArray(r.fuelLogs)) flatFuel = r.fuelLogs as any;
      else if (Array.isArray(r.refuels)) flatFuel = r.refuels as any;
      else if (Array.isArray(r.fills)) flatFuel = r.fills as any;
      else if (Array.isArray(r.logs)) flatFuel = r.logs as any;
      if (Array.isArray(r.maintenanceLogs)) flatMaint = r.maintenanceLogs as any;
      else if (Array.isArray(r.maintenance)) flatMaint = r.maintenance as any;
      if (Array.isArray(r.insurances)) flatInsurance = r.insurances as any;
      if (Array.isArray(r.puccs)) flatPuc = r.puccs as any;
      else if (Array.isArray(r.pucs)) flatPuc = r.pucs as any;
    } else if (Array.isArray(r.refuels) || Array.isArray(r.fills) || Array.isArray(r.logs)) {
      vehicleRows = [r];
    } else {
      vehicleRows = [r];
    }
  }

  // Map source id → bucket
  const buckets = new Map<string, DetectedVehicle>();
  const order: string[] = [];

  vehicleRows.forEach((g, i) => {
    const id = g.id != null ? String(g.id) : `__idx_${i}`;
    const make = String(g.make ?? g.manufacturer ?? "").trim();
    const model = String(g.model ?? "").trim();
    const sourceName = String(
      g.name ?? g.vehicle_name ?? g.vehicle ?? g.title ?? [make, model].filter(Boolean).join(" ") ?? `Vehicle ${i + 1}`,
    ).trim() || `Vehicle ${i + 1}`;

    // refuels nested inside the vehicle, if any
    const nestedFuel = (g.refuels ?? g.fills ?? g.logs ?? []) as Array<Record<string, unknown>>;
    const builtFuel = Array.isArray(nestedFuel) ? nestedFuel.map(buildRefuel) : [];
    const refuels = builtFuel.filter((b): b is { ok: true; payload: ParsedRefuel } => b.ok).map((b) => b.payload);
    const errors = builtFuel
      .map((b, j) => (b.ok ? null : `Row ${j + 1}: ${b.reason}`))
      .filter((x): x is string => !!x);

    buckets.set(id, {
      source_id: g.id != null ? String(g.id) : null,
      source_name: sourceName,
      name: sourceName,
      make,
      model_year: g.model_year != null ? String(g.model_year) : g.year != null ? String(g.year) : "",
      fuel_type: normFuel(g.fuel_type ?? g.fuelType ?? g.fuel),
      icon: normIcon(g.icon ?? g.type ?? g.category),
      reg_number: String(g.reg_number ?? g.registration ?? g.licensePlate ?? g.license_plate ?? g.plate ?? "").trim(),
      insurance_expiry: null,
      puc_expiry: null,
      refuels,
      maintenance: [],
      errors,
    });
    order.push(id);
  });

  // Attach flat fuel logs by vehicleId
  const unassigned: DetectedVehicle = {
    source_id: null,
    source_name: "Unassigned logs",
    name: "Unassigned",
    make: "",
    model_year: "",
    fuel_type: "petrol",
    icon: "car",
    reg_number: "",
    insurance_expiry: null,
    puc_expiry: null,
    refuels: [],
    maintenance: [],
    errors: [],
    unassigned: true,
  };

  if (flatFuel) {
    flatFuel.forEach((row, j) => {
      const vid = pickFirst(row, VID_KEYS);
      const key = vid != null ? String(vid) : "";
      const bucket = (key && buckets.get(key)) || unassigned;
      const built = buildRefuel(row);
      if (built.ok) bucket.refuels.push(built.payload);
      else bucket.errors.push(`Fuel row ${j + 1}: ${built.reason}`);
    });
  }

  if (flatMaint) {
    flatMaint.forEach((row) => {
      const vid = pickFirst(row, VID_KEYS);
      const key = vid != null ? String(vid) : "";
      const bucket = (key && buckets.get(key)) || unassigned;
      const built = buildMaintenance(row);
      if (built) bucket.maintenance.push(built);
    });
  }

  function attachExpiry(rows: Array<Record<string, unknown>> | null, field: "insurance_expiry" | "puc_expiry") {
    if (!rows) return;
    const byVid = new Map<string, Array<Record<string, unknown>>>();
    for (const r of rows) {
      const vid = pickFirst(r, VID_KEYS);
      if (vid == null) continue;
      const key = String(vid);
      if (!byVid.has(key)) byVid.set(key, []);
      byVid.get(key)!.push(r);
    }
    for (const [key, rs] of byVid) {
      const b = buckets.get(key);
      if (b) b[field] = latestExpiry(rs);
    }
  }
  attachExpiry(flatInsurance, "insurance_expiry");
  attachExpiry(flatPuc, "puc_expiry");

  const result = order.map((k) => buckets.get(k)!).filter(Boolean);
  if (unassigned.refuels.length || unassigned.maintenance.length) {
    result.unshift(unassigned);
  }
  return result;
}

export function JsonImportModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"upload" | "confirm" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [detected, setDetected] = useState<DetectedVehicle[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const totalRefuels = useMemo(
    () => detected.reduce((s, v) => s + v.refuels.length, 0),
    [detected],
  );
  const totalMaint = useMemo(
    () => detected.reduce((s, v) => s + v.maintenance.length, 0),
    [detected],
  );

  const importMut = useMutation({
    mutationFn: async () => {
      let vehicles = 0;
      let imported = 0;
      let skipped = 0;
      let maint = 0;
      for (const v of detected) {
        if (!v.name.trim() || v.refuels.length === 0) {
          skipped += v.refuels.length;
          continue;
        }
        const created: Vehicle = await addVehicle({
          name: v.name.trim(),
          fuel_type: v.fuel_type,
          icon: v.icon,
          make: v.make.trim() || null,
          model_year: v.model_year ? Number(v.model_year) || null : null,
          reg_number: v.reg_number.trim() || null,
          insurance_expiry: v.insurance_expiry,
          puc_expiry: v.puc_expiry,
        });
        vehicles += 1;
        for (const r of v.refuels) {
          try {
            await addRefuel({ ...r, vehicle_id: created.id });
            imported += 1;
          } catch {
            skipped += 1;
          }
        }
        for (const m of v.maintenance) {
          try {
            await addMaintenance({
              vehicle_id: created.id,
              service_date: m.service_date,
              service_type: m.service_type,
              odo_km: m.odo_km,
              cost_inr: m.cost_inr,
              notes: m.notes,
              next_service_date: null,
              next_service_odo_km: null,
            });
            maint += 1;
          } catch {
            /* ignore */
          }
        }
      }
      return { vehicles, imported, skipped, maint };
    },
    onSuccess: ({ vehicles, imported, skipped, maint }) => {
      toast.success(
        `Imported ${vehicles} vehicle${vehicles === 1 ? "" : "s"} · ${imported} refuel${imported === 1 ? "" : "s"}${maint ? ` · ${maint} service${maint === 1 ? "" : "s"}` : ""}${skipped ? ` · ${skipped} skipped` : ""}`,
      );
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  async function onFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const groups = detectVehicles(json);
      if (groups.length === 0) {
        setParseError("Couldn't find any vehicles or refuels in this file.");
        return;
      }
      setDetected(groups);
      setStep("confirm");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON file");
    }
  }

  function patch(i: number, p: Partial<DetectedVehicle>) {
    setDetected((d) => d.map((v, j) => (i === j ? { ...v, ...p } : v)));
  }

  if (!open) return null;

  const importable = detected.filter((v) => v.name.trim() && v.refuels.length > 0);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl p-6 md:rounded-3xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import from JSON
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports multi-vehicle exports and backups with flat fuel logs.
              We'll ask you to confirm each vehicle before importing.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="press rounded-full glass-subtle p-1.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "upload" && (
          <>
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl glass-subtle border border-dashed border-foreground/15 p-8 text-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Choose a .json file</span>
              <span className="text-xs text-muted-foreground">
                Single, multi-vehicle, or full-backup exports all work
              </span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            {parseError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
            <details className="mt-4 rounded-xl glass-subtle p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Supported JSON shapes
              </summary>
              <pre className="mt-2 overflow-x-auto text-[10px] leading-tight">
{`// Backup-style (flat fuel logs linked by vehicleId)
{
  "data": {
    "vehicles": [
      { "id": "v1", "make": "KTM", "model": "Duke 390",
        "year": 2018, "licensePlate": "KL 01 CF 3261",
        "fuelType": "petrol" }
    ],
    "fuelLogs": [
      { "vehicleId": "v1", "date": "2025-10-25",
        "odometer": 24022, "fuelAmount": 7,
        "cost": 754.51, "filled": true }
    ],
    "insurances": [{ "vehicleId": "v1", "expiryDate": "2026-05-01" }],
    "puccs":      [{ "vehicleId": "v1", "expiryDate": "2026-02-10" }]
  }
}

// Nested-style
{ "vehicles": [{ "name": "Swift", "refuels": [
  { "date": "2024-08-12", "amount": 2000, "rate": 102.5, "odo": 45230 }
]}]}`}
              </pre>
            </details>
          </>
        )}

        {step === "confirm" && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl glass-subtle px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
              <span className="truncate">📄 {fileName}</span>
              <span className="tabular-nums">
                {detected.length} vehicle(s) · {totalRefuels} refuel(s)
                {totalMaint ? ` · ${totalMaint} service(s)` : ""}
              </span>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <div>
                  <div className="font-medium text-foreground">
                    Confirm make &amp; model for accurate stats
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    Used to fetch claimed mileage and a vehicle photo. Take a
                    moment to confirm each one below.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {detected.map((v, i) => (
                <div
                  key={i}
                  className={`rounded-2xl glass-subtle p-4 space-y-3 ${
                    v.unassigned ? "border border-amber-500/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {v.unassigned
                        ? "Unassigned logs — name this vehicle or skip"
                        : `Vehicle ${i + 1} — source: "${v.source_name}"`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block col-span-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Display name *
                      </span>
                      <input
                        value={v.name}
                        onChange={(e) => patch(i, { name: e.target.value })}
                        className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                        placeholder="My Swift"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Make
                      </span>
                      <input
                        value={v.make}
                        onChange={(e) => patch(i, { make: e.target.value })}
                        className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                        placeholder="Maruti Suzuki"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Model year
                      </span>
                      <input
                        type="number"
                        value={v.model_year}
                        onChange={(e) => patch(i, { model_year: e.target.value })}
                        className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                        placeholder="2019"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Fuel
                      </span>
                      <select
                        value={v.fuel_type}
                        onChange={(e) =>
                          patch(i, { fuel_type: e.target.value as DetectedVehicle["fuel_type"] })
                        }
                        className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                      >
                        <option value="petrol">Petrol</option>
                        <option value="diesel">Diesel</option>
                        <option value="cng">CNG</option>
                        <option value="electric">Electric</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Type
                      </span>
                      <select
                        value={v.icon}
                        onChange={(e) =>
                          patch(i, { icon: e.target.value as DetectedVehicle["icon"] })
                        }
                        className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                      >
                        <option value="car">Car</option>
                        <option value="bike">Bike</option>
                        <option value="scooter">Scooter</option>
                      </select>
                    </label>
                    <label className="block col-span-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Registration (optional)
                      </span>
                      <input
                        value={v.reg_number}
                        onChange={(e) => patch(i, { reg_number: e.target.value })}
                        className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                        placeholder="KL 01 AB 1234"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {v.refuels.length} refuel(s)
                    </span>
                    {v.maintenance.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
                        <Wrench className="h-3.5 w-3.5" />
                        {v.maintenance.length} service(s)
                      </span>
                    )}
                    {v.insurance_expiry && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Insurance · {v.insurance_expiry}
                      </span>
                    )}
                    {v.puc_expiry && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        PUC · {v.puc_expiry}
                      </span>
                    )}
                    {v.errors.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {v.errors.length} skipped
                      </span>
                    )}
                  </div>
                  {v.errors.length > 0 && (
                    <details className="text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer">Why some rows were skipped</summary>
                      <ul className="mt-1 space-y-0.5">
                        {v.errors.slice(0, 5).map((e, k) => (
                          <li key={k}>• {e}</li>
                        ))}
                        {v.errors.length > 5 && <li>… and {v.errors.length - 5} more</li>}
                      </ul>
                    </details>
                  )}
                  {v.refuels.length === 0 && (
                    <div className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                      No valid refuels — this vehicle will be skipped on import.
                    </div>
                  )}
                </div>
              ))}
            </div>

            {importable.length === 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                No vehicle has a name + valid refuels yet. Fix the issues above or go back.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setStep("upload");
                  setDetected([]);
                  setFileName("");
                }}
                className="press inline-flex items-center gap-1 rounded-xl glass-subtle px-4 py-3 text-sm font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={() => importMut.mutate()}
                disabled={importMut.isPending || importable.length === 0}
                className="press flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {importMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Import {importable.length} vehicle{importable.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
