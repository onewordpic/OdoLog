import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { addRefuel } from "@/lib/data-store";
import { toast } from "sonner";

/**
 * CSV importer that accepts fuel-log exports from apps like Hammond, Fuelio,
 * Drivvo and aCar. We auto-detect common column names and let the user
 * confirm/override the mapping before importing.
 */
interface Props {
  vehicleId: string;
  open: boolean;
  onClose: () => void;
}

type Row = Record<string, string>;
type Mapping = {
  date: string | null;
  odo: string | null;
  amount: string | null;
  rate: string | null;
  litres: string | null;
  fullTank: string | null;
};

// Header synonyms → canonical field
const SYNONYMS: Record<keyof Mapping, string[]> = {
  date: ["date", "refuel_date", "fill date", "filldate", "datetime", "day"],
  odo: ["odo", "odometer", "odometer (km)", "odometer_km", "mileage", "kms", "kilometers", "total_km", "odo_km"],
  amount: ["amount", "cost", "total cost", "total_cost", "price", "total", "amount_inr", "expense", "total price"],
  rate: ["rate", "price/unit", "unit price", "unit_price", "rate_per_litre", "price per litre", "price per liter", "rate/l", "ppl"],
  litres: ["litres", "liters", "volume", "quantity", "fuel volume", "fuel_volume", "qty", "litre", "liter", "gallons"],
  fullTank: ["full", "full tank", "fulltank", "full_tank", "is_full"],
};

function parseCSV(text: string): { headers: string[]; rows: Row[] } {
  // Minimal CSV parser supporting quotes and commas inside fields.
  const lines: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (cur.length > 0 || row.length > 0) { row.push(cur); lines.push(row); row = []; cur = ""; }
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else cur += c;
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); lines.push(row); }
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map((h) => h.trim());
  const rows = lines.slice(1)
    .filter((l) => l.some((c) => c.trim().length > 0))
    .map((l) => Object.fromEntries(headers.map((h, i) => [h, (l[i] ?? "").trim()])));
  return { headers, rows };
}

function autoMap(headers: string[]): Mapping {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (keys: string[]) => {
    for (const k of keys) {
      const idx = lower.indexOf(k);
      if (idx >= 0) return headers[idx];
    }
    // fuzzy contains
    for (const k of keys) {
      const idx = lower.findIndex((h) => h.includes(k));
      if (idx >= 0) return headers[idx];
    }
    return null;
  };
  return {
    date: find(SYNONYMS.date),
    odo: find(SYNONYMS.odo),
    amount: find(SYNONYMS.amount),
    rate: find(SYNONYMS.rate),
    litres: find(SYNONYMS.litres),
    fullTank: find(SYNONYMS.fullTank),
  };
}

function normaliseDate(v: string): string | null {
  if (!v) return null;
  // try ISO
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(v);
  if (iso) return iso[0];
  // try dd/mm/yyyy or dd-mm-yyyy
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(v);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function toNum(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[₹$,\s]/g, ""));
  return isFinite(n) ? n : null;
}

