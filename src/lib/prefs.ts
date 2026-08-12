// Local UI / behavior preferences. Stored in localStorage; not synced.

export type Prefs = {
  // Display
  density: "comfortable" | "compact";
  defaultChartMetric: "kmpl" | "cpk" | "spend" | "litres";
  // Reminders
  serviceAlertsEnabled: boolean;
  reminderLeadKm: number;
  reminderLeadDays: number;
  // Depreciation
  showDepreciation: boolean;
  // Sharing
  shareMessage: string;
  shareUrl: string;
  // Mobile ergonomics: which side the primary "Log fuel" pill pins to.
  handed: "left" | "right";
  // Developer: collect page-load performance samples and expose /app/perf.
  perfProfiling: boolean;
};

const KEY = "odolog.prefs";
const LEGACY_KEY = "fuelogue.prefs";
export const PREFS_EVENT = "odolog:prefs";

export const DEFAULT_SHARE_MESSAGE =
  "Tracking my fuel costs & mileage with OdoLog — a clean, free, open-source vehicle log. Give it a spin:";
export const DEFAULT_SHARE_URL = "https://odolog.lovable.app";

export const DEFAULT_PREFS: Prefs = {
  density: "comfortable",
  defaultChartMetric: "kmpl",
  serviceAlertsEnabled: true,
  reminderLeadKm: 300,
  reminderLeadDays: 7,
  showDepreciation: true,
  shareMessage: DEFAULT_SHARE_MESSAGE,
  shareUrl: DEFAULT_SHARE_URL,
  handed: "right",
  perfProfiling: false,

};

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    let raw = window.localStorage.getItem(KEY);
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_KEY);
      if (raw) window.localStorage.setItem(KEY, raw);
    }
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent(PREFS_EVENT));
}

export function clearLocalData(): void {
  if (typeof window === "undefined") return;
  for (const k of [
    "odolog.vehicles",
    "odolog.refuels",
    "odolog.maintenance",
    "odolog.profile",
    "odolog.prefs",
    "odolog.theme",
    "fuelogue.vehicles",
    "fuelogue.refuels",
    "fuelogue.maintenance",
    "fuelogue.profile",
    "fuelogue.prefs",
    "fuelogue.theme",
  ]) {
    window.localStorage.removeItem(k);
  }
}

type AnyRecord = Record<string, unknown>;

function toCsv(rows: AnyRecord[]): string {
  if (rows.length === 0) return "";
  const keys = Array.from(
    rows.reduce<Set<string>>((s, r) => {
      Object.keys(r).forEach((k) => s.add(k));
      return s;
    }, new Set()),
  );
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
  ].join("\n");
}

export function downloadCsv(filename: string, rows: AnyRecord[]): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
