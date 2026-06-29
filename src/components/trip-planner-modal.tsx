import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn as useServerFnRS } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  MapPin,
  Route,
  X,
  ArrowRight,
  Repeat,
  AlertTriangle,
  IndianRupee,
  Droplet,
  Gauge,
} from "lucide-react";
import {
  listVehicles,
  listRefuels,
  addTrip,
  getProfile,
  type Vehicle,
} from "@/lib/data-store";
import { estimateTripDistance } from "@/lib/trip-estimate.functions";
import { fetchFuelPrice } from "@/lib/fuel-price.functions";
import { claimedMileage } from "@/lib/vehicle-catalog";
import { VehicleIcon } from "@/components/vehicle-icon";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-select a vehicle (when opened from the vehicle page). */
  initialVehicleId?: string;
}

// Generic fall-back mileage if we can't compute one (Indian-ish averages).
const GENERIC_KMPL: Record<string, number> = {
  petrol: 18,
  diesel: 22,
  cng: 25,
  electric: 0,
};

function parseTripText(text: string): {
  origin: string;
  destination: string;
  roundTrip: boolean;
} | null {
  const t = text.trim();
  if (!t) return null;
  const roundTrip = /\b(and\s+back|round\s*trip|return)\b/i.test(t);
  const cleaned = t.replace(/\b(and\s+back|round\s*trip|return)\b/i, "").trim();
  // Patterns: "A to B", "from A to B", "A → B", "A - B"
  const m =
    cleaned.match(/^(?:from\s+)?([^,–\->]+?)\s+(?:to|→|->|-|–)\s+(.+?)\.?$/i) ??
    null;
  if (!m) return null;
  const origin = m[1].trim();
  const destination = m[2].trim();
  if (!origin || !destination) return null;
  return { origin, destination, roundTrip };
}

function vehicleKmPerL(refuels: ReturnType<typeof Number>[] | any[]): number | null {
  // computed below — placeholder shape; real impl uses refuel data.
  return null;
}

