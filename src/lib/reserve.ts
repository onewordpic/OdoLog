// Reserve-tap maths for carburettor bikes (older Royal Enfield / Hero etc).
// These bikes have no fuel pump or gauge — the rider flips a tap to "reserve"
// when the main tank runs dry, then has a short buffer to reach a pump.

export type ReserveRefuel = {
  refuel_date: string;
  odo_km: number | null;
  tank_state?: "main" | "reserve" | null;
  reserve_km?: number | null;
};

export type ReserveStats = {
  /** Fills that were logged while running on reserve. */
  reserveFills: number;
  /** Total fills considered. */
  totalFills: number;
  /** Typical km ridden after switching to reserve (median), when known. */
  typicalReserveKm: number | null;
  /** Longest reserve run recorded. */
  longestReserveKm: number | null;
};

export function reserveStats(refuels: ReserveRefuel[]): ReserveStats {
  const withState = refuels.filter((r) => r.tank_state != null);
  const onReserve = withState.filter((r) => r.tank_state === "reserve");
  const kms = onReserve
    .map((r) => Number(r.reserve_km))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const median =
    kms.length === 0
      ? null
      : kms.length % 2
        ? kms[(kms.length - 1) / 2]
        : (kms[kms.length / 2 - 1] + kms[kms.length / 2]) / 2;
  return {
    reserveFills: onReserve.length,
    totalFills: withState.length,
    typicalReserveKm: median != null ? Math.round(median) : null,
    longestReserveKm: kms.length ? kms[kms.length - 1] : null,
  };
}

/**
 * Odometer reading where the main tank is likely to run dry, i.e. where the
 * rider will need to flip to reserve. Falls back to null when we lack data.
 */
export function reserveSwitchOdo(input: {
  lastOdo: number | null;
  litresFilled: number | null;
  reserveLitres: number | null;
  kmPerL: number | null;
}): number | null {
  const { lastOdo, litresFilled, reserveLitres, kmPerL } = input;
  if (!lastOdo || !kmPerL || kmPerL <= 0) return null;
  if (!litresFilled || litresFilled <= 0) return null;
  const usable = Math.max(0, litresFilled - (reserveLitres ?? 0));
  if (usable <= 0) return null;
  return Math.floor((lastOdo + usable * kmPerL) / 10) * 10;
}
