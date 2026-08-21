// A "switched to reserve" marker: the rider flips the tap mid-ride and taps
// once to record the odo at that exact moment. Device-local (works for guests
// and signed-in users alike); the durable value lands on the refuel row as
// reserve_switch_odo_km when the next fill is saved.
import { useCallback, useEffect, useState } from "react";

export type ReserveMarker = {
  /** Odometer reading when the tap was flipped to reserve. */
  odo: number;
  /** ISO timestamp of when it was recorded. */
  at: string;
};

const key = (vehicleId: string) => `odolog.reserve_marker.${vehicleId}`;

export function getMarker(vehicleId: string): ReserveMarker | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(vehicleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReserveMarker>;
    if (typeof parsed?.odo !== "number" || !Number.isFinite(parsed.odo)) return null;
    return { odo: parsed.odo, at: typeof parsed.at === "string" ? parsed.at : new Date().toISOString() };
  } catch {
    return null;
  }
}

export function setMarker(vehicleId: string, odo: number): ReserveMarker | null {
  if (typeof window === "undefined") return null;
  const m: ReserveMarker = { odo, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(key(vehicleId), JSON.stringify(m));
    window.dispatchEvent(new CustomEvent("odolog:reserve-marker", { detail: vehicleId }));
  } catch {
    /* storage full or blocked — marker is a convenience, not critical */
  }
  return m;
}

export function clearMarker(vehicleId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(vehicleId));
    window.dispatchEvent(new CustomEvent("odolog:reserve-marker", { detail: vehicleId }));
  } catch {
    /* ignore */
  }
}

/** Whole days between the marker and now. */
export function markerAgeDays(m: ReserveMarker): number {
  const ms = Date.now() - new Date(m.at).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Reads the marker after hydration and stays in sync with save/clear. */
export function useReserveMarker(vehicleId: string) {
  const [marker, setMarkerState] = useState<ReserveMarker | null>(null);

  const refresh = useCallback(() => {
    setMarkerState(getMarker(vehicleId));
  }, [vehicleId]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("odolog:reserve-marker", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("odolog:reserve-marker", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const save = useCallback(
    (odo: number) => {
      setMarker(vehicleId, odo);
      refresh();
    },
    [vehicleId, refresh],
  );

  const clear = useCallback(() => {
    clearMarker(vehicleId);
    refresh();
  }, [vehicleId, refresh]);

  return { marker, save, clear };
}
