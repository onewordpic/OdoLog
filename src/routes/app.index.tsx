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
  listAllRefuels,
  listAllMaintenance,
  getProfile,
  saveProfile,
  type VehicleIcon as VIcon,
} from "@/lib/data-store";
import { PREFS_EVENT, getPrefs, type Prefs } from "@/lib/prefs";
import { useAuthed } from "@/lib/use-authed";
import { ThemeToggle } from "@/components/theme-toggle";
import { VehicleIcon, VEHICLE_ICONS } from "@/components/vehicle-icon";
import { VehicleAvatar } from "@/components/vehicle-avatar";
import { searchCatalog, type CatalogEntry } from "@/lib/vehicle-catalog";
import { WeatherChip } from "@/components/weather-chip";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { TripPlannerModal } from "@/components/trip-planner-modal";
import { Route as RouteIcon } from "lucide-react";

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
  const who = name ? `, ${name}` : ", User";
  // Alternate greeting style across the day for variety.
  return (h % 2 === 0 ? slot : flavour) + who;
}

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const authed = useAuthed();
  const [showAdd, setShowAdd] = useState(false);
  const [showTrip, setShowTrip] = useState(false);

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

  const allRefuels = useQuery({
    queryKey: ["all-refuels", authed],
    queryFn: listAllRefuels,
    enabled: authed !== null,
  });

  const [spendRange, setSpendRange] = useState<"all" | "year" | "month" | "30d">("all");
  const spendBuckets = useMemo(() => {
    const list = allRefuels.data ?? [];
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const cutoff30 = Date.now() - 30 * 24 * 3600 * 1000;
    let all = 0, year = 0, month = 0, last30 = 0, firstTs: number | null = null;
    for (const r of list) {
      const amt = Number(r.amount_inr) || 0;
      all += amt;
      const d = new Date(r.refuel_date);
      const ts = d.getTime();
      if (!Number.isNaN(ts)) {
        if (firstTs === null || ts < firstTs) firstTs = ts;
        if (d.getFullYear() === y) year += amt;
        if (d.getFullYear() === y && d.getMonth() === m) month += amt;
        if (ts >= cutoff30) last30 += amt;
      }
    }
    return { all, year, month, last30, firstTs };
  }, [allRefuels.data]);

  const totalSpent =
    spendRange === "year" ? spendBuckets.year :
    spendRange === "month" ? spendBuckets.month :
    spendRange === "30d" ? spendBuckets.last30 :
    (stats.data?.spend ?? spendBuckets.all);
  const spentSinceLabel = (() => {
    if (spendRange === "year") return `in ${new Date().getFullYear()}`;
    if (spendRange === "month") return new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
    if (spendRange === "30d") return "last 30 days";
    if (spendBuckets.firstTs) {
      const d = new Date(spendBuckets.firstTs);
      return `since ${d.toLocaleString("en-IN", { month: "short", year: "numeric" })}`;
    }
    return "all time";
  })();
  const totalLitres = stats.data?.litres ?? 0;
  const refuelCount = stats.data?.count ?? 0;
  const vehicleCount = vehicles.data?.length ?? 0;
  const featured = vehicles.data?.[0];
  const latest = recent.data?.[0];

  // Deterministic accent color per vehicle (mirrors the reference dashboard's colored circular avatars).
  const accents = [
    "#A7F3D0", // mint
    "#FCD34D", // sand
    "#F9A8D4", // rose
    "#93C5FD", // sky
    "#C4B5FD", // violet
    "#FDBA74", // orange
  ];
  const accentFor = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return accents[Math.abs(h) % accents.length];
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:px-8 md:py-10 md:pb-10 text-foreground">
      {/* Top bar */}
      <header className="mb-8 flex items-center justify-between animate-fade-in-up">
        <Link to="/app" className="flex items-center gap-2 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--mint-accent)] text-[#0c1410] soft-shadow group-hover:scale-105 transition">
            <Fuel className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-display font-bold tracking-tight">OdoLog</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setShowTrip(true)}
            className="press hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 px-3 text-xs font-semibold transition"
            aria-label="Trip insight"
          >
            <RouteIcon className="h-3.5 w-3.5" /> Trip insight
          </button>
          <Link
            to="/app/analytics"
            className="press flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition"
            aria-label="Analytics"
          >
            <BarChart3 className="h-4 w-4" />
          </Link>
          <Link
            to="/app/settings"
            className="press flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          {authed ? (
            <button
              onClick={signOut}
              className="press flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="press flex h-9 items-center gap-1.5 rounded-full bg-[var(--mint-accent)] text-stone-900 px-4 text-xs font-semibold"
            >
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Page title */}
      <div className="mb-6 flex items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
            {greeting}<span className="text-[var(--mint-accent)]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--cockpit-text-soft)]">
            {vehicleCount > 0
              ? `${vehicleCount} ${vehicleCount === 1 ? "vehicle" : "vehicles"} · ${refuelCount} refuel${refuelCount === 1 ? "" : "s"} logged`
              : "Add your first vehicle to start tracking."}
          </p>
        </div>
        <WeatherChip city={profile.data?.default_city ?? ""} />
      </div>


      {authed === false && (
        <div className="mb-4 rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-2.5 text-xs animate-fade-in">
          Guest mode — data stays in this browser.{" "}
          <Link to="/auth" className="font-semibold underline text-[var(--mint-accent)]">Sign in</Link> to sync.
        </div>
      )}

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* Total spent (hero) */}
        <div className="md:col-span-7 rounded-[2rem] p-7 md:p-9 border border-foreground/10 bg-[var(--cockpit-card)] flex flex-col justify-between min-h-[220px] stagger"
             style={{ animationDelay: "0ms" }}>
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[var(--cockpit-text-mute)]">
              Total spent · {spentSinceLabel}
            </span>
            <button
              onClick={() => setShowAdd(true)}
              className="press hidden md:inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 px-3 py-1.5 text-[11px] font-semibold transition"
            >
              <Plus className="h-3 w-3" /> Vehicle
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {([
              ["all", "All time"],
              ["month", "This month"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSpendRange(k)}
                className={`press rounded-full px-2.5 py-1 text-[10px] font-semibold transition border ${
                  spendRange === k
                    ? "bg-[var(--mint-accent)] text-white border-transparent"
                    : "border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-[var(--cockpit-text-soft)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <div className="font-display text-5xl md:text-6xl font-bold tracking-tight">
              ₹{totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mint-accent-soft)] text-[var(--mint-accent)] px-2.5 py-1 text-[11px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--mint-accent)]" /> {refuelCount} refuels
              </span>
              <span className="text-[var(--cockpit-text-soft)]">across {vehicleCount} {vehicleCount === 1 ? "vehicle" : "vehicles"}</span>
            </div>
          </div>
        </div>

        {/* Litres */}
        <div className="md:col-span-5 grid grid-cols-2 gap-4">
          <div className="rounded-[2rem] p-5 border border-foreground/10 bg-[var(--cockpit-card)] flex flex-col justify-between stagger"
               style={{ animationDelay: "60ms" }}>
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--cockpit-text-mute)]">Litres</span>
            <div>
              <div className="font-display text-3xl font-bold tracking-tight">
                {totalLitres.toFixed(1)}<span className="text-sm ml-1 text-[var(--cockpit-text-mute)]">L</span>
              </div>
              <p className="text-[11px] mt-2 text-[var(--cockpit-text-soft)]">total fuel</p>
            </div>
          </div>
          <div className="rounded-[2rem] p-5 border border-foreground/10 bg-[var(--cockpit-card)] flex flex-col justify-between stagger"
               style={{ animationDelay: "120ms" }}>
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--cockpit-text-mute)]">Refuels</span>
            <div>
              <div className="font-display text-3xl font-bold tracking-tight">
                {refuelCount}
              </div>
              <p className="text-[11px] mt-2 text-[var(--cockpit-text-soft)]">
                {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        {/* Featured vehicle — mint accent hero */}
        <div className="md:col-span-7 rounded-[2rem] p-7 relative overflow-hidden group stagger min-h-[200px]"
             style={{ background: "var(--mint-accent)", color: "#0c1410", animationDelay: "180ms" }}>
          <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">
                {featured ? "Active vehicle" : "Your garage"}
              </span>
              {featured && (
                <div className="h-9 w-9 rounded-full bg-black/10 flex items-center justify-center">
                  <VehicleIcon icon={featured.icon ?? "car"} className="h-4 w-4" />
                </div>
              )}
            </div>
            {featured ? (
              <Link to="/app/vehicle/$id" params={{ id: featured.id }} className="block">
                <h4 className="font-display text-3xl md:text-4xl font-bold leading-tight tracking-tight">
                  {featured.make ? `${featured.make} ${featured.name}` : featured.name}
                </h4>
                <p className="text-sm font-medium opacity-70 mt-1">
                  <span className="capitalize">{featured.fuel_type}</span>
                  {featured.model_year ? ` · ${featured.model_year}` : ""}
                  {featured.reg_number ? ` · ${featured.reg_number}` : ""}
                </p>
                <span className="inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-full bg-stone-900 text-[var(--mint-accent)] text-sm font-semibold">
                  Log refuel <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ) : (
              <>
                <h4 className="font-display text-2xl font-bold">Empty garage</h4>
                <button
                  onClick={() => setShowAdd(true)}
                  className="press inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-[var(--mint-accent)] rounded-full text-sm font-semibold w-fit"
                >
                  <Plus className="h-3.5 w-3.5" /> Add vehicle
                </button>
              </>
            )}
          </div>
          <div className="absolute -right-10 -bottom-10 w-52 h-52 rounded-full bg-black/10 group-hover:scale-110 transition-transform duration-500" />
        </div>

        {/* Vehicles list (colored circular avatars like reference) */}
        <div className="md:col-span-5 rounded-[2rem] p-6 border border-foreground/10 bg-[var(--cockpit-card)] flex flex-col stagger"
             style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold">Your garage</h3>
            <button
              onClick={() => setShowAdd(true)}
              className="press flex items-center gap-1 rounded-full bg-[var(--mint-accent)] text-stone-900 px-3 py-1.5 text-[11px] font-semibold"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          {vehicles.isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : vehicles.data && vehicles.data.length > 0 ? (
            <div className="space-y-4 overflow-y-auto max-h-[460px] pr-1 -mr-1">
              {(["mine", "guest"] as const).map((group) => {
                const list = (vehicles.data ?? []).filter((v) =>
                  group === "guest" ? v.is_guest : !v.is_guest,
                );
                if (list.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--cockpit-text-mute)]">
                        {group === "guest" ? "Guest Garage" : "My Garage"}
                      </span>
                      {group === "guest" && (
                        <span className="text-[10px] text-[var(--cockpit-text-mute)] italic">
                          Borrowed wheels, full receipts
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {list.map((v) => {
                        const color = accentFor(v.id);
                        return (
                          <Link
                            key={v.id}
                            to="/app/vehicle/$id"
                            params={{ id: v.id }}
                            className="press flex items-center justify-between p-2.5 hover:bg-foreground/5 rounded-2xl transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                                style={{ background: color, color: "#0c1410" }}
                              >
                                <VehicleIcon icon={v.icon ?? "car"} className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                                  {v.make ? `${v.make} ${v.name}` : v.name}
                                  {v.is_guest && (
                                    <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--cockpit-text-soft)]">
                                      Borrowed
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] capitalize text-[var(--cockpit-text-mute)] truncate">
                                  {v.is_guest && v.owner_name ? `${v.owner_name}'s · ` : ""}{v.fuel_type}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[var(--cockpit-text-mute)] shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-sm text-[var(--cockpit-text-mute)] py-6">
              <Car className="h-6 w-6 mb-2 opacity-50" />
              No vehicles yet
            </div>
          )}
        </div>

        {/* Recent refuels — full width */}
        <div className="md:col-span-12 rounded-[2rem] p-7 border border-foreground/10 bg-[var(--cockpit-card)] flex flex-col stagger"
             style={{ animationDelay: "300ms" }}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-display text-xl font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--cockpit-text-mute)]" /> Recent refuels
            </h3>
            <Link to="/app/analytics" className="text-[11px] text-[var(--cockpit-text-soft)] hover:text-[var(--mint-accent)] transition">
              View analytics →
            </Link>
          </div>
          {recent.isLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : recent.data && recent.data.length > 0 ? (
            <div className="divide-y divide-foreground/10">
              {recent.data.slice(0, 6).map((r) => {
                const color = accentFor(r.vehicle_id);
                return (
                  <Link
                    key={r.id}
                    to="/app/vehicle/$id"
                    params={{ id: r.vehicle_id }}
                    className="press flex items-center justify-between py-3 hover:bg-foreground/5 -mx-2 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{ background: color, color: "#0c1410" }}
                      >
                        {r.vehicle_name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{r.vehicle_name}</p>
                        <p className="text-[11px] text-[var(--cockpit-text-mute)]">
                          {formatShortDate(r.refuel_date)} · {Number(r.litres).toFixed(2)} L
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold tabular-nums">₹{Number(r.amount_inr).toFixed(0)}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center text-sm text-[var(--cockpit-text-mute)]">
              <History className="h-6 w-6 mb-2 opacity-40" />
              No refuels logged yet.
            </div>
          )}
        </div>

      </div>

      

      <ServiceAlerts authed={authed} />

      {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} />}
      <TripPlannerModal open={showTrip} onClose={() => setShowTrip(false)} />
      <FirstRunCityModal profileLoaded={profile.isSuccess} currentCity={profile.data?.default_city ?? ""} currentName={name} />
      <MobileActionBar onAddVehicle={() => setShowAdd(true)} />
    </main>
  );
}

const ONBOARD_KEY = "odolog.cityOnboarded";

const CITY_SUGGESTIONS = [
  "Thiruvananthapuram",
  "Kochi",
  "Kozhikode",
  "Delhi",
  "Mumbai",
  "Bangalore",
  "Bengaluru",
  "Chennai",
  "Kolkata",
  "Hyderabad",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Chandigarh",
  "Coimbatore",
  "Indore",
  "Bhopal",
  "Nagpur",
  "Surat",
  "Vadodara",
  "Visakhapatnam",
];

function matchSuggestion(value: string): string {
  const v = value.trim().toLowerCase();
  return CITY_SUGGESTIONS.find((c) => c.toLowerCase() === v) ?? "";
}

function FirstRunCityModal({
  profileLoaded,
  currentCity,
  currentName,
}: {
  profileLoaded: boolean;
  currentCity: string;
  currentName: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("Thiruvananthapuram");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profileLoaded) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(ONBOARD_KEY)) return;
    setCity(matchSuggestion(currentCity) || "Thiruvananthapuram");
    setDisplayName(currentName || "");
    setOpen(true);
  }, [profileLoaded, currentCity, currentName]);

  async function save(skip = false) {
    setSaving(true);
    try {
      if (!skip) {
        const { saveProfile } = await import("@/lib/data-store");
        await saveProfile({
          display_name: displayName.trim() || currentName,
          default_city: (city.trim() || currentCity || "thiruvananthapuram").toLowerCase(),
        });
        qc.invalidateQueries({ queryKey: ["profile"] });
        toast.success("Welcome to OdoLog");
      }
      window.localStorage.setItem(ONBOARD_KEY, "1");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 backdrop-blur-md px-4 animate-fade-in">
      <div className="glass w-full max-w-sm rounded-3xl p-6 animate-slide-up">
        <h3 className="font-display text-xl font-bold">Welcome to OdoLog</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us your city — we'll auto-fetch local fuel rates when you log refuels.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
          className="mt-4 space-y-3"
        >
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Your name (optional)</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Safwan"
              maxLength={60}
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">City</span>
            <input
              autoFocus
              list="odolog-city-suggestions"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Start typing — pick from suggestions"
              maxLength={60}
              required
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-3 py-2.5 text-sm"
            />
            <datalist id="odolog-city-suggestions">
              {CITY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="press flex-1 rounded-xl glass-subtle glass-hover py-2.5 text-sm font-medium"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={saving || !city.trim()}
              className="press flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatShortDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type FuelChoice = "petrol" | "diesel" | "cng" | "electric";

function fuelOptionsFor(icon: VIcon): FuelChoice[] {
  if (icon === "bike" || icon === "scooter") return ["petrol", "electric"];
  return ["petrol", "diesel", "cng", "electric"];
}

function AddVehicleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fuelType, setFuelType] = useState<FuelChoice>("petrol");
  const [icon, setIcon] = useState<VIcon>("car");
  const [make, setMake] = useState("");
  const [year, setYear] = useState("");
  const [reg, setReg] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showEvCongrats, setShowEvCongrats] = useState(false);

  // Keep fuel type valid when icon changes.
  useEffect(() => {
    const allowed = fuelOptionsFor(icon);
    if (!allowed.includes(fuelType)) setFuelType(allowed[0]);
  }, [icon]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo<CatalogEntry[]>(
    () => (name.trim().length >= 1 ? searchCatalog(name, 6) : []),
    [name],
  );

  const [isGuest, setIsGuest] = useState(false);
  const [ownerName, setOwnerName] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      addVehicle({
        name: name.trim(),
        fuel_type: fuelType as "petrol" | "diesel" | "cng" | "electric",
        icon,
        make: make.trim() || null,
        model_year: year ? Number(year) : null,
        reg_number: reg.trim() ? reg.trim().toUpperCase() : null,
        image_url: imageUrl.trim() || null,
        is_guest: isGuest,
        owner_name: isGuest ? (ownerName.trim() || null) : null,
      }),
    onSuccess: () => {
      toast.success("Vehicle added");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!name.trim()) return;
    // Bike / Scooter EV → block adding, just celebrate.
    if ((icon === "scooter" || icon === "bike") && fuelType === "electric") {
      setShowEvCongrats(true);
      return;
    }
    // Car EV → show savings popup, but DO add the vehicle.
    if (icon === "car" && fuelType === "electric") {
      setShowEvCongrats(true);
      mut.mutate();
      return;
    }
    mut.mutate();
  }

  function applySuggestion(s: CatalogEntry) {
    setName(s.model);
    setMake(s.make);
    setIcon(s.type);
    const allowed = fuelOptionsFor(s.type);
    setFuelType(allowed.includes(s.fuel as FuelChoice) ? (s.fuel as FuelChoice) : allowed[0]);
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
            handleSubmit();
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
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {fuelOptionsFor(icon).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFuelType(f)}
                  className={`press rounded-xl px-3 py-3 text-sm font-medium uppercase tracking-wide transition ${
                    fuelType === f
                      ? "bg-primary text-primary-foreground"
                      : "glass-subtle glass-hover"
                  }`}
                >
                  {f === "cng" ? "CNG" : f === "electric" ? "EV" : f}
                </button>
              ))}
            </div>
            {(icon === "bike" || icon === "scooter") && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Diesel isn't available for {icon}s. Pick EV if yours is electric.
              </p>
            )}
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

          <div className="rounded-2xl glass-subtle p-3 space-y-2">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="min-w-0">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  🤝 Guest Garage
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Borrowed wheels for a trip — track fuel without owning it.
                </div>
              </div>
              <input
                type="checkbox"
                checked={isGuest}
                onChange={(e) => setIsGuest(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>
            {isGuest && (
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner's name (e.g. Arjun)"
                maxLength={40}
                className="w-full rounded-xl glass-input glass-input-focus px-4 py-2 text-sm"
              />
            )}
          </div>


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

      {showEvCongrats && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass w-full max-w-sm rounded-3xl p-7 text-center animate-slide-up">
            <div className="mx-auto mb-3 text-4xl">⚡️🎉</div>
            <h3 className="font-display text-xl font-bold">Congrats on saving fuel cost!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {icon === "car"
                ? "No fuel bills, lower emissions, smoother rides. We've added your EV — only the maintenance log is enabled for it."
                : "You don't need this app. Ride on, eco hero."}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowEvCongrats(false);
                // For car-EV we already kicked off mut.mutate(); onSuccess closes the modal.
                if (!(icon === "car" && fuelType === "electric")) onClose();
              }}
              className="press mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Got it
            </button>
          </div>
        </div>
      )}
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


