// Indian fuel retail brands shown in the refuel form.
// `id` is what we persist; `label` is the display name.

export type FuelBrandId =
  | "iocl"
  | "bpcl"
  | "hpcl"
  | "nayara"
  | "jiobp"
  | "shell"
  | "other";

export const FUEL_BRANDS: { id: FuelBrandId; label: string; short: string }[] = [
  { id: "iocl", label: "Indian Oil", short: "IOCL" },
  { id: "bpcl", label: "Bharat Petroleum", short: "BPCL" },
  { id: "hpcl", label: "Hindustan Petroleum", short: "HPCL" },
  { id: "nayara", label: "Nayara", short: "Nayara" },
  { id: "jiobp", label: "Reliance Jio-bp", short: "Jio-bp" },
  { id: "shell", label: "Shell", short: "Shell" },
  { id: "other", label: "Other", short: "Other" },
];

export function brandLabel(id?: string | null): string | null {
  if (!id) return null;
  const b = FUEL_BRANDS.find((x) => x.id === id);
  return b?.short ?? id;
}

const LS_LAST = "odolog.lastBrand";

export function rememberBrand(vehicleId: string, brand: FuelBrandId) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LS_LAST);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[vehicleId] = brand;
    window.localStorage.setItem(LS_LAST, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

export function recallBrand(vehicleId: string): FuelBrandId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_LAST);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    const v = map[vehicleId];
    return (FUEL_BRANDS.find((b) => b.id === v)?.id ?? null) as FuelBrandId | null;
  } catch {
    return null;
  }
}
