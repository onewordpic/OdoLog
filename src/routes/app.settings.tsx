import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Download,
  Trash2,
  Bell,
  Palette,
  User,
  Database,
  LogOut,
  LogIn,
  Heart,
  AlertTriangle,
  Star,
  Github,
  Share2,
  Upload,
  X,

} from "lucide-react";
import {
  getProfile,
  saveProfile,
  listVehicles,
  listRecentRefuels,
  clearAllData,
} from "@/lib/data-store";
import {
  getPrefs,
  savePrefs,
  clearLocalData,
  DEFAULT_PREFS,
  DEFAULT_SHARE_MESSAGE,
  DEFAULT_SHARE_URL,
  type Prefs,
} from "@/lib/prefs";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShareCard } from "@/components/share-button";
import { GoogleCalendarCard } from "@/components/google-calendar-card";
import { JsonImportModal } from "@/components/json-import-modal";


import { useAuthed } from "@/lib/use-authed";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCENTS,
  GRADIENTS,
  getAccent,
  getGradient,
  applyAccent,
  applyGradient,
  type Accent,
  type Gradient,
} from "@/lib/theming";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

const CITIES = [
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

const GITHUB_URL = "https://github.com/onewordpic/odolog";
const STAR_DISMISS_KEY = "odolog.githubStarDismissed";

function SettingsPage() {
  const qc = useQueryClient();
  const authed = useAuthed();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [city, setCity] = useState("thiruvananthapuram");
  const [showStar, setShowStar] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);


  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowStar(window.localStorage.getItem(STAR_DISMISS_KEY) !== "1");
  }, []);

  function dismissStar() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STAR_DISMISS_KEY, "1");
    }
    setShowStar(false);
  }
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.display_name ?? "");
      setCity(profile.data.default_city ?? "thiruvananthapuram");
    }
  }, [profile.data]);

  useEffect(() => {
    setPrefs(getPrefs());
    setAccent(getAccent());
    setGradient(getGradient());
  }, []);
  const [accent, setAccent] = useState<Accent>("mint");
  const [gradient, setGradient] = useState<Gradient>("aurora");

  const saveProf = useMutation({
    mutationFn: () => saveProfile({ display_name: name, default_city: city }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e.message),
  });

  function updatePrefs(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  }

  async function handleExport() {
    try {
      const [vehicles, refuels] = await Promise.all([
        listVehicles(),
        listRecentRefuels(10000),
      ]);
      const vMap = new Map(vehicles.map((v) => [v.id, v.name]));
      const rows = refuels.map((r) => ({
        vehicle: vMap.get(r.vehicle_id) ?? r.vehicle_id,
        date: r.refuel_date,
        amount_inr: r.amount_inr,
        rate_per_litre: r.rate_per_litre,
        litres: r.litres,
        odo_km: r.odo_km ?? "",
        full_tank: r.full_tank ? "yes" : "no",
        notes: r.notes ?? "",
      }));
      const { downloadCsv } = await import("@/lib/prefs");
      downloadCsv(`odolog-refuels-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      toast.success(`Exported ${rows.length} refuels`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  function handleClear() {
    if (
      !confirm(
        "Clear all local guest data? Vehicles, refuels and maintenance stored in this browser will be permanently deleted. (Cloud data is not affected.)",
      )
    )
      return;
    clearLocalData();
    setPrefs(DEFAULT_PREFS);
    qc.invalidateQueries();
    toast.success("Local data cleared");
  }

  async function handleDeleteAll() {
    // Two confirmations: this is irreversible and wipes cloud + local data.
    const first = confirm(
      authed
        ? "Delete ALL your data? This permanently removes every vehicle, refuel and maintenance log from your account and this browser. This cannot be undone."
        : "Delete ALL your data? This permanently removes every vehicle, refuel and maintenance log stored in this browser. This cannot be undone.",
    );
    if (!first) return;
    const second = confirm("Are you absolutely sure? There is no recovery.");
    if (!second) return;
    try {
      await clearAllData();
      setPrefs(DEFAULT_PREFS);
      clearLocalData();
      qc.invalidateQueries();
      toast.success("All data deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="glass press flex h-9 w-9 items-center justify-center rounded-full hover-lift"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-light tracking-tight">Settings</h1>
        </div>
        <ThemeToggle />
      </header>

      {profile.isLoading ? (
        <div className="glass flex h-24 items-center justify-center rounded-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          {showStar && (
            <div className="relative animate-fade-in-up overflow-hidden rounded-3xl border border-foreground/10 bg-gradient-to-br from-amber-200/30 via-foreground/5 to-transparent p-5">
              <button
                onClick={dismissStar}
                aria-label="Dismiss"
                className="press absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start gap-3 pr-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-500">
                  <Star className="h-5 w-5" fill="currentColor" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">Love OdoLog? Star it on GitHub</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    It's open source. A star helps more drivers find it — takes 5 seconds.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={GITHUB_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={dismissStar}
                      className="press inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background hover:opacity-90"
                    >
                      <Github className="h-3.5 w-3.5" /> Star on GitHub
                    </a>
                    <button
                      onClick={dismissStar}
                      className="press rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Maybe later
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ShareCard />

          <GoogleCalendarCard />





          {/* Profile */}
          <Section icon={User} title="Profile" subtitle="Your name and default city for fuel-rate lookups.">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Default city for fuel prices">
              <select
                value={
                  CITIES.find((c) => c.toLowerCase() === city.toLowerCase()) ?? city
                }
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <button
              onClick={() => saveProf.mutate()}
              disabled={saveProf.isPending}
              className="press w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saveProf.isPending ? "Saving…" : "Save profile"}
            </button>
          </Section>

          {/* Display */}
          <Section icon={Palette} title="Display" subtitle="How the app looks and what charts open with.">
            <Row label="Theme" hint="Light, dark, or follow system.">
              <ThemeToggle />
            </Row>
            <Field label="Accent color">
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((a) => {
                  const active = accent === a.id;
                  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setAccent(a.id); applyAccent(a.id); }}
                      className={`press flex items-center gap-2 rounded-full glass-subtle px-3 py-1.5 text-xs font-medium transition ${active ? "ring-2 ring-foreground/30" : ""}`}
                    >
                      <span className="h-4 w-4 rounded-full" style={{ background: isDark ? a.dark : a.light }} />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Background gradient">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADIENTS.map((g) => {
                  const active = gradient === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setGradient(g.id); applyGradient(g.id); }}
                      className={`press relative h-16 overflow-hidden rounded-xl border text-[11px] font-semibold transition ${active ? "border-foreground/40" : "border-foreground/10"}`}
                      style={{ background: g.preview }}
                    >
                      <span className="absolute inset-x-0 bottom-1 text-center text-foreground/80 mix-blend-luminosity">
                        {g.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Row label="Density" hint="Tighter layout on small screens.">
              <Segmented
                value={prefs.density}
                onChange={(v) => updatePrefs({ density: v as Prefs["density"] })}
                options={[
                  { id: "comfortable", label: "Comfortable" },
                  { id: "compact", label: "Compact" },
                ]}
              />
            </Row>
            <Field label="Default chart metric">
              <select
                value={prefs.defaultChartMetric}
                onChange={(e) =>
                  updatePrefs({
                    defaultChartMetric: e.target.value as Prefs["defaultChartMetric"],
                  })
                }
                className="w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
              >
                <option value="kmpl">Mileage (km/l)</option>
                <option value="cpk">Cost / km (₹)</option>
                <option value="spend">Spend (₹)</option>
                <option value="litres">Litres</option>
              </select>
            </Field>
          </Section>

          {/* Reminders */}
          <Section icon={Bell} title="Reminders" subtitle="When to surface service-due alerts.">
            <Row
              label="Service alerts"
              hint="Show a banner on the vehicle page when a service is due."
            >
              <Toggle
                checked={prefs.serviceAlertsEnabled}
                onChange={(v) => updatePrefs({ serviceAlertsEnabled: v })}
              />
            </Row>
            <Field label="Warn me this many km early">
              <NumberInput
                value={prefs.reminderLeadKm}
                min={0}
                max={5000}
                step={50}
                onChange={(v) => updatePrefs({ reminderLeadKm: v })}
                suffix="km"
              />
            </Field>
            <Field label="Warn me this many days early">
              <NumberInput
                value={prefs.reminderLeadDays}
                min={0}
                max={90}
                step={1}
                onChange={(v) => updatePrefs({ reminderLeadDays: v })}
                suffix="days"
              />
            </Field>
          </Section>

          {/* Vehicle value */}
          <Section
            icon={Database}
            title="Vehicle value"
            subtitle="Estimate current resale value from purchase price."
          >
            <Row
              label="Show depreciation card"
              hint="Reducing-balance estimate: 15%/yr cars, 12%/yr bikes & scooters. Set purchase price + date on each vehicle."
            >
              <Toggle
                checked={prefs.showDepreciation}
                onChange={(v) => updatePrefs({ showDepreciation: v })}
              />
            </Row>
          </Section>

          {/* Share */}
          <Section
            icon={Share2}
            title="Share"
            subtitle="Customize the message and link used when you tap Share."
          >
            <Field label="Share message">
              <textarea
                value={prefs.shareMessage}
                onChange={(e) => updatePrefs({ shareMessage: e.target.value })}
                rows={3}
                maxLength={280}
                placeholder={DEFAULT_SHARE_MESSAGE}
                className="w-full resize-none rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Deep link back to OdoLog">
              <input
                type="url"
                value={prefs.shareUrl}
                onChange={(e) => updatePrefs({ shareUrl: e.target.value })}
                placeholder={DEFAULT_SHARE_URL}
                className="w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-muted-foreground">
                Preview: <span className="text-foreground">{(prefs.shareMessage || DEFAULT_SHARE_MESSAGE).trim()} {(prefs.shareUrl || DEFAULT_SHARE_URL).trim()}</span>
              </p>
              <button
                type="button"
                onClick={() =>
                  updatePrefs({
                    shareMessage: DEFAULT_SHARE_MESSAGE,
                    shareUrl: DEFAULT_SHARE_URL,
                  })
                }
                className="press rounded-full px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Reset to default
              </button>
            </div>
          </Section>


          <Section icon={Database} title="Data & privacy" subtitle="Export, clear, or sign out.">
            <button
              onClick={handleExport}
              className="press flex w-full items-center justify-between gap-2 rounded-xl glass-subtle px-4 py-3 text-sm font-medium hover:bg-foreground/5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Download className="h-4 w-4 shrink-0" />
                <span className="truncate">Export refuels as CSV</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">all vehicles</span>
            </button>

            <button
              onClick={handleClear}
              className="press flex w-full items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Clear local guest data</span>
              </span>
              <span className="shrink-0 text-xs opacity-70">browser only</span>
            </button>

            <button
              onClick={handleDeleteAll}
              className="press flex w-full items-center justify-between gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/20"
            >
              <span className="flex min-w-0 items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate">Delete all my data</span>
              </span>
              <span className="shrink-0 text-xs opacity-80">
                {authed ? "cloud + browser" : "browser"}
              </span>
            </button>

            {authed ? (
              <button
                onClick={handleSignOut}
                className="press flex w-full items-center justify-between rounded-xl glass-subtle px-4 py-3 text-sm font-medium hover:bg-foreground/5"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Sign out
                </span>
              </button>
            ) : (
              <Link
                to="/auth"
                className="press flex w-full items-center justify-between rounded-xl glass-subtle px-4 py-3 text-sm font-medium hover:bg-foreground/5"
              >
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" /> Sign in to sync across devices
                </span>
              </Link>
            )}
          </Section>

          <footer className="space-y-2 px-1 pt-4 text-center text-xs text-muted-foreground">
            <p className="flex items-center justify-center gap-1.5">
              Made with <Heart className="h-3 w-3 fill-destructive text-destructive" aria-hidden /> in India by{" "}
              <span className="font-medium text-foreground">Safwan</span>
            </p>
            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <a
                href="https://x.com/onewordpic"
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-foreground hover:underline"
              >
                @onewordpic on X
              </a>
              <span aria-hidden>·</span>
              <a
                href="https://safwan.online"
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-foreground hover:underline"
              >
                safwan.online
              </a>
            </p>
            <p>OdoLog · v2 · {authed ? "synced to cloud" : "guest mode"}</p>
          </footer>
        </div>
      )}
    </main>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof User;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass animate-fade-in-up space-y-4 rounded-3xl p-6">
      <div className="flex items-start gap-3">
        <div className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl glass-subtle px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && (
          <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="glass-subtle flex rounded-full p-1 text-[11px]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`press rounded-full px-3 py-1 transition ${
            value === o.id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? "bg-primary" : "bg-foreground/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl glass-input px-4 py-2.5 text-sm">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent outline-none"
      />
      {suffix && (
        <span className="text-xs text-muted-foreground">{suffix}</span>
      )}
    </div>
  );
}
