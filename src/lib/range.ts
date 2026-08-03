// Shared "how far will this tank take me" math.
// Used by the vehicle page card and the garage summary chip so both stay in sync.

export type RangeInput = {
  /** Refuels for a single vehicle (any order). */
  refuels: { refuel_date: string; odo_km: number | null; litres: number | null }[];
  /** Derived km/l from segment history, when available. */
  kmPerL: number | null;
  /** Manufacturer-claimed km/l fallback. */
  claimedKmPerL?: number | null;
  /** Newest odometer reading known for the vehicle (may be newer than last fill). */
  latestOdo: number | null;
};

export type RangeEstimate = {
  /** Suggested odometer reading to refuel at (includes a 10% reserve buffer). */
  nextOdo: number;
  /** Km still expected from the current tank right now. */
  kmLeft: number;
  /** Litres estimated left in the tank right now. */
  litresLeft: number;
  /** km/l used for the maths. */
  kmPerL: number;
  /** Whether kmPerL came from the manufacturer figure rather than real logs. */
  estimated: boolean;
};

const RESERVE = 0.1;

export function estimateRange(input: RangeInput): RangeEstimate | null {
  const kmPerL = input.kmPerL ?? input.claimedKmPerL ?? null;
  if (!kmPerL || kmPerL <= 0) return null;

  const withOdo = input.refuels
    .filter((r) => r.odo_km != null && Number(r.litres) > 0)
    .sort((a, b) => a.refuel_date.localeCompare(b.refuel_date));
  const last = withOdo[withOdo.length - 1];
  if (!last) return null;

  const lastOdo = Number(last.odo_km);
  const tankKm = Number(last.litres) * kmPerL;

  // Distance already covered since that fill, if a newer reading exists.
  const driven = Math.max(0, (input.latestOdo ?? lastOdo) - lastOdo);
  const kmLeft = Math.max(0, tankKm - driven);
  const litresLeft = kmLeft / kmPerL;

  // Refuel before running dry: keep a 10% reserve, round down to nearest 10 km.
  const usable = tankKm * (1 - RESERVE);
  const nextOdo = Math.floor((lastOdo + usable) / 10) * 10;

  return {
    nextOdo,
    kmLeft,
    litresLeft,
    kmPerL,
    estimated: input.kmPerL == null,
  };
}