export function TripPlannerModal({ open, onClose, initialVehicleId }: Props) {
  const qc = useQueryClient();
  const estimate = useServerFnRS(estimateTripDistance);
  const fetchPrice = useServerFnRS(fetchFuelPrice);

  const [text, setText] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [roundTrip, setRoundTrip] = useState(true);
  const [vehicleId, setVehicleId] = useState<string | null>(initialVehicleId ?? null);

  type Estimate = {
    distanceKm: number;
    oneWayKm: number;
    originName: string;
    destName: string;
    mileageKmpl: number;
    mileageSource: "logs" | "arai" | "generic";
    rateInr: number | null;
    litres: number | null;
    costInr: number | null;
  };
  const [result, setResult] = useState<Estimate | null>(null);
  const [running, setRunning] = useState(false);

  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  useEffect(() => {
    if (open && initialVehicleId) setVehicleId(initialVehicleId);
    if (!open) {
      setText("");
      setOrigin("");
      setDestination("");
      setRoundTrip(true);
      setResult(null);
      setRunning(false);
    }
  }, [open, initialVehicleId]);

  // Parse free-text into structured fields whenever the user types.
  useEffect(() => {
    const parsed = parseTripText(text);
    if (parsed) {
      setOrigin(parsed.origin);
      setDestination(parsed.destination);
      setRoundTrip(parsed.roundTrip);
    }
  }, [text]);

  const selectedVehicle = useMemo<Vehicle | null>(
    () => vehicles.data?.find((v) => v.id === vehicleId) ?? null,
    [vehicles.data, vehicleId],
  );

  const refuelsQ = useQuery({
    queryKey: ["refuels", vehicleId ?? "_"],
    queryFn: () => listRefuels(vehicleId!),
    enabled: !!vehicleId,
  });

  async function computeMileage(v: Vehicle): Promise<{
    kmpl: number;
    source: "logs" | "arai" | "generic";
  }> {
    // Try user logs first
    const list = refuelsQ.data ?? (await listRefuels(v.id));
    const asc = [...list].sort((a, b) =>
      a.refuel_date.localeCompare(b.refuel_date),
    );
    const fulls = asc.filter((r) => r.full_tank && r.odo_km != null);
    if (fulls.length >= 2) {
      let km = 0,
        litres = 0;
      for (let i = 1; i < fulls.length; i++) {
        const prev = fulls[i - 1];
        const cur = fulls[i];
        const d = Number(cur.odo_km) - Number(prev.odo_km);
        if (d <= 0) continue;
        // litres between (exclusive prev, inclusive cur)
        const between = asc.filter(
          (r) =>
            r.refuel_date > prev.refuel_date && r.refuel_date <= cur.refuel_date,
        );
        const l = between.reduce((s, r) => s + (Number(r.litres) || 0), 0);
        if (l > 0) {
          km += d;
          litres += l;
        }
      }
      if (km > 0 && litres > 0) {
        return { kmpl: km / litres, source: "logs" };
      }
    }
    const claimed = claimedMileage(v.name, v.make);
    if (claimed != null) return { kmpl: claimed, source: "arai" };
    return { kmpl: GENERIC_KMPL[v.fuel_type] || 18, source: "generic" };
  }

  async function run() {
    if (!origin.trim() || !destination.trim()) {
      toast.error("Please enter origin and destination");
      return;
    }
    if (!selectedVehicle) {
      toast.error("Pick a vehicle for the estimate");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const r = await estimate({
        data: {
          origin: origin.trim(),
          destination: destination.trim(),
          roundTrip,
        },
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const v = selectedVehicle;
      const isEV = v.fuel_type === "electric";
      const { kmpl, source } = isEV
        ? { kmpl: 0, source: "generic" as const }
        : await computeMileage(v);

      let rateInr: number | null = null;
      let litres: number | null = null;
      let costInr: number | null = null;
      if (!isEV && kmpl > 0) {
        litres = r.distanceKm / kmpl;
        const city = profile.data?.default_city || "";
        if (city) {
          try {
            const pr = await fetchPrice({
              data: {
                city,
                fuelType: v.fuel_type as "petrol" | "diesel" | "cng",
              },
            });
            if (pr.ok) {
              rateInr = pr.price;
              costInr = litres * rateInr;
            }
          } catch {
            /* ignore — show without price */
          }
        }
      }

      setResult({
        distanceKm: r.distanceKm,
        oneWayKm: r.oneWayKm,
        originName: r.origin.name,
        destName: r.destination.name,
        mileageKmpl: kmpl,
        mileageSource: source,
        rateInr,
        litres,
        costInr,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Estimate failed");
    } finally {
      setRunning(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!result || !selectedVehicle) throw new Error("Nothing to save");
      const note = [
        `Planned: ${origin} → ${destination}${roundTrip ? " (and back)" : ""}`,
        `≈${result.distanceKm.toFixed(0)} km`,
        result.litres ? `≈${result.litres.toFixed(1)} L` : null,
        result.costInr ? `≈₹${result.costInr.toFixed(0)}` : null,
        `(estimates only)`,
      ]
        .filter(Boolean)
        .join(" · ");
      await addTrip({
        vehicle_id: selectedVehicle.id,
        start_odo_km: null,
        end_odo_km: null,
        purpose: `${origin} → ${destination}${roundTrip ? " (round trip)" : ""}`,
        tolls_inr: 0,
        notes: note,
        trip_date: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      toast.success("Saved as a planned trip");
      qc.invalidateQueries({ queryKey: ["trips"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save"),
  });

  if (!open) return null;

  const sourceLabel =
    result?.mileageSource === "logs"
      ? "Your past refuels"
      : result?.mileageSource === "arai"
        ? "ARAI / brand claimed"
        : "Generic average";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-md md:items-center px-3 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl md:rounded-3xl p-5 animate-slide-up"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Route className="h-4 w-4 text-[var(--mint-accent)]" /> Trip insight
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Describe your trip — we'll estimate distance, fuel & cost.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="press flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 hover:bg-foreground/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Free-text */}
        <label className="block mt-4">
          <span className="text-[11px] font-medium text-muted-foreground">
            Describe your trip
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Trivandrum to Munnar and back"
            className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2.5 text-sm"
          />
        </label>

        {/* Structured fallback */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground">
              From
            </span>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Trivandrum"
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground">
              To
            </span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Munnar"
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-2 flex items-center justify-between rounded-xl glass-subtle px-3 py-2">
          <span className="text-sm flex items-center gap-2">
            <Repeat className="h-3.5 w-3.5" /> Round trip
          </span>
          <input
            type="checkbox"
            checked={roundTrip}
            onChange={(e) => setRoundTrip(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>

        {/* Vehicle picker */}
        <div className="mt-3">
          <span className="text-[11px] font-medium text-muted-foreground">
            Which vehicle?
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(vehicles.data ?? []).map((v) => {
              const active = v.id === vehicleId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVehicleId(v.id)}
                  className={`press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                    active
                      ? "bg-[var(--mint-accent)] text-stone-900 border-transparent"
                      : "border-foreground/15 glass-subtle text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <VehicleIcon icon={v.icon ?? "car"} className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[10rem]">
                    {v.make ? `${v.make} ${v.name}` : v.name}
                  </span>
                </button>
              );
            })}
            {(vehicles.data ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">
                Add a vehicle first.
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={running || !selectedVehicle}
          className="press mt-4 w-full rounded-xl bg-[var(--mint-accent)] text-stone-900 py-3 text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Estimating…
            </>
          ) : (
            <>
              Estimate <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {result && (
          <div className="mt-5 space-y-3 animate-fade-in">
            <div className="rounded-2xl border border-foreground/10 p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Route
              </div>
              <div className="mt-1 text-sm font-medium leading-snug">
                <MapPin className="inline h-3.5 w-3.5 -mt-0.5 text-muted-foreground" />{" "}
                <span className="break-words">{result.originName}</span>
                <ArrowRight className="inline h-3.5 w-3.5 mx-1 text-muted-foreground" />
                <span className="break-words">{result.destName}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                One-way {result.oneWayKm.toFixed(0)} km{" "}
                {roundTrip ? "· round trip" : ""}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Tile
                icon={<Gauge className="h-3.5 w-3.5" />}
                label="Distance"
                value={`${result.distanceKm.toFixed(0)} km`}
              />
              <Tile
                icon={<Droplet className="h-3.5 w-3.5" />}
                label="Fuel"
                value={result.litres != null ? `${result.litres.toFixed(1)} L` : "—"}
              />
              <Tile
                icon={<IndianRupee className="h-3.5 w-3.5" />}
                label="Cost"
                value={result.costInr != null ? `₹${result.costInr.toFixed(0)}` : "—"}
              />
            </div>

            <div className="rounded-2xl glass-subtle px-3 py-2 text-[11px] text-muted-foreground">
              Mileage: {result.mileageKmpl > 0 ? `${result.mileageKmpl.toFixed(1)} km/l` : "n/a"} ·{" "}
              <span className="font-medium text-foreground">{sourceLabel}</span>
              {result.rateInr != null && (
                <> · ₹{result.rateInr.toFixed(2)}/L</>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                These are rough estimates — real usage varies with traffic, AC,
                terrain & driving style.
              </span>
            </div>

            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="press w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save as planned trip"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
