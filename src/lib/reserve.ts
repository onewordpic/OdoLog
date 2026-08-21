// Reserve-tap maths for carburettor bikes (older Royal Enfield / Hero etc).
// These bikes have no fuel pump or gauge — the rider flips a tap to "reserve"
// when the main tank runs dry, then has a short buffer to reach a pump.

export type ReserveRefuel = {
  refuel_date: string;
  odo_km: number | null;
  tank_state?: "main" | "reserve" | null;
  tank_state_after?: "main" | "reserve" | null;
  reserve_km?: number | null;
  reserve_switch_odo_km?: number | null;
};

export type ReserveStats = {
  /** Fills that were logged while running on reserve. */
  reserveFills: number;
  /** Total fills considered. */
  totalFills: number;
  /** Typical km ridden after switching to reserve (median), when known. */
  typicalReserveKm: number | null;
  /** How many fills the typical figure is based on. */
  reserveKmSamples: number;
  /** Longest reserve run recorded. */
  longestReserveKm: number | null;
  /** Fills where the rider stayed on the reserve tap afterwards (partial top-ups). */
  partialReserveFills: number;
};

/** Minimum measurements before we claim a "typical" reserve distance. */
export const MIN_RESERVE_SAMPLES = 2;

/** Distance ridden on reserve for one fill: measured from odos when possible. */
export function reserveDistance(r: ReserveRefuel): number | null {
  if (r.tank_state !== "reserve") return null;
  const odo = Number(r.odo_km);
  const sw = Number(r.reserve_switch_odo_km);
  if (Number.isFinite(odo) && Number.isFinite(sw) && odo > sw) return odo - sw;
  const manual = Number(r.reserve_km);
  return Number.isFinite(manual) && manual > 0 ? manual : null;
}

export function reserveStats(refuels: ReserveRefuel[]): ReserveStats {
  const withState = refuels.filter((r) => r.tank_state != null);
  const onReserve = withState.filter((r) => r.tank_state === "reserve");
  const kms = onReserve
    .map(reserveDistance)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
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
    typicalReserveKm:
      median != null && kms.length >= MIN_RESERVE_SAMPLES ? Math.round(median) : null,
    reserveKmSamples: kms.length,
    longestReserveKm: kms.length ? kms[kms.length - 1] : null,
    partialReserveFills: withState.filter((r) => r.tank_state_after === "reserve")
      .length,
  };
}

/**
 * Odometer reading where the main tank is likely to run dry, i.e. where the
 * rider will need to flip to reserve. Prefers the measured reserve distance
 * (last fill odo minus typical reserve run projected forward), falling back to
 * the reserve-litres estimate. Returns null when we lack data.
 */
export function reserveSwitchOdo(input: {
  lastOdo: number | null;
  litresFilled: number | null;
  reserveLitres: number | null;
  kmPerL: number | null;
  /** Measured median km ridden on reserve, when we have enough samples. */
  typicalReserveKm?: number | null;
}): number | null {
  const { lastOdo, litresFilled, reserveLitres, kmPerL, typicalReserveKm } = input;
  if (!lastOdo || !kmPerL || kmPerL <= 0) return null;
  if (!litresFilled || litresFilled <= 0) return null;

  if (typicalReserveKm && typicalReserveKm > 0) {
    // Full range from this fill, minus the distance the reserve buffer covers.
    const fullRange = litresFilled * kmPerL;
    const usableKm = fullRange - typicalReserveKm;
    if (usableKm > 0) return Math.floor((lastOdo + usableKm) / 10) * 10;
  }

  const usable = Math.max(0, litresFilled - (reserveLitres ?? 0));
  if (usable <= 0) return null;
  return Math.floor((lastOdo + usable * kmPerL) / 10) * 10;
}
