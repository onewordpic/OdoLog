import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { FuelType } from "@/lib/eco";

const TripSection = lazy(() => import("@/components/trip-section").then((m) => ({ default: m.TripSection })));
const TripAnalytics = lazy(() => import("@/components/trip-analytics").then((m) => ({ default: m.TripAnalytics })));
const EcoCard = lazy(() => import("@/components/eco-card").then((m) => ({ default: m.EcoCard })));
const TrendChart = lazy(() => import("@/components/trend-chart").then((m) => ({ default: m.TrendChart })));

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
  ShieldCheck,
  Leaf,
  TrendingDown,
  Upload,
  Fuel,
} from "lucide-react";
import { CountdownRing } from "@/components/countdown-ring";
const CsvImportModal = lazy(() => import("@/components/csv-import-modal").then((m) => ({ default: m.CsvImportModal })));



import {
  getVehicle,
  listRefuels,
  addRefuel,
  deleteRefuel,
  updateRefuel,
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
import { VehicleHealthScore, NextRefuelEstimate, CostProjection } from "@/components/vehicle-insights";

import { searchCatalog, claimedMileage, type CatalogEntry } from "@/lib/vehicle-catalog";
import { getPrefs, PREFS_EVENT, type Prefs } from "@/lib/prefs";
import { FUEL_BRANDS, brandLabel, rememberBrand, recallBrand, type FuelBrandId } from "@/lib/fuel-brands";
import { TripPlannerModal } from "@/components/trip-planner-modal";
import { useIsMobile } from "@/hooks/use-mobile";


export const Route = createFileRoute("/app/vehicle/$id")({
  component: VehiclePage,
  validateSearch: (s: Record<string, unknown>) => ({
    refuel: s.refuel === 1 || s.refuel === "1" ? 1 : undefined,
  }),
});

function VehiclePage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Refuel | null>(null);

  // Auto-open refuel modal when arriving via the mobile "Log fuel" button.
  useEffect(() => {
    if (search.refuel === 1) {
      setShowAdd(true);
      navigate({ to: "/app/vehicle/$id", params: { id }, search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.refuel]);



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
  const isEV = vehicle.data?.fuel_type === "electric";
  const ageReminder = useMemo(() => {
    const y = vehicle.data?.model_year;
    if (!y) return null;
    const age = new Date().getFullYear() - y;
    if (age < 13 || age > 15) return null;
    const yearsLeft = 15 - age;
    return { age, yearsLeft };
  }, [vehicle.data?.model_year]);

  // Live prefs (for depreciation toggle)
  const [prefs, setPrefs] = useState<Prefs>(() => getPrefs());
  useEffect(() => {
    const sync = () => setPrefs(getPrefs());
    window.addEventListener(PREFS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREFS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const renewals = useMemo(() => {
    if (!vehicle.data) return [] as Array<{ kind: "insurance" | "puc"; date: string; daysLeft: number }>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items: Array<{ kind: "insurance" | "puc"; date: string; daysLeft: number }> = [];
    const push = (kind: "insurance" | "puc", date: string | null) => {
      if (!date) return;
      const d = new Date(date);
      const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
      if (diff <= 90) items.push({ kind, date, daysLeft: diff });
    };
    push("insurance", vehicle.data.insurance_expiry);
    push("puc", vehicle.data.puc_expiry);
    return items;
  }, [vehicle.data]);

  const depreciation = useMemo(() => {
    if (!prefs.showDepreciation || !vehicle.data) return null;
    const price = vehicle.data.purchase_price_inr;
    const start = vehicle.data.purchase_date;
    if (!price || price <= 0 || !start) return null;
    const years =
      (Date.now() - new Date(start).getTime()) / (365.25 * 86400000);
    if (years < 0) return null;
    // India-typical reducing-balance: cars 15%/yr, two-wheelers 12%/yr.
    const rate = vehicle.data.icon === "car" ? 0.15 : 0.12;
    const value = Math.max(0, price * Math.pow(1 - rate, years));
    const lost = price - value;
    const pctLost = (lost / price) * 100;
    return { price, value, lost, pctLost, years, rate };
  }, [prefs.showDepreciation, vehicle.data]);


  return (
    <main className="mx-auto max-w-3xl px-4 safe-top pb-28 md:px-6 md:pb-8 animate-fade-in">
      <header className="mb-6 flex items-center justify-between">
        <Link
          to="/app"
          aria-label="Back to dashboard"
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


      {ageReminder && (
        <div className="glass mt-1 mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 animate-fade-in">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 text-xs">
            <div className="text-sm font-medium text-foreground">
              Fitness / RC renewal coming up
            </div>
            <p className="mt-0.5 text-muted-foreground">
              This vehicle is {ageReminder.age} years old. In India, private
              vehicles need a fitness test / re-registration at the 15-year mark
              {ageReminder.yearsLeft === 0
                ? " — that's this year. Book a slot at your RTO."
                : ` — about ${ageReminder.yearsLeft} ${ageReminder.yearsLeft === 1 ? "year" : "years"} left. Plan ahead.`}
            </p>
          </div>
        </div>
      )}

      {renewals.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 animate-fade-in">
          {renewals.map((r) => {
            const expired = r.daysLeft < 0;
            const urgent = r.daysLeft <= 30;
            const tone = expired
              ? "border-red-500/40 bg-red-500/5 text-red-500"
              : urgent
                ? "border-amber-500/40 bg-amber-500/5 text-amber-500"
                : "border-foreground/15 bg-foreground/5 text-foreground";
            const Icon = r.kind === "insurance" ? ShieldCheck : Leaf;
            const label = r.kind === "insurance" ? "Insurance" : "Pollution (PUC)";
            const when = new Date(r.date).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <div
                key={r.kind}
                className={`glass flex items-center gap-3 rounded-2xl border p-4 ${tone}`}
              >
                <CountdownRing daysLeft={r.daysLeft} size={52} stroke={4} />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Icon className="h-4 w-4 shrink-0" />
                    {label} {expired ? "expired" : "renewal due"}
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {expired
                      ? `Lapsed ${Math.abs(r.daysLeft)} day${Math.abs(r.daysLeft) === 1 ? "" : "s"} ago (was ${when}).`
                      : `In ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"} · ${when}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {depreciation && (
        <div className="glass mb-4 rounded-2xl p-5 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Estimated current value
            </div>
            <div className="text-[11px] text-muted-foreground">
              {(depreciation.rate * 100).toFixed(0)}% / yr · reducing balance
            </div>
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-3xl font-light tracking-tight tabular-nums">
              ₹{Math.round(depreciation.value).toLocaleString("en-IN")}
            </div>
            <div className="pb-1 text-xs text-muted-foreground">
              of ₹{Math.round(depreciation.price).toLocaleString("en-IN")}
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full bg-foreground/60"
              style={{
                width: `${Math.min(100, Math.max(0, (depreciation.value / depreciation.price) * 100)).toFixed(1)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            ~{depreciation.years.toFixed(1)} yrs old · lost
            ₹{Math.round(depreciation.lost).toLocaleString("en-IN")} ({depreciation.pctLost.toFixed(0)}%).
            Toggle this off in Settings.
          </p>
        </div>
      )}
      {vehicle.data && (
        <VehicleHealthScore vehicle={vehicle.data} latestOdo={summary.latestOdo} />
      )}



      {isEV ? (
        <div className="glass rounded-2xl p-5 text-sm animate-fade-in">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-lg">⚡️</span> Electric vehicle
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Fuel tracking is disabled for EVs. Use the maintenance log below to
            track services, brake pads, tyres and battery checks.
          </p>
        </div>
      ) : (
        <>
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
          <NextRefuelEstimate
            refuels={refuels.data ?? []}
            summary={summary}
            claimedKmPerL={claimedMileage(vehicle.data.name, vehicle.data.make)}
          />

          <CostProjection refuels={refuels.data ?? []} />

          {vehicle.data && (() => {
            const claimed = claimedMileage(vehicle.data.name, vehicle.data.make);
            if (claimed == null) return null;
            const actual = summary.kmPerL;
            const diff = actual != null ? actual - claimed : null;
            const pct = actual != null ? ((actual - claimed) / claimed) * 100 : null;
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl glass-subtle px-4 py-3 text-xs animate-fade-in">
                <span className="font-medium text-foreground">Company-claimed mileage:</span>
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-semibold tabular-nums">
                  {claimed.toFixed(1)} km/l
                </span>
                {actual != null && diff != null && pct != null && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      diff >= 0
                        ? "bg-primary/15 text-primary"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    You: {actual.toFixed(1)} km/l ({diff >= 0 ? "+" : ""}
                    {pct.toFixed(0)}%)
                  </span>
                )}
                <span className="text-muted-foreground">· ARAI / brand figure</span>
              </div>
            );
          })()}

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

          {summary.anomalies.summary.length > 0 && (
            <div className="mt-3 glass rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="text-xs">
                  <div className="font-medium text-foreground">Data looks unusual</div>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {summary.anomalies.summary.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <Suspense fallback={<div className="glass mt-6 h-52 rounded-2xl animate-pulse" />}>
            <TrendChart chart={summary.chart} refuels={refuels.data ?? []} />
          </Suspense>
        </>
      )}






      {!isEV && (
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Refuel log
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1 rounded-full glass-subtle px-3 py-1.5 text-xs font-medium hover:opacity-90"
              title="Import from CSV (Hammond, Fuelio, etc.)"
            >
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add refuel
            </button>
          </div>
        </div>


        {refuels.isLoading ? (
          <div className="glass flex h-24 items-center justify-center rounded-2xl">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : refuels.data && refuels.data.length > 0 ? (
          <div className="glass overflow-hidden rounded-2xl">
            <div className="hidden grid-cols-12 gap-2 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Odo (km)</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Litres @ rate</div>
              <div className="col-span-2 text-right">Cost / km</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <ul className="divide-y divide-foreground/5">
              {refuels.data.map((r) => {
                const seg = summary.segmentById.get(r.id);
                const flags = summary.anomalies.byId.get(r.id);
                return (
                  <li
                    key={r.id}
                    className="group grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm transition hover:bg-foreground/5"
                  >
                    <div className="col-span-6 md:col-span-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        {flags && (
                          <span
                            title={flags.join("\n")}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-500"
                            aria-label={`Warning: ${flags.join(", ")}`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                        <span>{formatDate(r.refuel_date)}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {!r.full_tank && (
                          <span className="inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium uppercase text-accent-foreground">
                            Partial
                          </span>
                        )}
                        {r.fuel_brand && (
                          <span className="inline-block rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {brandLabel(r.fuel_brand)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-6 text-right md:col-span-2 md:text-left tabular-nums">
                      {r.odo_km != null ? Number(r.odo_km).toFixed(0) : "—"}
                    </div>
                    <div className="col-span-4 text-right md:col-span-2 tabular-nums font-semibold">
                      ₹{Number(r.amount_inr).toFixed(0)}
                    </div>
                    <div className="col-span-4 text-right md:col-span-2 tabular-nums text-muted-foreground">
                      {Number(r.litres).toFixed(2)} L
                      <span className="ml-1 text-[11px]">@ ₹{Number(r.rate_per_litre).toFixed(2)}</span>
                    </div>
                    <div className="col-span-4 text-right md:col-span-2 tabular-nums">
                      {seg ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          ₹{seg.cpk.toFixed(2)}
                          <span className="font-normal text-muted-foreground">/km</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {seg && (
                        <div className="text-[10px] text-muted-foreground">
                          {seg.kmpl.toFixed(1)} km/l · {seg.km.toFixed(0)} km
                        </div>
                      )}
                    </div>
                    <div className="col-span-12 flex items-center justify-end gap-1 md:col-span-2">
                      <button
                        onClick={() => setEditing(r)}
                        className="press rounded-full p-1.5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
                        aria-label="Edit refuel"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this refuel?")) del.mutate(r.id);
                        }}
                        className="press rounded-full p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete refuel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
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
      )}

      <MaintenanceSection vehicleId={id} latestOdo={summary.latestOdo} isEV={!!isEV} />




      {showAdd && vehicle.data && (
        <AddRefuelModal
          vehicle={vehicle.data}
          existingRefuels={refuels.data ?? []}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editing && vehicle.data && (
        <AddRefuelModal
          vehicle={vehicle.data}
          existingRefuels={refuels.data ?? []}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {showImport && (
        <Suspense fallback={null}>
          <CsvImportModal
            vehicleId={id}
            open={showImport}
            onClose={() => setShowImport(false)}
          />
        </Suspense>
      )}


      <Suspense fallback={<div className="glass mt-5 h-40 rounded-3xl animate-pulse" />}>
        <TripSection
          vehicleId={id}
          costPerKm={summary.costPerKm}
          fuelType={(vehicle.data?.fuel_type as FuelType) ?? "petrol"}
          kmPerL={summary.kmPerL}
        />
        <TripAnalytics vehicleId={id} costPerKm={summary.costPerKm} />

        {vehicle.data && (
          <div className="mt-5">
            <EcoCard
              fuelType={(vehicle.data.fuel_type as FuelType) ?? "petrol"}
              totalLitres={summary.totalLitres}
              totalKm={summary.totalKm}
            />
          </div>
        )}
      </Suspense>





      {!isEV && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          aria-label="Log refuel"
          className="fixed z-40 right-4 md:hidden press flex items-center gap-2 rounded-full bg-[var(--mint-accent)] text-stone-900 px-5 py-3 text-sm font-bold shadow-xl"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0) + 1rem)" }}
        >
          <Fuel className="h-4 w-4" /> Log fuel
        </button>
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
  const [insuranceExpiry, setInsuranceExpiry] = useState(vehicle.insurance_expiry ?? "");
  const [pucExpiry, setPucExpiry] = useState(vehicle.puc_expiry ?? "");
  const [purchaseDate, setPurchaseDate] = useState(vehicle.purchase_date ?? "");
  const [purchasePrice, setPurchasePrice] = useState(
    vehicle.purchase_price_inr != null ? String(vehicle.purchase_price_inr) : "",
  );

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
        insurance_expiry: insuranceExpiry || null,
        puc_expiry: pucExpiry || null,
        purchase_date: purchaseDate || null,
        purchase_price_inr: purchasePrice ? Number(purchasePrice) : null,
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

          <div className="rounded-2xl glass-subtle p-3 space-y-3">
            <div className="text-xs font-medium text-muted-foreground">
              Renewals · optional
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Insurance expiry</span>
                <input
                  type="date"
                  value={insuranceExpiry}
                  onChange={(e) => setInsuranceExpiry(e.target.value)}
                  className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">PUC expiry</span>
                <input
                  type="date"
                  value={pucExpiry}
                  onChange={(e) => setPucExpiry(e.target.value)}
                  className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl glass-subtle p-3 space-y-3">
            <div className="text-xs font-medium text-muted-foreground">
              Purchase · for depreciation
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Purchase date</span>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Purchase price (₹)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="e.g. 850000"
                  className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

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
  existingRefuels,
  onClose,
  editing,
}: {
  vehicle: Vehicle;
  existingRefuels: Refuel[];
  onClose: () => void;
  editing?: Refuel | null;
}) {
  const qc = useQueryClient();
  const fetchPrice = useServerFn(fetchFuelPrice);
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(editing?.refuel_date ?? today);
  const [amount, setAmount] = useState(editing ? String(editing.amount_inr) : "");
  const [rate, setRate] = useState(editing ? String(editing.rate_per_litre) : "");
  const [odo, setOdo] = useState(editing?.odo_km != null ? String(editing.odo_km) : "");
  const [fullTank, setFullTank] = useState(
    editing ? editing.full_tank : vehicle.fuel_type === "cng",
  );
  const [fuelSubtype, setFuelSubtype] = useState<"normal" | "e20" | "xp95" | "xp100">(
    (editing?.fuel_subtype as any) ?? "normal",
  );
  const [brand, setBrand] = useState<FuelBrandId | "">(
    (editing?.fuel_brand as FuelBrandId | undefined) ??
      recallBrand(vehicle.id) ??
      "",
  );
  const [fetchingRate, setFetchingRate] = useState(false);

  const [city, setCity] = useState("");

  // Highest odo reading among other refuels (exclude the entry being edited).
  const lastOdo = useMemo(() => {
    const others = existingRefuels.filter(
      (r) => r.id !== editing?.id && r.odo_km != null,
    );
    if (others.length === 0) return null;
    return others.reduce((m, r) => Math.max(m, Number(r.odo_km)), 0);
  }, [existingRefuels, editing?.id]);

  const odoN = odo ? parseFloat(odo) : null;
  const odoError =
    odoN != null && lastOdo != null && odoN <= lastOdo
      ? `Odometer must be greater than the last reading (${lastOdo.toFixed(0)} km).`
      : null;

  useEffect(() => {
    getProfile().then((p) => {
      if (p.default_city) setCity(p.default_city);
    });
  }, []);

  // Auto-fetch rate on open if today's date (skip when editing existing entry).
  useEffect(() => {
    if (editing) return;
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
        data: { city, fuelType: vehicle.fuel_type as "petrol" | "diesel" | "cng" },
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
      if (odoError) throw new Error(odoError);
      const payload = {
        refuel_date: date,
        amount_inr: amountN,
        rate_per_litre: rateN,
        litres: Number(litres.toFixed(3)),
        odo_km: odo ? parseFloat(odo) : null,
        full_tank: fullTank,
        fuel_subtype: vehicle.fuel_type === "petrol" ? fuelSubtype : null,
        fuel_brand: brand || null,
      };
      if (brand) rememberBrand(vehicle.id, brand as FuelBrandId);

      if (editing) {
        await updateRefuel(editing.id, payload);
      } else {
        await addRefuel({ vehicle_id: vehicle.id, ...payload });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Refuel updated" : "Refuel logged");
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
        <h3 className="text-lg font-medium">{editing ? "Edit refuel" : "New refuel"}</h3>
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

          {vehicle.fuel_type === "petrol" && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Petrol variant
              </span>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {[
                  { v: "normal", l: "Normal" },
                  { v: "e20", l: "E20" },
                  { v: "xp95", l: "XP95" },
                  { v: "xp100", l: "XP100" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setFuelSubtype(o.v as any)}
                    className={`press rounded-xl px-2 py-2 text-xs font-medium transition ${
                      fuelSubtype === o.v
                        ? "bg-[var(--mint-accent)] text-stone-900"
                        : "glass-subtle text-muted-foreground"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                E20 = 20% ethanol blend · XP95/XP100 = premium octane
              </p>
            </div>
          )}

          {vehicle.fuel_type !== "electric" && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Fuel station (optional)
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {FUEL_BRANDS.map((b) => {
                  const active = brand === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBrand(active ? "" : b.id)}
                      className={`press rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                        active
                          ? "bg-[var(--mint-accent)] text-stone-900"
                          : "glass-subtle text-muted-foreground"
                      }`}
                    >
                      {b.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          <div>
            <NumField

              label="Odometer (km)"
              value={odo}
              onChange={setOdo}
              placeholder={
                lastOdo != null
                  ? `must be > ${lastOdo.toFixed(0)} km`
                  : "optional, but improves accuracy"
              }
              step="any"
            />
            {lastOdo != null && (
              <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                Last reading: <span className="font-medium tabular-nums text-foreground">{lastOdo.toFixed(0)} km</span>
              </p>
            )}
            {odoError && (
              <p className="mt-1 px-1 text-[11px] font-medium text-destructive">
                {odoError}
              </p>
            )}
          </div>

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
              disabled={mut.isPending || !litres || !!odoError}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {mut.isPending ? "Saving…" : editing ? "Save changes" : "Save refuel"}
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
  fromDate: string;
  fromOdo: number;
  toOdo: number;
  km: number;
  litres: number;
  spend: number;
  kmpl: number;
  cpk: number;
  fuelCount: number;
};

type OrderedRefuel = Refuel & { orderIndex: number };

function fmtShortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function compareRefuelsAsc(a: Refuel, b: Refuel) {
  const byDate = a.refuel_date.localeCompare(b.refuel_date);
  if (byDate !== 0) return byDate;
  return a.created_at.localeCompare(b.created_at);
}

function validNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function litresFromRefuel(r: Refuel) {
  const stored = validNumber(r.litres);
  if (stored > 0) return stored;
  const amount = validNumber(r.amount_inr);
  const rate = validNumber(r.rate_per_litre);
  return amount > 0 && rate > 0 ? amount / rate : 0;
}

function summarizeFuel(refuels: OrderedRefuel[]) {
  return refuels.reduce(
    (sum, r) => ({
      litres: sum.litres + litresFromRefuel(r),
      spend: sum.spend + validNumber(r.amount_inr),
      count: sum.count + 1,
    }),
    { litres: 0, spend: 0, count: 0 },
  );
}

function hasFuelData(r: Refuel) {
  return validNumber(r.amount_inr) > 0 && litresFromRefuel(r) > 0;
}

function fuelBetween(
  asc: OrderedRefuel[],
  prev: OrderedRefuel,
  cur: OrderedRefuel,
) {
  const between = asc.filter(
    (r) => r.orderIndex > prev.orderIndex && r.orderIndex < cur.orderIndex,
  );
  const fuelRowsBetween = between.filter(hasFuelData);
  if (fuelRowsBetween.length > 0) return fuelRowsBetween;

  // Most users enter the fuel spend and odo at the same stop. In that case,
  // the fuel bought at the starting odo reading powers the distance until the
  // next logged odo reading, so use the previous row as the estimate basis.
  if (hasFuelData(prev)) return [prev];

  // If the starting row was odo-only, use the ending refuel as a practical
  // fallback instead of hiding mileage/cost forever.
  if (hasFuelData(cur)) return [cur];
  return between;
}

function makeSegment(
  prev: OrderedRefuel,
  cur: OrderedRefuel,
  fuelRefuels: OrderedRefuel[],
): Segment | null {
  const fromOdo = validNumber(prev.odo_km);
  const toOdo = validNumber(cur.odo_km);
  const km = toOdo - fromOdo;
  if (km <= 0) return null;
  const fuel = summarizeFuel(fuelRefuels);
  if (fuel.litres <= 0 || fuel.spend <= 0) return null;
  return {
    refuelId: cur.id,
    date: fmtShortDate(cur.refuel_date),
    fromDate: prev.refuel_date,
    fromOdo,
    toOdo,
    km,
    litres: fuel.litres,
    spend: fuel.spend,
    kmpl: km / fuel.litres,
    cpk: fuel.spend / km,
    fuelCount: fuel.count,
  };
}

function computeSummary(refuels: Refuel[]) {
  const totalLitres = refuels.reduce((s, r) => s + litresFromRefuel(r), 0);
  const totalSpend = refuels.reduce((s, r) => s + validNumber(r.amount_inr), 0);
  const asc: OrderedRefuel[] = [...refuels]
    .sort(compareRefuelsAsc)
    .map((r, orderIndex) => ({ ...r, orderIndex }));
  const fullsWithOdo = asc.filter((r) => r.full_tank && r.odo_km != null);
  const latestOdo = asc
    .map((r) => (r.odo_km != null ? validNumber(r.odo_km) : null))
    .filter((n): n is number => n != null)
    .reduce((max, n) => (n > max ? n : max), 0) || null;

  const fullTankSegments: Segment[] = [];
  for (let i = 1; i < fullsWithOdo.length; i++) {
    const prev = fullsWithOdo[i - 1];
    const cur = fullsWithOdo[i];
    const segment = makeSegment(
      prev,
      cur,
      asc.filter(
        (r) => r.orderIndex > prev.orderIndex && r.orderIndex <= cur.orderIndex,
      ),
    );
    if (segment) fullTankSegments.push(segment);
  }

  const withOdo = asc.filter((r) => r.odo_km != null);
  const odoSegments: Segment[] = [];
  for (let i = 1; i < withOdo.length; i++) {
    const prev = withOdo[i - 1];
    const cur = withOdo[i];
    const segment = makeSegment(prev, cur, fuelBetween(asc, prev, cur));
    if (segment) odoSegments.push(segment);
  }

  const segments = fullTankSegments.length > 0 ? fullTankSegments : odoSegments;

  // Weighted overall cost/km and mileage based on the odometer segments.
  const totalSegKm = segments.reduce((s, x) => s + x.km, 0);
  const totalSegLitres = segments.reduce((s, x) => s + x.litres, 0);
  const totalSegSpend = segments.reduce((s, x) => s + x.spend, 0);
  const totalKm = totalSegKm > 0 ? totalSegKm : null;
  let kmPerL = totalSegLitres > 0 ? totalSegKm / totalSegLitres : null;
  let costPerKm = totalSegKm > 0 ? totalSegSpend / totalSegKm : null;

  // Track which refuels backed the estimate so we can show a breakdown.
  let basisSource: "segments" | "fallback" | null = null;
  let basisLabel = "";
  let basisDetail = "";

  if (segments.length >= 1) {
    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];
    basisSource = fullTankSegments.length > 0 ? "segments" : "fallback";
    basisLabel =
      fullTankSegments.length > 0
        ? `${segments.length} full-tank segment${segments.length === 1 ? "" : "s"}`
        : `${segments.length} odometer segment${segments.length === 1 ? "" : "s"}`;
    basisDetail =
      fullTankSegments.length > 0
        ? `${fmtShortDate(firstSeg.fromDate)} (${firstSeg.fromOdo.toFixed(0)} km) → ${lastSeg.date} (${lastSeg.toOdo.toFixed(0)} km). Fuel counted from refuels up to each full tank: ${totalSegKm.toFixed(0)} km on ${totalSegLitres.toFixed(2)} L (₹${totalSegSpend.toFixed(0)}).`
        : `${fmtShortDate(firstSeg.fromDate)} (${firstSeg.fromOdo.toFixed(0)} km) → ${lastSeg.date} (${lastSeg.toOdo.toFixed(0)} km). Fuel counted from the first refuel in each odo span: ${totalSegKm.toFixed(0)} km on ${totalSegLitres.toFixed(2)} L (₹${totalSegSpend.toFixed(0)}).`;
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
    const hasPositiveOdoSpan = odoSegments.length > 0 || withOdo.some((r, i) => {
      if (i === 0) return false;
      return validNumber(r.odo_km) > validNumber(withOdo[i - 1].odo_km);
    });
    if (withOdo.length >= 2 && !hasPositiveOdoSpan) {
      missing.push("A later odometer reading that is higher than the previous one.");
    }
    // Fuel at the first odo reading drives the first odo-span estimate.
    const fuelFromFirstSpan =
      withOdo.length >= 2
        ? summarizeFuel(fuelBetween(asc, withOdo[0], withOdo[1]))
        : null;
    if (fuelFromFirstSpan && (fuelFromFirstSpan.litres <= 0 || fuelFromFirstSpan.spend <= 0)) {
      missing.push("First ₹ spend and fuel rate — the app uses the fuel bought at the first odo reading for the next odo span.");
    }
    const missingRate = asc.some(
      (r) => validNumber(r.amount_inr) > 0 && validNumber(r.rate_per_litre) <= 0,
    );
    if (missingRate) {
      missing.push("Fuel rate (₹/L) for any refuel where you entered ₹ spend.");
    }
  }

  const segmentById = new Map(segments.map((s) => [s.refuelId, s]));
  const anomalies = detectAnomalies(asc, segments);

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
    anomalies,
  };
}

// Flag suspicious refuels so the user can spot typos or mis-logged entries.
function detectAnomalies(
  asc: OrderedRefuel[],
  segments: Segment[],
): { byId: Map<string, string[]>; summary: string[] } {
  const byId = new Map<string, string[]>();
  const push = (id: string, msg: string) => {
    const arr = byId.get(id) ?? [];
    arr.push(msg);
    byId.set(id, arr);
  };

  // Median segment km/L as a baseline for outliers.
  const kmpls = segments.map((s) => s.kmpl).sort((a, b) => a - b);
  const median = kmpls.length ? kmpls[Math.floor(kmpls.length / 2)] : null;

  // Per-refuel row checks.
  let prevWithOdo: OrderedRefuel | null = null;
  for (const r of asc) {
    const amount = validNumber(r.amount_inr);
    const rate = validNumber(r.rate_per_litre);
    const litres = validNumber(r.litres);
    const odo = r.odo_km != null ? validNumber(r.odo_km) : null;

    if (amount > 0 && rate <= 0) push(r.id, "Missing fuel rate (₹/L).");
    if (amount <= 0 && litres <= 0) push(r.id, "No amount or litres recorded.");
    if (litres > 100) push(r.id, `Unusually large fill (${litres.toFixed(1)} L).`);
    if (rate > 0 && (rate < 40 || rate > 200)) {
      push(r.id, `Fuel rate ₹${rate.toFixed(2)}/L looks off.`);
    }
    if (odo != null) {
      if (prevWithOdo) {
        const prevOdo = validNumber(prevWithOdo.odo_km);
        if (odo < prevOdo) push(r.id, `Odometer went backwards (was ${prevOdo.toFixed(0)} km).`);
        else if (odo === prevOdo && r.refuel_date !== prevWithOdo.refuel_date) {
          push(r.id, "Same odometer as previous refuel.");
        } else {
          const gap = odo - prevOdo;
          if (gap > 3000) push(r.id, `Big odo jump (+${gap.toFixed(0)} km) — check the reading.`);
        }
      }
      prevWithOdo = r;
    }
  }

  // Segment-level outliers (extreme km/L vs median).
  for (const s of segments) {
    if (s.kmpl < 3) push(s.refuelId, `Very low mileage (${s.kmpl.toFixed(1)} km/L) for this span.`);
    else if (s.kmpl > 60) push(s.refuelId, `Very high mileage (${s.kmpl.toFixed(1)} km/L) — possible odo/litres error.`);
    if (median != null && median > 0) {
      const ratio = s.kmpl / median;
      if (ratio < 0.5) push(s.refuelId, `Mileage ~${Math.round((1 - ratio) * 100)}% below your usual.`);
      else if (ratio > 1.8) push(s.refuelId, `Mileage ~${Math.round((ratio - 1) * 100)}% above your usual.`);
    }
  }

  // Same-day duplicate refuels.
  const byDate = new Map<string, OrderedRefuel[]>();
  for (const r of asc) {
    const arr = byDate.get(r.refuel_date) ?? [];
    arr.push(r);
    byDate.set(r.refuel_date, arr);
  }
  for (const [date, rows] of byDate) {
    if (rows.length > 1) {
      for (const r of rows) push(r.id, `Multiple refuels logged on ${fmtShortDate(date)}.`);
    }
  }

  const summary: string[] = [];
  const flagged = byId.size;
  if (flagged > 0) {
    summary.push(
      `${flagged} refuel${flagged === 1 ? "" : "s"} flagged — tap the ⚠ icon or edit to fix.`,
    );
  }
  return { byId, summary };
}







// ---------- Maintenance log ----------

function MaintenanceSection({
  vehicleId,
  latestOdo,
  isEV = false,
}: {
  vehicleId: string;
  latestOdo: number | null;
  isEV?: boolean;
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
          isEV={isEV}
          onClose={() => setShowAdd(false)}
        />
      )}
    </section>
  );
}


function AddMaintenanceModal({
  vehicleId,
  latestOdo,
  isEV = false,
  onClose,
}: {
  vehicleId: string;
  latestOdo: number | null;
  isEV?: boolean;
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

  const presets = isEV
    ? [
        "General service",
        "Brake pads",
        "Brake fluid",
        "Tyre check",
        "Tyre rotation",
        "Tyre replacement",
        "Battery health check",
        "Coolant (battery)",
        "Cabin filter",
        "Software update",
      ]
    : [
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


