import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Fuel,
  Gauge,
  LineChart,
  Wrench,
  ArrowUpRight,
  Bell,
  Sparkles,
} from "lucide-react";
import { useAuthed } from "@/lib/use-authed";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "OdoLog — know what every kilometre costs" },
      {
        name: "description",
        content:
          "Log refuels in rupees, auto-fetch today's fuel rate, track odometer, mileage and cost per km across all your vehicles.",
      },
      { property: "og:title", content: "OdoLog — know what every kilometre costs" },
      {
        property: "og:description",
        content:
          "Log refuels in rupees, auto-fetch today's fuel rate, track odometer, mileage and cost per km across all your vehicles.",
      },
      { property: "og:url", content: "https://odolog.online/" },
    ],
    links: [{ rel: "canonical", href: "https://odolog.online/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "OdoLog",
              url: "https://odolog.online/",
            },
            {
              "@type": "Organization",
              name: "OdoLog",
              url: "https://odolog.online/",
              logo: "https://odolog.online/icon-512.png",
            },
            {
              "@type": "SoftwareApplication",
              name: "OdoLog",
              url: "https://odolog.online/",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              description:
                "Fuel and running-cost tracker: log refuels in rupees, get litres from the day's fuel rate, and see mileage and cost per km.",
            },
          ],
        }),
      },
    ],
  }),

});

function Landing() {
  const authed = useAuthed();

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 md:px-8 md:py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="glass flex h-10 w-10 items-center justify-center rounded-2xl">
            <Fuel className="h-4.5 w-4.5 text-primary" />
          </div>
          <span className="text-lg font-medium tracking-tight">OdoLog</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!authed && (
            <Link
              to="/auth"
              className="glass press rounded-full px-4 py-2 text-sm font-medium hover-lift"
            >
              Sign in
            </Link>
          )}
          <Link
            to="/app"
            className="press rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Open app
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mt-14 grid gap-6 md:mt-20 md:grid-cols-12">
        <div className="md:col-span-7 animate-fade-in-up">
          <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Made for Indian fuel prices
          </div>
          <h1 className="mt-5 text-5xl font-light leading-[1.02] tracking-tight md:text-6xl">
            Know what <span className="font-medium italic">every kilometre</span> actually costs.
          </h1>
          <p className="mt-6 max-w-md text-base text-muted-foreground">
            Type the rupees you spent. OdoLog pulls today's rate, derives
            litres, and turns your odometer into clean mileage and cost-per-km.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/app"
              className="press group flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {authed ? "Open dashboard" : "Start free — no sign-up"}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            {!authed && (
              <Link
                to="/auth"
                className="glass press rounded-full px-6 py-3 text-sm font-medium hover-lift"
              >
                Sign in to sync
              </Link>
            )}
          </div>
          {!authed && (
            <p className="mt-3 text-xs text-muted-foreground">
              Guest mode keeps data in this browser. Sign in anytime to sync.
            </p>
          )}
        </div>

        {/* Floating preview card */}
        <div className="relative md:col-span-5 animate-fade-in-up [animation-delay:120ms]">
          <div className="glass hover-lift rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                This month
              </span>
              <span className="rounded-full bg-accent/60 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                Honda City
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-light tracking-tight">₹4.82</span>
              <span className="text-sm text-muted-foreground">/ km</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              18.4 km/l avg · 642 km driven
            </div>

            {/* mini chart */}
            <svg viewBox="0 0 200 60" className="mt-4 h-16 w-full">
              <defs>
                <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,40 L25,32 L50,38 L75,22 L100,28 L125,18 L150,24 L175,12 L200,16 L200,60 L0,60 Z"
                fill="url(#g1)"
              />
              <path
                d="M0,40 L25,32 L50,38 L75,22 L100,28 L125,18 L150,24 L175,12 L200,16"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { l: "Spend", v: "₹3,094" },
                { l: "Litres", v: "30.2" },
                { l: "Refuels", v: "4" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="glass-subtle rounded-xl px-2 py-2 text-center"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.l}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* floating chip */}
          <div className="glass soft-shadow absolute -bottom-4 -left-4 flex items-center gap-2 rounded-2xl px-3 py-2 animate-fade-in-up [animation-delay:240ms]">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">Oil change due in 240 km</span>
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section className="mt-20 grid gap-4 md:grid-cols-6 md:mt-28">
        <BentoCard
          className="md:col-span-3"
          icon={Fuel}
          eyebrow="Rupees in"
          title="Litres out, automatically."
          body="Type ₹ spent and your city — we fetch today's rate and derive litres so the math just disappears."
          tint="peach"
        />
        <BentoCard
          className="md:col-span-3"
          icon={Gauge}
          eyebrow="Odometer aware"
          title="Cost per km, per segment."
          body="Mark full tanks and add odo readings. Get mileage and ₹/km for every leg, not just averages."
          tint="mint"
        />
        <BentoCard
          className="md:col-span-2"
          icon={LineChart}
          eyebrow="Trends"
          title="See drops before they hurt."
          body="Interactive charts for mileage, spend and litres across time."
          tint="lilac"
        />
        <BentoCard
          className="md:col-span-2"
          icon={Wrench}
          eyebrow="Maintenance"
          title="Never miss a service."
          body="Log services, set km or date reminders, see what's due at a glance."
          tint="coral"
        />
        <BentoCard
          className="md:col-span-2"
          icon={Sparkles}
          eyebrow="Multi-vehicle"
          title="Car. Bike. Scooter."
          body="Track them all with the right icon, side by side."
          tint="mint"
        />
      </section>

      <footer className="mt-auto pt-16 text-xs text-muted-foreground">
        OdoLog · prices via goodreturns.in · {new Date().getFullYear()}
      </footer>
    </main>
  );
}

const TINTS: Record<string, string> = {
  peach:
    "radial-gradient(120% 100% at 100% 0%, color-mix(in oklab, var(--grad-peach) 55%, transparent), transparent 60%)",
  mint:
    "radial-gradient(120% 100% at 0% 100%, color-mix(in oklab, var(--grad-mint) 55%, transparent), transparent 60%)",
  lilac:
    "radial-gradient(120% 100% at 100% 100%, color-mix(in oklab, var(--grad-lilac) 60%, transparent), transparent 60%)",
  coral:
    "radial-gradient(120% 100% at 0% 0%, color-mix(in oklab, var(--grad-coral) 55%, transparent), transparent 60%)",
};

function BentoCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  className = "",
  tint = "mint",
}: {
  icon: typeof Fuel;
  eyebrow: string;
  title: string;
  body: string;
  className?: string;
  tint?: keyof typeof TINTS | string;
}) {
  return (
    <div
      className={`glass hover-lift relative overflow-hidden rounded-3xl p-6 animate-fade-in-up ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: TINTS[tint as string] ?? TINTS.mint }}
      />
      <div className="relative">
        <div className="glass-subtle inline-flex h-9 w-9 items-center justify-center rounded-xl">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </div>
        <h3 className="mt-1 text-lg font-medium tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
