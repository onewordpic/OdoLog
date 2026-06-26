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
} from "lucide-react";
import {
  getProfile,
  saveProfile,
  listVehicles,
  listRecentRefuels,
} from "@/lib/data-store";
import {
  getPrefs,
  savePrefs,
  clearLocalData,
  DEFAULT_PREFS,
  type Prefs,
} from "@/lib/prefs";
import { ThemeToggle } from "@/components/theme-toggle";
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
  "Kochi",
  "Thiruvananthapuram",
  "Chandigarh",
  "Coimbatore",
  "Indore",
  "Bhopal",
  "Nagpur",
  "Surat",
  "Vadodara",
  "Visakhapatnam",
];

function SettingsPage() {
  const qc = useQueryClient();
  const authed = useAuthed();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [city, setCity] = useState("delhi");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.display_name ?? "");
      setCity(profile.data.default_city ?? "delhi");
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

          {/* Data */}
          <Section icon={Database} title="Data & privacy" subtitle="Export, clear, or sign out.">
            <button
              onClick={handleExport}
              className="press flex w-full items-center justify-between rounded-xl glass-subtle px-4 py-3 text-sm font-medium hover:bg-foreground/5"
            >
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" /> Export refuels as CSV
              </span>
              <span className="text-xs text-muted-foreground">all vehicles</span>
            </button>

            <button
              onClick={handleClear}
              className="press flex w-full items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Clear local guest data
              </span>
              <span className="text-xs opacity-70">browser only</span>
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

          <p className="px-1 pt-2 text-center text-xs text-muted-foreground">
            OdoLog · v1 · {authed ? "synced to cloud" : "guest mode"}
          </p>
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
