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
  
  Wrench,
  AlertTriangle,
  BellRing,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  getVehicle,
  listRefuels,
  addRefuel,
  deleteRefuel,
  deleteVehicle,
  updateVehicle,
  getProfile,
  listMaintenance,
  addMaintenance,
  deleteMaintenance,
  type Refuel,
  type Vehicle,
  type MaintenanceLog,
  type VehicleIcon as VIcon,
} from "@/lib/data-store";
import { VehicleIcon, VEHICLE_ICONS } from "@/components/vehicle-icon";
import { VehicleAvatar } from "@/components/vehicle-avatar";
import { searchCatalog, type CatalogEntry } from "@/lib/vehicle-catalog";


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

      <div className="mb-6 flex items-start gap-4 animate-fade-in-up">
        {vehicle.data && (
          <VehicleHeaderEditor vehicle={vehicle.data} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-light tracking-tight truncate">
            {vehicle.data
              ? vehicle.data.make
                ? `${vehicle.data.make} ${vehicle.data.name}`
                : vehicle.data.name
              : "…"}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {vehicle.data?.fuel_type}
            {vehicle.data?.model_year ? ` · ${vehicle.data.model_year}` : ""}
          </p>
          {vehicle.data?.reg_number && (
            <p className="mt-1 inline-block rounded-md glass-subtle px-2 py-0.5 font-mono text-xs tracking-wider">
              {vehicle.data.reg_number}
            </p>
          )}
        </div>
      </div>


      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={Wallet}
          label="Cost / km"
          value={summary.costPerKm != null ? `₹${summary.costPerKm.toFixed(2)}` : "—"}
          hint={summary.basis?.label}
        />
        <Stat
          icon={TrendingUp}
          label="Mileage"
          value={summary.kmPerL != null ? `${summary.kmPerL.toFixed(1)} km/l` : "—"}
          hint={summary.basis?.label}
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

      {summary.basis && (summary.costPerKm != null || summary.kmPerL != null) && (
        <div className="mt-3 glass-subtle rounded-2xl px-4 py-3 text-xs text-muted-foreground animate-fade-in">
          <span className="font-medium text-foreground">
            {summary.basis.source === "segments" ? "Based on " : "Estimated from "}
            {summary.basis.label.toLowerCase()}:
          </span>{" "}
          {summary.basis.detail}
        </div>
      )}

      {(summary.costPerKm == null || summary.kmPerL == null) && summary.missing.length > 0 && (
        <div className="mt-3 glass rounded-2xl px-4 py-3 animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-xs">
              <div className="font-medium text-foreground">
                {summary.costPerKm == null && summary.kmPerL == null
                  ? "Cost/km and Mileage need a bit more data"
                  : summary.costPerKm == null
                    ? "Cost/km needs a bit more data"
                    : "Mileage needs a bit more data"}
              </div>
              <ul className="mt-1.5 space-y-1 text-muted-foreground">
                {summary.missing.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass hover-lift rounded-2xl p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-light tracking-tight">{value}</div>
      {hint && value !== "—" && (
        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {hint}
        </div>
      )}
    </div>
  );
}

function VehicleHeaderEditor({ vehicle }: { vehicle: Vehicle }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edit vehicle details"
        className="press hover-lift group relative shrink-0"
      >
        <VehicleAvatar vehicle={vehicle} size={68} rounded="rounded-2xl" />
        <span className="glass absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="h-3 w-3" />
        </span>
      </button>
      {editing && (
        <EditVehicleModal
          vehicle={vehicle}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function EditVehicleModal({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(vehicle.name);
  const [icon, setIcon] = useState<VIcon>(vehicle.icon);
  const [make, setMake] = useState(vehicle.make ?? "");
  const [year, setYear] = useState(
    vehicle.model_year != null ? String(vehicle.model_year) : "",
  );
  const [reg, setReg] = useState(vehicle.reg_number ?? "");
  const [imageUrl, setImageUrl] = useState(vehicle.image_url ?? "");

  const suggestions = useMemo<CatalogEntry[]>(
    () => (name.trim().length >= 1 ? searchCatalog(name, 4) : []),
    [name],
  );

  const mut = useMutation({
    mutationFn: () =>
      updateVehicle(vehicle.id, {
        name: name.trim() || vehicle.name,
        icon,
        make: make.trim() || null,
        model_year: year ? Number(year) : null,
        reg_number: reg.trim() ? reg.trim().toUpperCase() : null,
        image_url: imageUrl.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Vehicle updated");
      qc.invalidateQueries({ queryKey: ["vehicle", vehicle.id] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
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

  function applySuggestion(s: CatalogEntry) {
    setName(s.model);
    setMake(s.make);
    setIcon(s.type);
    if (s.image) setImageUrl(s.image);
  }

  const currentYear = new Date().getFullYear();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 md:rounded-3xl animate-slide-up"
      >
        <div className="flex items-center gap-3">
          <VehicleAvatar
            vehicle={{ icon, make: make || null, image_url: imageUrl || null, name }}
            size={56}
          />
          <div>
            <h3 className="text-lg font-medium">Edit vehicle</h3>
            <p className="text-xs text-muted-foreground">
              Make, model, registration & photo.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="mt-5 space-y-4"
        >
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Model</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm"
            />
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={`${s.make}-${s.model}`}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="press rounded-full glass-subtle px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {s.make} {s.model}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Make</span>
            <input
              value={make}
              onChange={(e) => setMake(e.target.value)}
              maxLength={40}
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Year</span>
              <input
                type="number"
                min={1950}
                max={currentYear + 1}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Reg. no.</span>
              <input
                value={reg}
                onChange={(e) => setReg(e.target.value.toUpperCase())}
                maxLength={20}
                className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm uppercase"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Photo URL</span>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm"
            />
          </label>

          <div>
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {VEHICLE_ICONS.map((opt) => {
                const active = icon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIcon(opt.id)}
                    className={`press flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "glass-subtle glass-hover"
                    }`}
                  >
                    <VehicleIcon icon={opt.id} className="h-5 w-5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="press flex-1 rounded-xl glass-subtle py-3 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="press flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {mut.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
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

function fmtShortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function computeSummary(refuels: Refuel[]) {
  const totalLitres = refuels.reduce((s, r) => s + Number(r.litres), 0);
  const totalSpend = refuels.reduce((s, r) => s + Number(r.amount_inr), 0);
  const asc = [...refuels].sort((a, b) =>
    a.refuel_date.localeCompare(b.refuel_date),
  );
  const fullsWithOdo = asc.filter((r) => r.full_tank && r.odo_km != null);
  const latestOdo = asc
    .map((r) => (r.odo_km != null ? Number(r.odo_km) : null))
    .filter((n): n is number => n != null)
    .reduce((max, n) => (n > max ? n : max), 0) || null;

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
      date: fmtShortDate(cur.refuel_date),
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
  let kmPerL = totalSegLitres > 0 ? totalSegKm / totalSegLitres : null;
  let costPerKm = totalSegKm > 0 ? totalSegSpend / totalSegKm : null;

  // Track which refuels backed the estimate so we can show a breakdown.
  let basisSource: "segments" | "fallback" | null = null;
  let basisLabel = "";
  let basisDetail = "";

  if (segments.length >= 1) {
    const firstSeg = fullsWithOdo[0];
    const lastSeg = fullsWithOdo[fullsWithOdo.length - 1];
    basisSource = "segments";
    basisLabel = `${segments.length} full-tank segment${segments.length === 1 ? "" : "s"}`;
    basisDetail = `${fmtShortDate(firstSeg.refuel_date)} (${Number(firstSeg.odo_km).toFixed(0)} km) → ${fmtShortDate(lastSeg.refuel_date)} (${Number(lastSeg.odo_km).toFixed(0)} km) · ${totalSegKm.toFixed(0)} km on ${totalSegLitres.toFixed(2)} L (₹${totalSegSpend.toFixed(0)})`;
  }

  // Fallback estimate when there aren't 2+ full-tank refuels yet:
  // use the span between the earliest and latest odo readings.
  const withOdo = asc.filter((r) => r.odo_km != null);
  let fallbackKm = 0;
  let fallbackLitres = 0;
  let fallbackSpend = 0;
  let fallbackFirst: Refuel | null = null;
  let fallbackLast: Refuel | null = null;
  if (withOdo.length >= 2) {
    const first = withOdo[0];
    const last = withOdo[withOdo.length - 1];
    const km = Number(last.odo_km) - Number(first.odo_km);
    if (km > 0) {
      fallbackFirst = first;
      fallbackLast = last;
      fallbackKm = km;
      if (totalKm == null) totalKm = km;
      // litres & spend consumed AFTER the first odo reading
      for (const r of asc) {
        if (r.refuel_date > first.refuel_date || (r.refuel_date === first.refuel_date && r.id !== first.id)) {
          fallbackLitres += Number(r.litres);
          fallbackSpend += Number(r.amount_inr);
        }
      }
      if (kmPerL == null && fallbackLitres > 0) kmPerL = km / fallbackLitres;
      if (costPerKm == null && fallbackSpend > 0) costPerKm = fallbackSpend / km;
      if (basisSource == null && (kmPerL != null || costPerKm != null)) {
        basisSource = "fallback";
        basisLabel = "Odometer span estimate";
        basisDetail = `${fmtShortDate(first.refuel_date)} (${Number(first.odo_km).toFixed(0)} km) → ${fmtShortDate(last.refuel_date)} (${Number(last.odo_km).toFixed(0)} km) · ${km.toFixed(0)} km on ${fallbackLitres.toFixed(2)} L (₹${fallbackSpend.toFixed(0)})`;
      }
    }
  }

  // Diagnose what's missing when cost/km or mileage can't be calculated.
  const missing: string[] = [];
  if (asc.length === 0) {
    missing.push("Log at least one refuel to get started.");
  } else {
    const odoCount = withOdo.length;
    if (odoCount === 0) {
      missing.push("Odometer reading — add it on your next refuel so we know your starting point.");
    } else if (odoCount === 1) {
      missing.push("A second odometer reading — log it on your next refuel to measure the distance covered.");
    }
    // litres after first odo reading drives the calculation
    const litresAfterFirst =
      withOdo.length >= 1
        ? asc
            .filter(
              (r) =>
                r.refuel_date > withOdo[0].refuel_date ||
                (r.refuel_date === withOdo[0].refuel_date && r.id !== withOdo[0].id),
            )
            .reduce((s, r) => s + Number(r.litres), 0)
        : 0;
    if (withOdo.length >= 2 && litresAfterFirst <= 0) {
      missing.push("Fuel spend (₹) or rate on a refuel after the first odometer reading.");
    }
    const zeroRate = asc.some((r) => Number(r.rate_per_litre) <= 0 || Number(r.amount_inr) <= 0);
    if (zeroRate) {
      missing.push("A valid fuel rate and ₹ amount on every refuel (some entries are zero).");
    }
  }

  const segmentById = new Map(segments.map((s) => [s.refuelId, s]));

  return {
    totalLitres,
    totalSpend,
    totalKm,
    kmPerL,
    costPerKm,
    chart: segments,
    segmentById,
    latestOdo,
    basis: basisSource ? { source: basisSource, label: basisLabel, detail: basisDetail } : null,
    missing,
  };
}


// ---------- Interactive trend chart ----------

type Metric = "kmpl" | "cpk" | "spend" | "litres";

const METRICS: { id: Metric; label: string; color: string; unit: string }[] = [
  { id: "kmpl", label: "Mileage", color: "oklch(0.55 0.18 250)", unit: "km/l" },
  { id: "cpk", label: "Cost / km", color: "oklch(0.65 0.18 30)", unit: "₹/km" },
  { id: "spend", label: "Spend", color: "oklch(0.6 0.15 150)", unit: "₹" },
  { id: "litres", label: "Litres", color: "oklch(0.6 0.15 60)", unit: "L" },
];

function TrendChart({
  summary,
  refuels,
}: {
  summary: ReturnType<typeof computeSummary>;
  refuels: Refuel[];
}) {
  const [metric, setMetric] = useState<Metric>("kmpl");

  const data = useMemo(() => {
    if (metric === "kmpl" || metric === "cpk") {
      return summary.chart.map((s) => ({ date: s.date, value: s[metric] }));
    }
    const asc = [...refuels].sort((a, b) =>
      a.refuel_date.localeCompare(b.refuel_date),
    );
    return asc.map((r) => ({
      date: new Date(r.refuel_date + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      value:
        metric === "spend" ? Number(r.amount_inr) : Number(r.litres),
    }));
  }, [metric, summary.chart, refuels]);

  if (data.length < 2) return null;
  const cfg = METRICS.find((m) => m.id === metric)!;

  return (
    <section className="glass mt-6 rounded-2xl p-4 animate-fade-in-up">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Trend
        </div>
        <div className="glass-subtle flex rounded-full p-1 text-[11px]">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={`press rounded-full px-3 py-1 transition ${
                metric === m.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.02 250 / 0.2)" />
            <XAxis
              dataKey="date"
              stroke="oklch(0.5 0.02 250)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.5 0.02 250)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v: number) => [
                metric === "spend" || metric === "cpk"
                  ? `${cfg.unit === "₹" ? "₹" : ""}${v.toFixed(2)}${cfg.unit !== "₹" ? ` ${cfg.unit}` : ""}`
                  : `${v.toFixed(2)} ${cfg.unit}`,
                cfg.label,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={cfg.label}
              stroke={cfg.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: cfg.color }}
              activeDot={{ r: 5 }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ---------- Maintenance log ----------

function MaintenanceSection({
  vehicleId,
  latestOdo,
}: {
  vehicleId: string;
  latestOdo: number | null;
}) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const logs = useQuery({
    queryKey: ["maintenance", vehicleId],
    queryFn: () => listMaintenance(vehicleId),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMaintenance(id),
    onSuccess: () => {
      toast.success("Service log deleted");
      qc.invalidateQueries({ queryKey: ["maintenance", vehicleId] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const dueItems = (logs.data ?? []).filter((m) => {
    const dueByDate = m.next_service_date && m.next_service_date <= today;
    const dueByOdo =
      m.next_service_odo_km != null &&
      latestOdo != null &&
      latestOdo >= Number(m.next_service_odo_km);
    return dueByDate || dueByOdo;
  });

  return (
    <section className="mt-8 animate-fade-in-up">
      {dueItems.length > 0 && (
        <div className="glass mb-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-destructive">
              Service due
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {dueItems.map((m) => (
                <li key={m.id} className="truncate">
                  · {m.service_type}
                  {m.next_service_date && ` — by ${formatDate(m.next_service_date)}`}
                  {m.next_service_odo_km != null &&
                    ` — at ${Number(m.next_service_odo_km).toFixed(0)} km`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Maintenance
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 rounded-full glass-subtle px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
        >
          <Plus className="h-3.5 w-3.5" /> Log service
        </button>
      </div>

      {logs.isLoading ? (
        <div className="glass flex h-20 items-center justify-center rounded-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : logs.data && logs.data.length > 0 ? (
        <div className="space-y-2">
          {logs.data.map((m) => {
            const isDue = dueItems.some((d) => d.id === m.id);
            return (
              <div
                key={m.id}
                className="glass flex items-center justify-between rounded-2xl p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium truncate">{m.service_type}</span>
                    {m.cost_inr != null && (
                      <span className="text-xs text-muted-foreground">
                        · ₹{Number(m.cost_inr).toFixed(0)}
                      </span>
                    )}
                    {m.condition && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                        {m.condition}
                      </span>
                    )}
                    {isDue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium uppercase text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Due
                      </span>
                    )}

                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDate(m.service_date)}</span>
                    {m.odo_km != null && (
                      <span>· {Number(m.odo_km).toFixed(0)} km</span>
                    )}
                    {m.next_service_date && (
                      <span>· next by {formatDate(m.next_service_date)}</span>
                    )}
                    {m.next_service_odo_km != null && (
                      <span>· next at {Number(m.next_service_odo_km).toFixed(0)} km</span>
                    )}
                  </div>
                  {m.notes && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {m.notes}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm("Delete this service log?")) del.mutate(m.id);
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
        <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-10 text-center">
          <Wrench className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No service logs yet. Optional, but handy for reminders.
          </p>
        </div>
      )}

      {showAdd && (
        <AddMaintenanceModal
          vehicleId={vehicleId}
          latestOdo={latestOdo}
          onClose={() => setShowAdd(false)}
        />
      )}
    </section>
  );
}

function AddMaintenanceModal({
  vehicleId,
  latestOdo,
  onClose,
}: {
  vehicleId: string;
  latestOdo: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [type, setType] = useState("");
  const [odo, setOdo] = useState(latestOdo != null ? String(Math.round(latestOdo)) : "");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [condition, setCondition] = useState("");
  const [nextOdo, setNextOdo] = useState("");
  const [nextDate, setNextDate] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!type.trim()) throw new Error("Enter a service type");
      await addMaintenance({
        vehicle_id: vehicleId,
        service_date: date,
        service_type: type.trim(),
        odo_km: odo ? parseFloat(odo) : null,
        cost_inr: cost ? parseFloat(cost) : null,
        notes: notes.trim() || null,
        condition: condition || null,
        next_service_odo_km: nextOdo ? parseFloat(nextOdo) : null,
        next_service_date: nextDate || null,
      });
    },
    onSuccess: () => {
      toast.success("Service logged");
      qc.invalidateQueries({ queryKey: ["maintenance", vehicleId] });
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

  const presets = [
    "Oil change",
    "Oil filter",
    "Tyre check",
    "Tyre rotation",
    "Tyre replacement",
    "Brake pads",
    "Air filter",
    "Coolant",
    "Chain lube",
    "General service",
  ];
  const isTyre = /tyre/i.test(type);
  const isOil = /oil/i.test(type);
  const conditionOptions = isTyre
    ? ["New", "Good", "Worn", "Replace soon", "Punctured"]
    : isOil
      ? ["Fresh", "OK", "Dirty", "Needs change"]
      : ["Good", "OK", "Needs attention"];


  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 md:rounded-3xl"
      >
        <h3 className="text-lg font-medium">Log service</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional reminders by date or odometer.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="mt-5 space-y-4"
        >
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Service type
            </span>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g. Oil change"
              required
              autoFocus
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setType(p)}
                  className="press rounded-full glass-subtle px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="Odometer (km)"
              value={odo}
              onChange={setOdo}
              placeholder="optional"
              step="any"
            />
            <NumField
              label="Cost (₹)"
              value={cost}
              onChange={setCost}
              placeholder="optional"
              step="any"
            />
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
            />
          </div>

          <div className="rounded-xl glass-subtle p-3">
            <div className="text-xs font-medium text-muted-foreground">
              Remind me at (optional)
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <NumField
                label="Next odo (km)"
                value={nextOdo}
                onChange={setNextOdo}
                placeholder="e.g. 45000"
                step="any"
              />
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Next date
                </span>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Condition {isTyre ? "(tyre)" : isOil ? "(oil)" : ""}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {conditionOptions.map((c) => {
                const active = condition === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(active ? "" : c)}
                    className={`press rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "glass-subtle text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
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
              disabled={mut.isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {mut.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