export function CsvImportModal({ vehicleId, open, onClose }: Props) {
  const qc = useQueryClient();
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Mapping | null>(null);

  const preview = useMemo(() => {
    if (!mapping || rows.length === 0) return [];
    return rows.slice(0, 5).map((r) => buildRefuel(r, mapping));
  }, [rows, mapping]);

  const validCount = useMemo(
    () => (mapping ? rows.map((r) => buildRefuel(r, mapping)).filter((x) => x.ok).length : 0),
    [rows, mapping],
  );

  const importMut = useMutation({
    mutationFn: async () => {
      if (!mapping) return { imported: 0, skipped: 0 };
      let imported = 0;
      let skipped = 0;
      for (const r of rows) {
        const b = buildRefuel(r, mapping);
        if (!b.ok || !b.payload) { skipped += 1; continue; }
        try {
          await addRefuel({ ...b.payload, vehicle_id: vehicleId });
          imported += 1;
        } catch {
          skipped += 1;
        }
      }
      return { imported, skipped };
    },
    onSuccess: ({ imported, skipped }) => {
      toast.success(`Imported ${imported} refuel${imported === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`);
      qc.invalidateQueries({ queryKey: ["refuels", vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  const onFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const { headers: h, rows: r } = parseCSV(text);
    setHeaders(h);
    setRows(r);
    setMapping(autoMap(h));
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 md:rounded-3xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import refuels from CSV
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Works with Hammond, Fuelio, Drivvo, aCar exports — or any CSV with date,
              odometer, amount, rate &amp; litres columns.
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

        {rows.length === 0 ? (
          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl glass-subtle border border-dashed border-foreground/15 p-8 text-center">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">Choose a .csv file</span>
            <span className="text-xs text-muted-foreground">We'll auto-detect the columns</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl glass-subtle px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
              <span className="truncate">📄 {fileName}</span>
              <span className="tabular-nums">{rows.length} row(s)</span>
            </div>

            <div className="space-y-2">
              {(Object.keys(SYNONYMS) as (keyof Mapping)[]).map((field) => (
                <div key={field} className="grid grid-cols-[110px_1fr] items-center gap-2">
                  <span className="text-xs font-medium capitalize text-muted-foreground">
                    {labelFor(field)}
                  </span>
                  <select
                    value={mapping?.[field] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...(m as Mapping), [field]: e.target.value || null }))
                    }
                    className="w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                  >
                    <option value="">— Ignore —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {preview.length > 0 && (
              <div className="rounded-xl glass-subtle p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Preview (first 5)
                </div>
                <div className="space-y-1 text-xs">
                  {preview.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 tabular-nums">
                      {p.ok ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
                      )}
                      <span className="truncate">
                        {p.ok && p.payload
                          ? `${p.payload.refuel_date} · ₹${p.payload.amount_inr} · ${p.payload.litres.toFixed(2)}L${p.payload.odo_km != null ? ` · ${p.payload.odo_km} km` : ""}`
                          : p.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{validCount}</span> of {rows.length} row(s) ready to import.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setRows([]); setHeaders([]); setMapping(null); setFileName(""); }}
                className="flex-1 rounded-xl glass-subtle py-3 text-sm font-medium"
              >
                Choose another file
              </button>
              <button
                onClick={() => importMut.mutate()}
                disabled={importMut.isPending || validCount === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {importMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {validCount}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function labelFor(f: keyof Mapping) {
  return {
    date: "Date",
    odo: "Odometer",
    amount: "Amount (₹)",
    rate: "Rate / L",
    litres: "Litres",
    fullTank: "Full tank",
  }[f];
}

function buildRefuel(
  row: Row,
  m: Mapping,
):
  | { ok: true; payload: {
      refuel_date: string;
      amount_inr: number;
      rate_per_litre: number;
      litres: number;
      odo_km: number | null;
      full_tank: boolean;
    } }
  | { ok: false; reason: string; payload?: undefined } {
  const dateRaw = m.date ? row[m.date] : "";
  const date = normaliseDate(dateRaw);
  if (!date) return { ok: false, reason: `Skipped — invalid date "${dateRaw}"` };

  let amount = m.amount ? toNum(row[m.amount]) : null;
  let rate = m.rate ? toNum(row[m.rate]) : null;
  let litres = m.litres ? toNum(row[m.litres]) : null;

  // Derive missing field if at least two are present.
  if (amount == null && rate != null && litres != null) amount = rate * litres;
  if (rate == null && amount != null && litres && litres > 0) rate = amount / litres;
  if (litres == null && amount != null && rate && rate > 0) litres = amount / rate;

  if (amount == null || rate == null || litres == null || rate <= 0 || litres <= 0) {
    return { ok: false, reason: "Skipped — needs amount + (rate or litres)" };
  }

  const odo = m.odo ? toNum(row[m.odo]) : null;
  const fullRaw = m.fullTank ? row[m.fullTank]?.toLowerCase() : "";
  const fullTank = m.fullTank
    ? ["true", "1", "yes", "y", "full"].includes(fullRaw ?? "")
    : false;

  return {
    ok: true,
    payload: {
      refuel_date: date,
      amount_inr: Number(amount.toFixed(2)),
      rate_per_litre: Number(rate.toFixed(3)),
      litres: Number(litres.toFixed(3)),
      odo_km: odo,
      full_tank: fullTank,
    },
  };
}
