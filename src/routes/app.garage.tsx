import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Plus, Fuel, Gauge } from "lucide-react";
import { useMemo, useState } from "react";
import { listVehicles, listAllRefuels, type Vehicle, type Refuel } from "@/lib/data-store";
import { VehicleIcon } from "@/components/vehicle-icon";

import { MobileActionBar } from "@/components/mobile-action-bar";

export const Route = createFileRoute("/app/garage")({
  component: GaragePage,
});

function GaragePage() {
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const refuels = useQuery({ queryKey: ["refuels-all"], queryFn: listAllRefuels });
  const [showAdd, setShowAdd] = useState(false);

  const summaries = useMemo(() => {
    const map = new Map<string, VehicleSummary>();
    const all = refuels.data ?? [];
    for (const v of vehicles.data ?? []) map.set(v.id, summarize(v, all));
    return map;
  }, [vehicles.data, refuels.data]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8 pb-32 md:pb-12">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/app"
            className="glass press flex h-9 w-9 items-center justify-center rounded-full hover-lift shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-light tracking-tight">Garage</h1>
            <p className="text-xs text-muted-foreground">
              {(vehicles.data?.length ?? 0)} vehicle
              {(vehicles.data?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="press flex items-center gap-1.5 rounded-full bg-foreground text-background px-3.5 py-2 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </header>

      {vehicles.isLoading ? (
        <div className="glass h-24 rounded-2xl animate-pulse" />
      ) : (vehicles.data?.length ?? 0) === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <ul className="space-y-3">
          {vehicles.data!.map((v) => (
            <li key={v.id}>
              <VehicleCard vehicle={v} summary={summaries.get(v.id)!} />
            </li>
          ))}
        </ul>
      )}

      <AddVehicleModal open={showAdd} onClose={() => setShowAdd(false)} />
      <MobileActionBar />
    </main>
  );
}

type VehicleSummary = {
  count: number;
  spend: number;
  litres: number;
  lastOdo: number | null;
  lastDate: string | null;
  kmpl: number | null;
};

function summarize(v: Vehicle, all: Refuel[]): VehicleSummary {
  const mine = all.filter((r) => r.vehicle_id === v.id);
  if (mine.length === 0)
    return { count: 0, spend: 0, litres: 0, lastOdo: null, lastDate: null, kmpl: null };

  const spend = mine.reduce((s, r) => s + Number(r.amount_inr || 0), 0);
  const litres = mine.reduce((s, r) => s + Number(r.litres || 0), 0);
  // Sorted desc already by listAllRefuels
  const lastDate = mine[0]?.refuel_date ?? null;
  const odos = mine.map((r) => r.odo_km).filter((x): x is number => typeof x === "number" && x > 0);
  const lastOdo = odos.length ? Math.max(...odos) : null;
  const minOdo = odos.length ? Math.min(...odos) : null;
  let kmpl: number | null = null;
  if (lastOdo && minOdo && lastOdo > minOdo && litres > 0) {
    kmpl = (lastOdo - minOdo) / litres;
  }
  return { count: mine.length, spend, litres, lastOdo, lastDate, kmpl };
}

function VehicleCard({ vehicle, summary }: { vehicle: Vehicle; summary: VehicleSummary }) {
  return (
    <Link
      to="/app/vehicle/$id"
      params={{ id: vehicle.id }}
      className="press group block rounded-3xl border border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/5 transition p-4"
    >
      <div className="flex items-center gap-3">
        {vehicle.image_url ? (
          <img
            src={vehicle.image_url}
            alt=""
            className="h-12 w-12 rounded-2xl object-cover shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-foreground/5 flex items-center justify-center shrink-0">
            <VehicleIcon icon={vehicle.icon ?? "car"} className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold truncate">
              {vehicle.make ? `${vehicle.make} ${vehicle.name}` : vehicle.name}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition" />
          </div>
          <div className="text-[11px] text-muted-foreground capitalize truncate">
            {vehicle.fuel_type}
            {vehicle.reg_number ? ` · ${vehicle.reg_number}` : ""}
            {vehicle.model_year ? ` · ${vehicle.model_year}` : ""}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat
          label="Spent"
          value={summary.spend > 0 ? `₹${formatCompact(summary.spend)}` : "—"}
          sub={`${summary.count} refuel${summary.count === 1 ? "" : "s"}`}
        />
        <Stat
          label="Mileage"
          value={summary.kmpl ? `${summary.kmpl.toFixed(1)}` : "—"}
          sub={summary.kmpl ? "km/l" : "no data"}
          icon={<Fuel className="h-3 w-3" />}
        />
        <Stat
          label="Last ODO"
          value={summary.lastOdo ? formatCompact(summary.lastOdo) : "—"}
          sub={summary.lastOdo ? "km" : "no data"}
          icon={<Gauge className="h-3 w-3" />}
        />
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-foreground/[0.04] p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5">
        <LayoutIcon />
      </div>
      <h2 className="text-lg font-semibold">No vehicles yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your first vehicle to start tracking fuel and maintenance.
      </p>
      <button
        onClick={onAdd}
        className="press mt-4 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" /> Add vehicle
      </button>
    </div>
  );
}

function LayoutIcon() {
  return <Fuel className="h-5 w-5 text-muted-foreground" />;
}

function formatCompact(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return n.toLocaleString("en-IN");
  return Math.round(n).toLocaleString("en-IN");
}
