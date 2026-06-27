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
} from "lucide-react";
import { addRefuel, addVehicle, type Vehicle } from "@/lib/data-store";
import { toast } from "sonner";

/**
 * JSON importer. Accepts flexible shapes:
 *   - { vehicles: [{ name, make?, model_year?, fuel_type?, icon?, refuels: [...] }] }
 *   - [{ ...vehicle }, ...]
 *   - { name, refuels: [...] } (single vehicle)
 *   - { refuels: [...] } (single anonymous vehicle)
 *
 * Each refuel object can use a wide range of field names; we normalise
 * before importing. Before importing, the user is asked to confirm
 * vehicle name / make / fuel type per detected vehicle.
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

type DetectedVehicle = {
  source_name: string;
  name: string;
  make: string;
  model_year: string;
  fuel_type: "petrol" | "diesel" | "cng" | "electric";
  icon: "car" | "bike" | "scooter";
  reg_number: string;
  refuels: ParsedRefuel[];
  errors: string[];
};

const DATE_KEYS = ["refuel_date", "date", "fill_date", "filldate", "datetime", "day"];
const ODO_KEYS = ["odo_km", "odo", "odometer", "odometer_km", "mileage", "kms", "kilometers"];
const AMT_KEYS = ["amount_inr", "amount", "cost", "total_cost", "total", "price", "expense"];
const RATE_KEYS = ["rate_per_litre", "rate", "unit_price", "price_per_litre", "price_per_liter", "ppl"];
const LTR_KEYS = ["litres", "liters", "volume", "quantity", "qty", "litre", "liter", "fuel_volume"];
const FULL_KEYS = ["full_tank", "full", "is_full", "fulltank"];

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

function detectVehicles(raw: unknown): DetectedVehicle[] {
  // Normalise the top-level shape into an array of vehicle objects.
  let groups: Array<Record<string, unknown>> = [];
  if (Array.isArray(raw)) {
    groups = raw as Array<Record<string, unknown>>;
  } else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.vehicles)) {
      groups = r.vehicles as Array<Record<string, unknown>>;
    } else if (Array.isArray(r.refuels)) {
      groups = [r];
    } else {
      groups = [r];
    }
  }

  return groups.map((g, i) => {
    const refuelsRaw = (g.refuels ?? g.fills ?? g.logs ?? []) as Array<Record<string, unknown>>;
    const built = Array.isArray(refuelsRaw) ? refuelsRaw.map(buildRefuel) : [];
    const refuels = built.filter((b): b is { ok: true; payload: ParsedRefuel } => b.ok).map((b) => b.payload);
    const errors = built
      .map((b, j) => (b.ok ? null : `Row ${j + 1}: ${b.reason}`))
      .filter((x): x is string => !!x);

    const rawFuel = String(g.fuel_type ?? g.fuel ?? "petrol").toLowerCase();
    const fuel_type: DetectedVehicle["fuel_type"] = ["petrol", "diesel", "cng", "electric"].includes(rawFuel)
      ? (rawFuel as DetectedVehicle["fuel_type"])
      : "petrol";
    const rawIcon = String(g.icon ?? g.type ?? "car").toLowerCase();
    const icon: DetectedVehicle["icon"] = rawIcon === "bike" || rawIcon === "scooter" ? rawIcon : "car";

    const sourceName = String(g.name ?? g.vehicle_name ?? g.vehicle ?? g.title ?? `Vehicle ${i + 1}`).trim();

    return {
      source_name: sourceName,
      name: sourceName,
      make: String(g.make ?? g.manufacturer ?? "").trim(),
      model_year: g.model_year != null ? String(g.model_year) : g.year != null ? String(g.year) : "",
      fuel_type,
      icon,
      reg_number: String(g.reg_number ?? g.registration ?? g.plate ?? "").trim(),
      refuels,
      errors,
    };
  });
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

  const importMut = useMutation({
    mutationFn: async () => {
      let vehicles = 0;
      let imported = 0;
      let skipped = 0;
      for (const v of detected) {
        if (!v.name.trim()) {
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
      }
      return { vehicles, imported, skipped };
    },
    onSuccess: ({ vehicles, imported, skipped }) => {
      toast.success(
        `Imported ${vehicles} vehicle${vehicles === 1 ? "" : "s"} · ${imported} refuel${imported === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`,
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

  const blockingProblem = detected.some(
    (v) => !v.name.trim() || v.refuels.length === 0,
  );

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
              Supports multi-vehicle exports. We'll ask you to confirm each
              vehicle's make &amp; model before importing.
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
                Single or multi-vehicle exports both work
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
                Expected JSON shape
              </summary>
              <pre className="mt-2 overflow-x-auto text-[10px] leading-tight">
{`{
  "vehicles": [
    {
      "name": "Swift",
      "make": "Maruti Suzuki",
      "model_year": 2019,
      "fuel_type": "petrol",
      "icon": "car",
      "refuels": [
        { "date": "2024-08-12", "amount": 2000,
          "rate": 102.5, "litres": 19.51, "odo": 45230,
          "full_tank": true }
      ]
    }
  ]
}`}
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
              </span>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <div>
                  <div className="font-medium text-foreground">
                    Add make &amp; model for accurate stats
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    Our catalog uses these to fetch claimed mileage and a vehicle photo.
                    Spend a moment to confirm each one below.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {detected.map((v, i) => (
                <div key={i} className="rounded-2xl glass-subtle p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Vehicle {i + 1} — source: "{v.source_name}"
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

                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {v.refuels.length} refuel(s) ready
                    </span>
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
                      No valid refuels in this vehicle. Check the date / amount / rate
                      fields in your source file or remove it before importing.
                    </div>
                  )}
                </div>
              ))}
            </div>

            {blockingProblem && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Every vehicle needs a name and at least one valid refuel before
                you can import. Fix the issues above or go back and pick a
                different file.
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
                disabled={importMut.isPending || blockingProblem}
                className="press flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {importMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Import {detected.length} vehicle{detected.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
