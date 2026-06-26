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
  BellRing,
  BarChart3,
  Wrench,
} from "lucide-react";
import {
  listVehicles,
  addVehicle,
  dashboardStats,
  listRecentRefuels,
  listAllMaintenance,
  getProfile,
  type VehicleIcon as VIcon,
} from "@/lib/data-store";
import { PREFS_EVENT, getPrefs, type Prefs } from "@/lib/prefs";
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

  const totalSpent = stats.data?.spend ?? 0;
  const totalLitres = stats.data?.litres ?? 0;
  const refuelCount = stats.data?.count ?? 0;
  const vehicleCount = vehicles.data?.length ?? 0;
  const featured = vehicles.data?.[0];
  const latest = recent.data?.[0];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      {/* Top bar */}
      <header className="mb-6 flex items-center justify-between animate-fade-in-up">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ink text-[var(--mint-accent)]">
            <Fuel className="h-4 w-4" />
          </div>
          <span className="text-lg font-display font-bold tracking-tight">OdoLog</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/app/analytics"
            className="press flex h-9 w-9 items-center justify-center rounded-full bg-white border border-black/5 hover:bg-[var(--mint)] transition"
            aria-label="Analytics"
          >
            <BarChart3 className="h-4 w-4" />
          </Link>
          <Link
            to="/app/settings"
            className="press flex h-9 w-9 items-center justify-center rounded-full bg-white border border-black/5 hover:bg-[var(--mint)] transition"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          {authed ? (
            <button
              onClick={signOut}
              className="press flex h-9 w-9 items-center justify-center rounded-full bg-white border border-black/5 hover:bg-[var(--mint)] transition"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="press flex h-9 items-center gap-1.5 rounded-full bg-ink text-[var(--mint-accent)] px-4 text-xs font-semibold"
            >
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
        </div>
      </header>

      {authed === false && (
        <div className="mb-4 rounded-2xl bg-[var(--sand)] border border-black/5 px-4 py-2.5 text-xs animate-fade-in">
          Guest mode — data stays in this browser.{" "}
          <Link to="/auth" className="font-semibold underline">Sign in</Link> to sync.
        </div>
      )}

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 md:auto-rows-[140px] gap-4">

        {/* Greeting tile */}
        <div className="md:col-span-8 md:row-span-2 rounded-[2rem] p-7 md:p-9 flex flex-col justify-between border border-black/5 stagger"
             style={{ background: "var(--mint)", animationDelay: "0ms" }}>
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05]">
              {greeting}<span className="text-[var(--mint-accent)]">.</span>
            </h1>
            <p className="mt-2 text-base text-black/70">
              {vehicleCount > 0
                ? `${vehicleCount} ${vehicleCount === 1 ? "vehicle" : "vehicles"} · ${refuelCount} refuel${refuelCount === 1 ? "" : "s"} logged`
                : "Add your first vehicle to start tracking."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-6">
            <button
              onClick={() => setShowAdd(true)}
              className="press inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-[var(--mint-accent)] rounded-full text-sm font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Add vehicle
            </button>
            {featured && (
              <Link
                to="/app/vehicle/$id"
                params={{ id: featured.id }}
                className="press inline-flex items-center gap-1.5 px-4 py-2 bg-white rounded-full text-sm font-medium border border-black/5"
              >
                Log refuel <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Total spend (ink) */}
        <div className="md:col-span-4 md:row-span-2 rounded-[2rem] p-7 flex flex-col justify-between text-white stagger"
             style={{ background: "var(--ink)", animationDelay: "60ms" }}>
          <div className="flex items-start justify-between">
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-60">Total spent</span>
            <div className="w-9 h-9 rounded-full bg-[var(--mint-accent)] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-ink rounded-full" />
            </div>
          </div>
          <div>
            <div className="font-display text-5xl font-bold tracking-tight">
              ₹{totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-sm text-[var(--mint-accent)] mt-1">
              Across {refuelCount} refuel{refuelCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* Litres */}
        <div className="md:col-span-3 md:row-span-2 rounded-[2rem] p-6 flex flex-col justify-between border border-black/5 stagger"
             style={{ background: "var(--sand)", animationDelay: "120ms" }}>
          <span className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-60">Litres</span>
          <div>
            <div className="font-display text-3xl font-bold tracking-tight">
              {totalLitres.toFixed(1)}<span className="text-base ml-1 opacity-50">L</span>
            </div>
            <div className="h-1 w-full bg-black/10 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-ink rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalLitres / Math.max(50, totalLitres)) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Refuels */}
        <div className="md:col-span-3 md:row-span-2 rounded-[2rem] p-6 flex flex-col justify-between bg-white border border-black/5 stagger"
             style={{ animationDelay: "180ms" }}>
          <span className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-60">Refuels</span>
          <div>
            <div className="font-display text-3xl font-bold tracking-tight">
              {refuelCount}
            </div>
            <p className="text-xs mt-2 text-black/40">
              {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"} tracked
            </p>
          </div>
        </div>

        {/* Recent refuels */}
        <div className="md:col-span-6 md:row-span-4 rounded-[2rem] p-7 bg-white border border-black/5 flex flex-col stagger"
             style={{ animationDelay: "240ms" }}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-display text-xl font-bold flex items-center gap-2">
              <History className="h-4 w-4 opacity-60" /> Recent refuels
            </h3>
          </div>
          {recent.isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : recent.data && recent.data.length > 0 ? (
            <div className="space-y-3 overflow-y-auto">
              {recent.data.slice(0, 5).map((r) => (
                <Link
                  key={r.id}
                  to="/app/vehicle/$id"
                  params={{ id: r.vehicle_id }}
                  className="press flex items-center justify-between p-3 bg-[#f7f7f5] hover:bg-[var(--mint)] rounded-2xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-[var(--sand)] rounded-xl flex items-center justify-center shrink-0">
                      <VehicleIcon icon={r.vehicle_icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.vehicle_name}</p>
                      <p className="text-[11px] opacity-50">
                        {formatShortDate(r.refuel_date)} · {Number(r.litres).toFixed(2)} L
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold">₹{Number(r.amount_inr).toFixed(0)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-sm text-black/50">
              <History className="h-6 w-6 mb-2 opacity-40" />
              No refuels logged yet.
            </div>
          )}
        </div>

        {/* Featured vehicle tile (mint-accent) */}
        <div className="md:col-span-6 md:row-span-2 rounded-[2rem] p-7 relative overflow-hidden group stagger"
             style={{ background: "var(--mint-accent)", animationDelay: "300ms" }}>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/60">
              {featured ? "Active vehicle" : "Your garage"}
            </span>
            {featured ? (
              <Link to="/app/vehicle/$id" params={{ id: featured.id }} className="block">
                <h4 className="font-display text-3xl font-extrabold mt-1 leading-tight">
                  {featured.make ? `${featured.make} ${featured.name}` : featured.name}
                </h4>
                <p className="text-sm font-medium text-black/70 mt-1">
                  <span className="capitalize">{featured.fuel_type}</span>
                  {featured.model_year ? ` · ${featured.model_year}` : ""}
                  {featured.reg_number ? ` · ${featured.reg_number}` : ""}
                </p>
                <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold">
                  Open <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            ) : (
              <>
                <h4 className="font-display text-2xl font-extrabold mt-1">Empty garage</h4>
                <button
                  onClick={() => setShowAdd(true)}
                  className="press mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white rounded-full text-sm font-semibold w-fit"
                >
                  <Plus className="h-3.5 w-3.5" /> Add vehicle
                </button>
              </>
            )}
          </div>
          <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-ink/10 group-hover:scale-110 transition-transform duration-500" />
        </div>

        {/* Vehicles list */}
        <div className="md:col-span-6 md:row-span-2 rounded-[2rem] p-6 bg-white border border-black/5 flex flex-col stagger"
             style={{ animationDelay: "360ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold">Your vehicles</h3>
            <button
              onClick={() => setShowAdd(true)}
              className="press flex items-center gap-1 rounded-full bg-ink text-white px-3 py-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {vehicles.isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : vehicles.data && vehicles.data.length > 0 ? (
            <div className="space-y-2 overflow-y-auto">
              {vehicles.data.map((v) => (
                <Link
                  key={v.id}
                  to="/app/vehicle/$id"
                  params={{ id: v.id }}
                  className="press flex items-center justify-between p-3 hover:bg-[var(--mint)] rounded-2xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <VehicleAvatar vehicle={v} size={36} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {v.make ? `${v.make} ${v.name}` : v.name}
                      </div>
                      <div className="text-[11px] capitalize opacity-50">{v.fuel_type}</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-sm opacity-50">
              <Car className="h-6 w-6 mb-2 opacity-50" />
              No vehicles yet
            </div>
          )}
        </div>

      </div>

      <ServiceAlerts authed={authed} />

      {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} />}
    </main>
  );
}

function formatShortDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function AddVehicleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fuelType, setFuelType] = useState<"petrol" | "diesel" | "cng">("petrol");
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
              {(["petrol", "diesel", "cng"] as const).map((f) => (
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

// ---------- Service due / upcoming alerts (across all vehicles) ----------

type Status = "due" | "upcoming";

function ServiceAlerts({ authed }: { authed: boolean | null }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    setPrefs(getPrefs());
    function onChange() {
      setPrefs(getPrefs());
    }
    window.addEventListener(PREFS_EVENT, onChange);
    return () => window.removeEventListener(PREFS_EVENT, onChange);
  }, []);

  const maint = useQuery({
    queryKey: ["all-maintenance", authed],
    queryFn: listAllMaintenance,
    enabled: authed !== null,
  });

  // Pull a generous slice of refuels to compute latest odo per vehicle.
  const refuels = useQuery({
    queryKey: ["recent-refuels-odo", authed],
    queryFn: () => listRecentRefuels(2000),
    enabled: authed !== null,
  });

  const items = useMemo(() => {
    if (!prefs || !prefs.serviceAlertsEnabled) return [];
    if (!maint.data || !refuels.data) return [];

    const latestOdoByVehicle = new Map<string, number>();
    for (const r of refuels.data) {
      if (r.odo_km == null) continue;
      const odo = Number(r.odo_km);
      const prev = latestOdoByVehicle.get(r.vehicle_id) ?? 0;
      if (odo > prev) latestOdoByVehicle.set(r.vehicle_id, odo);
    }

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const leadDate = new Date(today);
    leadDate.setDate(leadDate.getDate() + prefs.reminderLeadDays);
    const leadISO = leadDate.toISOString().slice(0, 10);

    const out: {
      id: string;
      vehicle_id: string;
      vehicle_name: string;
      vehicle_icon: VIcon;
      service_type: string;
      detail: string;
      status: Status;
    }[] = [];

    for (const m of maint.data) {
      const latestOdo = latestOdoByVehicle.get(m.vehicle_id) ?? null;
      let status: Status | null = null;
      const detailParts: string[] = [];

      if (m.next_service_date) {
        if (m.next_service_date <= todayISO) {
          status = "due";
          detailParts.push(`by ${m.next_service_date}`);
        } else if (m.next_service_date <= leadISO) {
          status = status ?? "upcoming";
          detailParts.push(`due ${m.next_service_date}`);
        }
      }

      if (m.next_service_odo_km != null && latestOdo != null) {
        const target = Number(m.next_service_odo_km);
        const remaining = target - latestOdo;
        if (remaining <= 0) {
          status = "due";
          detailParts.push(`at ${target.toFixed(0)} km`);
        } else if (remaining <= prefs.reminderLeadKm) {
          status = status ?? "upcoming";
          detailParts.push(`in ${remaining.toFixed(0)} km`);
        }
      }

      if (!status) continue;
      out.push({
        id: m.id,
        vehicle_id: m.vehicle_id,
        vehicle_name: m.vehicle_name,
        vehicle_icon: m.vehicle_icon,
        service_type: m.service_type,
        detail: detailParts.join(" · "),
        status,
      });
    }

    // Due first, then upcoming.
    return out.sort((a, b) =>
      a.status === b.status ? 0 : a.status === "due" ? -1 : 1,
    );
  }, [prefs, maint.data, refuels.data]);

  if (items.length === 0) return null;
  const dueCount = items.filter((i) => i.status === "due").length;

  return (
    <section className="mt-6 animate-fade-in-up">
      <div className="mb-3 flex items-center gap-2">
        <BellRing className="h-3.5 w-3.5 text-destructive" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Service reminders
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {dueCount > 0 ? `${dueCount} due` : `${items.length} upcoming`}
        </span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 6).map((i) => (
          <Link
            key={i.id}
            to="/app/vehicle/$id"
            params={{ id: i.vehicle_id }}
            className={`glass glass-hover hover-lift press flex items-center justify-between rounded-2xl p-4 ${
              i.status === "due"
                ? "border border-destructive/30 bg-destructive/5"
                : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  i.status === "due"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <Wrench className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {i.service_type}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {i.vehicle_name}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {i.detail}
                </div>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                i.status === "due"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-foreground/10 text-muted-foreground"
              }`}
            >
              {i.status}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
