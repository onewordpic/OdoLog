import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTrips, addTrip, deleteTrip, type Trip } from "@/lib/data-store";
import { toast } from "sonner";
import { Plus, Trash2, Route, CalendarDays, IndianRupee, Leaf } from "lucide-react";
import { co2FromTrip, gradeColor, gradeFromKgPerKm, type FuelType } from "@/lib/eco";

interface TripSectionProps {
  vehicleId: string;
  costPerKm: number | null;
  fuelType?: FuelType;
  kmPerL?: number | null;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function TripSection({ vehicleId, costPerKm, fuelType = "petrol", kmPerL = null }: TripSectionProps) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [startOdo, setStartOdo] = useState("");
  const [endOdo, setEndOdo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [tolls, setTolls] = useState("");
  const [tripDate, setTripDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const trips = useQuery({
    queryKey: ["trips", vehicleId],
    queryFn: () => listTrips(vehicleId),
  });

  const add = useMutation({
    mutationFn: addTrip,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips", vehicleId] });
      toast.success("Trip logged");
      setShowAdd(false);
      setStartOdo("");
      setEndOdo("");
      setPurpose("");
      setTolls("");
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message || "Failed to log trip"),
  });

  const del = useMutation({
    mutationFn: deleteTrip,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips", vehicleId] }),
    onError: (e: any) => toast.error(e.message || "Failed to delete trip"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseFloat(startOdo);
    const en = parseFloat(endOdo);
    if (isNaN(s) || isNaN(en) || en <= s) {
      toast.error("End odometer must be greater than start odometer");
      return;
    }
    add.mutate({
      vehicle_id: vehicleId,
      start_odo_km: s,
      end_odo_km: en,
      purpose: purpose.trim() || null,
      tolls_inr: tolls ? parseFloat(tolls) : 0,
      notes: notes.trim() || null,
      trip_date: tripDate,
    });
  };

  const data = trips.data ?? [];

  return (
    <div className="mt-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <Route className="h-4 w-4 text-[var(--cockpit-text-mute)]" /> Trips
        </h3>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="press inline-flex items-center gap-1 rounded-full bg-[var(--mint-accent)] text-stone-900 px-3 py-1.5 text-[11px] font-semibold"
        >
          <Plus className="h-3 w-3" /> {showAdd ? "Close" : "Log trip"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-4 mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Start ODO (km)</label>
              <input
                type="number"
                step="0.1"
                required
                value={startOdo}
                onChange={(e) => setStartOdo(e.target.value)}
                className="w-full mt-1 rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">End ODO (km)</label>
              <input
                type="number"
                step="0.1"
                required
                value={endOdo}
                onChange={(e) => setEndOdo(e.target.value)}
                className="w-full mt-1 rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Purpose</label>
            <input
              type="text"
              placeholder="e.g. Office commute, Road trip"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full mt-1 rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Tolls (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tolls}
                onChange={(e) => setTolls(e.target.value)}
                className="w-full mt-1 rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                required
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
                className="w-full mt-1 rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
            <input
              type="text"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={add.isPending}
            className="press w-full rounded-xl bg-[var(--mint-accent)] text-stone-900 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {add.isPending ? "Saving…" : "Save trip"}
          </button>
        </form>
      )}

      {trips.isLoading ? (
        <div className="py-8 flex items-center justify-center">
          <div className="h-4 w-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--cockpit-text-mute)]">
          No trips logged yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((t) => {
            const start = validNumber(t.start_odo_km);
            const end = validNumber(t.end_odo_km);
            const dist = start != null && end != null && end > start ? end - start : null;
            const fuelCost = dist != null && costPerKm != null ? dist * costPerKm : null;
            const toll = validNumber(t.tolls_inr) ?? 0;
            const totalCost = fuelCost != null ? fuelCost + toll : null;
            return (
              <div
                key={t.id}
                className="glass rounded-2xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{t.purpose || "Trip"}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" /> {formatShortDate(t.trip_date)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--cockpit-text-soft)]">
                    {dist != null && (
                      <span className="inline-flex items-center gap-1">
                        <Route className="h-3 w-3" /> {dist.toFixed(1)} km
                      </span>
                    )}
                    {totalCost != null && (
                      <span className="inline-flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" /> {totalCost.toFixed(0)}
                      </span>
                    )}
                    {toll > 0 && (
                      <span className="inline-flex items-center gap-1">
                        Toll ₹{toll.toFixed(0)}
                      </span>
                    )}
                    {dist != null && (() => {
                      const co2 = co2FromTrip(dist, kmPerL, fuelType);
                      if (co2 == null) return null;
                      const grade = gradeFromKgPerKm(co2 / dist);
                      return (
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${gradeColor(grade)}`}>
                          <Leaf className="h-2.5 w-2.5" />
                          {co2.toFixed(1)} kg{grade ? ` · ${grade}` : ""}
                        </span>
                      );
                    })()}
                    {t.notes && <span className="truncate max-w-[12rem]">{t.notes}</span>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Delete this trip?")) del.mutate(t.id);
                  }}
                  className="press flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 hover:bg-foreground/10 transition shrink-0"
                  aria-label="Delete trip"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function validNumber(n: unknown): number | null {
  if (n == null) return null;
  const v = typeof n === "string" ? parseFloat(n) : Number(n);
  return Number.isFinite(v) ? v : null;
}
