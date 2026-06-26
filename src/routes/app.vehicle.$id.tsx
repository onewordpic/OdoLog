import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchFuelPrice } from "@/lib/fuel-price.functions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  RefreshCcw,
  TrendingUp,
  Gauge,
  Wallet,
  Droplet,
  Pencil,
  Check,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getVehicle,
  listRefuels,
  addRefuel,
  deleteRefuel,
  deleteVehicle,
  updateVehicle,
  getProfile,
  type Refuel,
  type Vehicle,
  type VehicleIcon as VIcon,
} from "@/lib/data-store";
import { VehicleIcon, VEHICLE_ICONS } from "@/components/vehicle-icon";

export const Route = createFileRoute("/app/vehicle/$id")({
  component: VehiclePage,
});

function VehiclePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const vehicle = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => getVehicle(id),
  });

  const refuels = useQuery({
    queryKey: ["refuels", id],
    queryFn: () => listRefuels(id),
  });

  const del = useMutation({
    mutationFn: (rid: string) => deleteRefuel(rid),
    onSuccess: () => {
      toast.success("Refuel deleted");
      qc.invalidateQueries({ queryKey: ["refuels", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-refuels"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const delVehicle = useMutation({
    mutationFn: () => deleteVehicle(id),
    onSuccess: () => {
      toast.success("Vehicle deleted");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      navigate({ to: "/app" });
    },
  });

  const summary = useMemo(() => computeSummary(refuels.data ?? []), [refuels.data]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 animate-fade-in">
      <header className="mb-6 flex items-center justify-between">
        <Link
          to="/app"
          className="glass glass-hover press flex h-9 w-9 items-center justify-center rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <button
          onClick={() => {
            if (confirm("Delete this vehicle and all its refuels?"))
              delVehicle.mutate();
          }}
          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          Delete vehicle
        </button>
      </header>

      <div className="mb-6 flex items-center gap-4 animate-fade-in-up">
        {vehicle.data && (
          <VehicleIconEditor
            vehicleId={vehicle.data.id}
            current={vehicle.data.icon}
          />
        )}
        <div>
          <h1 className="text-3xl font-light tracking-tight">
            {vehicle.data?.name ?? "…"}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {vehicle.data?.fuel_type}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={Wallet}
          label="Cost / km"
          value={summary.costPerKm != null ? `₹${summary.costPerKm.toFixed(2)}` : "—"}
        />
        <Stat
          icon={TrendingUp}
          label="Mileage"
          value={summary.kmPerL != null ? `${summary.kmPerL.toFixed(1)} km/l` : "—"}
        />
        <Stat
          icon={Droplet}
          label="Litres"
          value={summary.totalLitres.toFixed(1)}
        />
        <Stat
          icon={Gauge}
          label="Distance"
          value={summary.totalKm != null ? `${summary.totalKm.toFixed(0)} km` : "—"}
        />
      </section>

      <TrendChart summary={summary} refuels={refuels.data ?? []} />

      <MaintenanceSection vehicleId={id} latestOdo={summary.latestOdo} />


      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Refuel log
          </h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add refuel
          </button>
        </div>

        {refuels.isLoading ? (
          <div className="glass flex h-24 items-center justify-center rounded-2xl">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : refuels.data && refuels.data.length > 0 ? (
          <div className="space-y-2">
            {refuels.data.map((r) => {
              const seg = summary.segmentById.get(r.id);
              return (
              <div
                key={r.id}
                className="glass flex items-center justify-between rounded-2xl p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      ₹{Number(r.amount_inr).toFixed(0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {Number(r.litres).toFixed(2)} L @ ₹
                      {Number(r.rate_per_litre).toFixed(2)}
                    </span>
                    {!r.full_tank && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium uppercase text-accent-foreground">
                        Partial
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDate(r.refuel_date)}</span>
                    {r.odo_km != null && (
                      <span>· {Number(r.odo_km).toFixed(0)} km</span>
                    )}
                    {seg && (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                          ₹{seg.cpk.toFixed(2)}/km
                        </span>
                        <span className="text-[11px]">
                          {seg.kmpl.toFixed(1)} km/l · {seg.km.toFixed(0)} km on ₹{seg.spend.toFixed(0)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Delete this refuel?")) del.mutate(r.id);
                  }}
                  className="ml-3 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center">
            <Droplet className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No refuels yet. Log your first one.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Add refuel
            </button>
          </div>
        )}
      </section>

      {showAdd && vehicle.data && (
        <AddRefuelModal
          vehicle={vehicle.data}
          onClose={() => setShowAdd(false)}
        />
      )}
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="glass hover-lift rounded-2xl p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-light tracking-tight">{value}</div>
    </div>
  );
}

function VehicleIconEditor({
  vehicleId,
  current,
}: {
  vehicleId: string;
  current: VIcon;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const mut = useMutation({
    mutationFn: (icon: VIcon) => updateVehicle(vehicleId, { icon }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["recent-refuels"] });
      setEditing(false);
      toast.success("Icon updated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (editing) {
    return (
      <div className="glass animate-scale-in flex items-center gap-1 rounded-2xl p-1.5">
        {VEHICLE_ICONS.map((opt) => {
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={mut.isPending}
              onClick={() => mut.mutate(opt.id)}
              aria-label={opt.label}
              className={`press flex h-10 w-10 items-center justify-center rounded-xl transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "glass-hover text-foreground"
              }`}
            >
              <VehicleIcon icon={opt.id} className="h-5 w-5" />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Done"
          className="press flex h-10 w-10 items-center justify-center rounded-xl glass-hover"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label="Change vehicle icon"
      className="glass press hover-lift group relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
    >
      <VehicleIcon icon={current} className="h-7 w-7 text-primary" />
      <span className="glass absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
        <Pencil className="h-3 w-3" />
      </span>
    </button>
  );
}

function AddRefuelModal({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fetchPrice = useServerFn(fetchFuelPrice);
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [odo, setOdo] = useState("");
  const [fullTank, setFullTank] = useState(true);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [city, setCity] = useState("");

  useEffect(() => {
    getProfile().then((p) => {
      if (p.default_city) setCity(p.default_city);
    });
  }, []);

  // Auto-fetch rate on open if today's date
  useEffect(() => {
    if (!city) return;
    if (date !== today) return;
    if (rate) return;
    void doFetchRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  async function doFetchRate() {
    if (!city) {
      toast.error("Set a default city in Settings first");
      return;
    }
    setFetchingRate(true);
    try {
      const r = await fetchPrice({
        data: { city, fuelType: vehicle.fuel_type },
      });
      if (r.ok) {
        setRate(r.price.toFixed(2));
        toast.success(`Today's rate: ₹${r.price.toFixed(2)} in ${city}`);
      } else {
        toast.error(`Couldn't fetch rate: ${r.error}. Enter manually.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setFetchingRate(false);
    }
  }

  const amountN = parseFloat(amount);
  const rateN = parseFloat(rate);
  const litres =
    !isNaN(amountN) && !isNaN(rateN) && rateN > 0 ? amountN / rateN : null;

  const mut = useMutation({
    mutationFn: async () => {
      if (!litres) throw new Error("Enter amount and rate");
      await addRefuel({
        vehicle_id: vehicle.id,
        refuel_date: date,
        amount_inr: amountN,
        rate_per_litre: rateN,
        litres: Number(litres.toFixed(3)),
        odo_km: odo ? parseFloat(odo) : null,
        full_tank: fullTank,
      });
    },
    onSuccess: () => {
      toast.success("Refuel logged");
      qc.invalidateQueries({ queryKey: ["refuels", vehicle.id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-refuels"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 md:rounded-3xl"
      >
        <h3 className="text-lg font-medium">New refuel</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {vehicle.name} · {vehicle.fuel_type}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="mt-5 space-y-4"
        >
          <NumField
            label="Amount (₹)"
            value={amount}
            onChange={setAmount}
            placeholder="500"
            step="any"
            required
            autoFocus
          />

          <div>
            <div className="flex items-end justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Rate (₹ / litre)
              </span>
              <button
                type="button"
                onClick={doFetchRate}
                disabled={fetchingRate}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {fetchingRate ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3 w-3" />
                )}
                Fetch today's rate{city ? ` (${city})` : ""}
              </button>
            </div>
            <input
              type="number"
              step="any"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="104.50"
              required
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
            />
          </div>

          {litres != null && (
            <div className="glass-subtle rounded-xl p-3 text-center text-sm">
              ≈ <span className="font-medium">{litres.toFixed(2)} L</span>
            </div>
          )}

          <NumField
            label="Odometer (km)"
            value={odo}
            onChange={setOdo}
            placeholder="optional, but improves accuracy"
            step="any"
          />

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
            />
          </div>

          <label className="flex items-center justify-between rounded-xl glass-subtle px-4 py-3">
            <div>
              <div className="text-sm font-medium">Full tank</div>
              <div className="text-xs text-muted-foreground">
                Required for accurate mileage
              </div>
            </div>
            <input
              type="checkbox"
              checked={fullTank}
              onChange={(e) => setFullTank(e.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl glass-subtle py-3 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending || !litres}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {mut.isPending ? "Saving…" : "Save refuel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        {...rest}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
      />
    </label>
  );
}

function formatDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Segment = {
  refuelId: string;
  date: string;
  km: number;
  litres: number;
  spend: number;
  kmpl: number;
  cpk: number;
};

function computeSummary(refuels: Refuel[]) {
  const totalLitres = refuels.reduce((s, r) => s + Number(r.litres), 0);
  const totalSpend = refuels.reduce((s, r) => s + Number(r.amount_inr), 0);
  const asc = [...refuels].sort((a, b) =>
    a.refuel_date.localeCompare(b.refuel_date),
  );
  const fullsWithOdo = asc.filter((r) => r.full_tank && r.odo_km != null);

  let totalKm: number | null = null;
  if (fullsWithOdo.length >= 2) {
    totalKm =
      Number(fullsWithOdo[fullsWithOdo.length - 1].odo_km) -
      Number(fullsWithOdo[0].odo_km);
  }

  const segments: Segment[] = [];
  for (let i = 1; i < fullsWithOdo.length; i++) {
    const prev = fullsWithOdo[i - 1];
    const cur = fullsWithOdo[i];
    const km = Number(cur.odo_km) - Number(prev.odo_km);
    if (km <= 0) continue;
    let litresUsed = 0;
    let spend = 0;
    for (const r of asc) {
      if (r.refuel_date > prev.refuel_date && r.refuel_date <= cur.refuel_date) {
        litresUsed += Number(r.litres);
        spend += Number(r.amount_inr);
      }
    }
    if (litresUsed <= 0) continue;
    segments.push({
      refuelId: cur.id,
      date: new Date(cur.refuel_date + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      km,
      litres: litresUsed,
      spend,
      kmpl: km / litresUsed,
      cpk: spend / km,
    });
  }

  // Weighted overall cost/km and mileage based on totals across segments
  const totalSegKm = segments.reduce((s, x) => s + x.km, 0);
  const totalSegLitres = segments.reduce((s, x) => s + x.litres, 0);
  const totalSegSpend = segments.reduce((s, x) => s + x.spend, 0);
  const kmPerL = totalSegLitres > 0 ? totalSegKm / totalSegLitres : null;
  const costPerKm = totalSegKm > 0 ? totalSegSpend / totalSegKm : null;

  const segmentById = new Map(segments.map((s) => [s.refuelId, s]));

  return {
    totalLitres,
    totalSpend,
    totalKm,
    kmPerL,
    costPerKm,
    chart: segments,
    segmentById,
  };
}
