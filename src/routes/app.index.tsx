import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  History,
  Search,
} from "lucide-react";
import {
  listVehicles,
  addVehicle,
  dashboardStats,
  listRecentRefuels,
  getProfile,
  type VehicleIcon as VIcon,
} from "@/lib/data-store";
import { useAuthed } from "@/lib/use-authed";
import { ThemeToggle } from "@/components/theme-toggle";
import { VehicleIcon, VEHICLE_ICONS } from "@/components/vehicle-icon";
import { VehicleAvatar } from "@/components/vehicle-avatar";
import { searchCatalog, type CatalogEntry } from "@/lib/vehicle-catalog";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function greetingFor(name: string) {
  const h = new Date().getHours();
  const slot =
    h < 5 ? "Burning the midnight oil" :
    h < 12 ? "Good morning" :
    h < 17 ? "Good afternoon" :
    h < 21 ? "Good evening" :
    "Good night";
  const flavours = ["Happy riding", "Safe travels", "Drive safe"];
  const flavour = flavours[new Date().getDate() % flavours.length];
  const who = name ? `, ${name}` : "";
  // Alternate greeting style across the day for variety.
  return (h % 2 === 0 ? slot : flavour) + who;
}

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

  const recent = useQuery({
    queryKey: ["recent-refuels", authed],
    queryFn: () => listRecentRefuels(8),
    enabled: authed !== null,
  });

  const profile = useQuery({
    queryKey: ["profile", authed],
    queryFn: getProfile,
    enabled: authed !== null,
  });

  const name = (profile.data?.display_name ?? "").trim();
  const [greeting, setGreeting] = useState<string>(name ? `Hello, ${name}` : "Hello");
  useEffect(() => {
    setGreeting(greetingFor(name));
  }, [name]);


  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/app" });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-center justify-between animate-fade-in-up">
        <div className="flex items-center gap-2">
          <div className="glass flex h-9 w-9 items-center justify-center rounded-xl">
            <Fuel className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-medium tracking-tight">PitStop</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/app/settings"
            className="glass glass-hover press flex h-9 w-9 items-center justify-center rounded-full"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          {authed ? (
            <button
              onClick={signOut}
              className="glass glass-hover press flex h-9 w-9 items-center justify-center rounded-full"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="glass glass-hover press flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
              aria-label="Sign in"
            >
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-light tracking-tight md:text-4xl">
          {greeting}
          <span className="text-primary">.</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's how your garage is doing.
        </p>
      </section>

      {authed === false && (
        <div className="glass-subtle mb-6 rounded-2xl px-4 py-3 text-xs text-muted-foreground animate-fade-in">
          You're using PitStop as a guest — data stays in this browser only.{" "}
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to sync across devices.
        </div>
      )}

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Total spent", value: `₹${(stats.data?.spend ?? 0).toFixed(0)}` },
          { label: "Litres", value: (stats.data?.litres ?? 0).toFixed(1) },
          { label: "Refuels", value: `${stats.data?.count ?? 0}` },
        ].map((s, i) => (
          <div
            key={s.label}
            className="stagger"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Stat label={s.label} value={s.value} />
          </div>
        ))}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Your vehicles
          </h2>
          <button
            onClick={() => setShowAdd(true)}
            className="press flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
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
            {vehicles.data.map((v, i) => (
              <Link
                key={v.id}
                to="/app/vehicle/$id"
                params={{ id: v.id }}
                className="glass glass-hover hover-lift press stagger flex items-center justify-between rounded-2xl p-4"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <VehicleAvatar vehicle={v} size={44} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {v.make ? `${v.make} ${v.name}` : v.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className="capitalize">{v.fuel_type}</span>
                      {v.model_year ? ` · ${v.model_year}` : ""}
                      {v.reg_number ? ` · ${v.reg_number}` : ""}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center animate-scale-in">
            <Car className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No vehicles yet. Add your first one to start logging refuels.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="press mt-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Add vehicle
            </button>
          </div>
        )}
      </section>

      {recent.data && recent.data.length > 0 && (
        <section className="mt-8 animate-fade-in">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Recent fuel history
            </h2>
          </div>
          <div className="glass divide-y divide-border/40 rounded-2xl overflow-hidden">
            {recent.data.map((r, i) => (
              <Link
                key={r.id}
                to="/app/vehicle/$id"
                params={{ id: r.vehicle_id }}
                className="stagger flex items-center justify-between px-4 py-3 transition hover:bg-foreground/5"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <VehicleIcon
                      icon={r.vehicle_icon}
                      className="h-4 w-4 text-primary"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {r.vehicle_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatShortDate(r.refuel_date)} ·{" "}
                      {Number(r.litres).toFixed(2)} L
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    ₹{Number(r.amount_inr).toFixed(0)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    @ ₹{Number(r.rate_per_litre).toFixed(2)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} />}
    </main>
  );
}

function formatShortDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass hover-lift rounded-2xl p-4">
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
  const [icon, setIcon] = useState<VIcon>("car");
  const [make, setMake] = useState("");
  const [year, setYear] = useState("");
  const [reg, setReg] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const suggestions = useMemo<CatalogEntry[]>(
    () => (name.trim().length >= 1 ? searchCatalog(name, 6) : []),
    [name],
  );

  const mut = useMutation({
    mutationFn: () =>
      addVehicle({
        name: name.trim(),
        fuel_type: fuelType,
        icon,
        make: make.trim() || null,
        model_year: year ? Number(year) : null,
        reg_number: reg.trim() ? reg.trim().toUpperCase() : null,
        image_url: imageUrl.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Vehicle added");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function applySuggestion(s: CatalogEntry) {
    setName(s.model);
    setMake(s.make);
    setIcon(s.type);
    setFuelType(s.fuel);
    if (s.image && !imageUrl) setImageUrl(s.image);
    setShowSuggestions(false);
    if (!showDetails) setShowDetails(true);
  }

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

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
            vehicle={{
              icon,
              make: make || null,
              image_url: imageUrl || null,
              name,
            }}
            size={52}
          />
          <div>
            <h3 className="text-lg font-medium">Add vehicle</h3>
            <p className="text-xs text-muted-foreground">
              Type a model — we'll suggest the make.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) mut.mutate();
          }}
          className="mt-5 space-y-4"
        >
          <div className="relative">
            <span className="text-xs font-medium text-muted-foreground">
              Model
            </span>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="e.g. i20, Swift, Activa"
                maxLength={60}
                required
                className="w-full rounded-xl glass-input glass-input-focus pl-9 pr-4 py-3 text-sm"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="glass animate-fade-in mt-2 max-h-56 overflow-y-auto rounded-xl p-1">
                {suggestions.map((s) => (
                  <button
                    key={`${s.make}-${s.model}`}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="press flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-foreground/5"
                  >
                    <VehicleAvatar
                      vehicle={{
                        icon: s.type,
                        make: s.make,
                        image_url: s.image ?? null,
                      }}
                      size={32}
                      rounded="rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {s.make} {s.model}
                      </div>
                      <div className="text-[11px] capitalize text-muted-foreground">
                        {s.type} · {s.fuel}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Vehicle type
            </span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {VEHICLE_ICONS.map((opt) => {
                const active = icon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIcon(opt.id)}
                    className={`press flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-xs font-medium transition ${
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
                  className={`press rounded-xl px-4 py-3 text-sm font-medium capitalize transition ${
                    fuelType === f
                      ? "bg-primary text-primary-foreground"
                      : "glass-subtle glass-hover"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="press w-full rounded-xl glass-subtle px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showDetails ? "Hide" : "Add"} optional details
          </button>

          {showDetails && (
            <div className="animate-fade-in space-y-3 rounded-xl glass-subtle p-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  Make
                </span>
                <input
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="e.g. Hyundai"
                  maxLength={40}
                  className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">
                    Year
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1950}
                    max={currentYear + 1}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder={`${currentYear}`}
                    className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">
                    Reg. number
                  </span>
                  <input
                    value={reg}
                    onChange={(e) => setReg(e.target.value.toUpperCase())}
                    placeholder="KL 01 AB 1234"
                    maxLength={20}
                    className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm uppercase"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  Photo URL
                </span>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Auto-filled from suggestions when available.
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="press flex-1 rounded-xl glass-subtle glass-hover py-3 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending || !name.trim()}
              className="press flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {mut.isPending ? "Adding…" : "Add vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
