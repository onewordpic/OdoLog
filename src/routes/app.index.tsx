import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Fuel,
  Plus,
  LogOut,
  LogIn,
  Car,
  ChevronRight,
  Loader2,
  Settings,
} from "lucide-react";
import {
  listVehicles,
  addVehicle,
  dashboardStats,
} from "@/lib/data-store";
import { useAuthed } from "@/lib/use-authed";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const authed = useAuthed();
  const [showAdd, setShowAdd] = useState(false);

  const vehicles = useQuery({
    queryKey: ["vehicles", authed],
    queryFn: listVehicles,
    enabled: authed !== null,
  });

  const stats = useQuery({
    queryKey: ["dashboard-stats", authed],
    queryFn: dashboardStats,
    enabled: authed !== null,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/app" });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="glass flex h-9 w-9 items-center justify-center rounded-xl">
            <Fuel className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-medium tracking-tight">Fuelogue</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/settings"
            className="glass flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/60"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          {authed ? (
            <button
              onClick={signOut}
              className="glass flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/60"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="glass flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium hover:bg-white/60"
              aria-label="Sign in"
            >
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
        </div>
      </header>

      {authed === false && (
        <div className="glass-subtle mb-6 rounded-2xl px-4 py-3 text-xs text-muted-foreground">
          You're using Fuelogue as a guest — data stays in this browser only.{" "}
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to sync across devices.
        </div>
      )}

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Total spent" value={`₹${(stats.data?.spend ?? 0).toFixed(0)}`} />
        <Stat label="Litres" value={(stats.data?.litres ?? 0).toFixed(1)} />
        <Stat label="Refuels" value={`${stats.data?.count ?? 0}`} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Your vehicles
          </h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add vehicle
          </button>
        </div>

        {vehicles.isLoading ? (
          <div className="glass flex h-24 items-center justify-center rounded-2xl">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : vehicles.data && vehicles.data.length > 0 ? (
          <div className="space-y-2">
            {vehicles.data.map((v) => (
              <Link
                key={v.id}
                to="/app/vehicle/$id"
                params={{ id: v.id }}
                className="glass flex items-center justify-between rounded-2xl p-4 transition hover:bg-white/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Car className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {v.fuel_type}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center">
            <Car className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No vehicles yet. Add your first one to start logging refuels.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Add vehicle
            </button>
          </div>
        )}
      </section>

      {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-light tracking-tight">{value}</div>
    </div>
  );
}

function AddVehicleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fuelType, setFuelType] = useState<"petrol" | "diesel">("petrol");

  const mut = useMutation({
    mutationFn: () => addVehicle({ name: name.trim(), fuel_type: fuelType }),
    onSuccess: () => {
      toast.success("Vehicle added");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
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
        className="glass w-full max-w-md rounded-t-3xl p-6 md:rounded-3xl"
      >
        <h3 className="text-lg font-medium">Add vehicle</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Give it a memorable name.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) mut.mutate();
          }}
          className="mt-5 space-y-4"
        >
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Name
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Activa, Swift"
              maxLength={50}
              required
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
            />
          </label>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Fuel type
            </span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["petrol", "diesel"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFuelType(f)}
                  className={`rounded-xl px-4 py-3 text-sm font-medium capitalize transition ${
                    fuelType === f
                      ? "bg-primary text-primary-foreground"
                      : "glass-subtle hover:bg-white/60"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl glass-subtle py-3 text-sm font-medium hover:bg-white/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending || !name.trim()}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {mut.isPending ? "Adding…" : "Add vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
