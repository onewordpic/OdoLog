import { createFileRoute, Link } from "@tanstack/react-router";
import { Fuel, Gauge, LineChart } from "lucide-react";
import { useAuthed } from "@/lib/use-authed";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const authed = useAuthed();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="glass flex h-9 w-9 items-center justify-center rounded-xl">
            <Fuel className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-medium tracking-tight">Fuelogue</span>
        </div>
        <div className="flex items-center gap-2">
          {!authed && (
            <Link
              to="/auth"
              className="rounded-full glass px-4 py-2 text-sm font-medium hover:bg-white/60"
            >
              Sign in
            </Link>
          )}
          <Link
            to="/app"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Open app
          </Link>
        </div>
      </header>

      <section className="mt-24 max-w-2xl">
        <h1 className="text-5xl font-light leading-[1.05] tracking-tight md:text-6xl">
          Know exactly what
          <br />
          <span className="font-medium italic">every kilometre</span> costs.
        </h1>
        <p className="mt-6 max-w-lg text-base text-muted-foreground">
          Log your refuels in rupees. Fuelogue fetches the day's fuel rate,
          derives litres, and turns your odometer readings into a clear cost per
          kilometre.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/app"
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {authed ? "Open dashboard" : "Start tracking — no sign-up"}
          </Link>
          {!authed && (
            <Link
              to="/auth"
              className="rounded-full glass px-6 py-3 text-sm font-medium hover:bg-white/60"
            >
              Sign in to sync
            </Link>
          )}
        </div>
        {!authed && (
          <p className="mt-3 text-xs text-muted-foreground">
            Guest mode keeps everything in this browser. Sign in anytime to
            sync across devices.
          </p>
        )}
      </section>

      <section className="mt-24 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Fuel,
            title: "Rupees in, litres out",
            body: "Type ₹ spent. We pull today's rate for your city and compute litres for you.",
          },
          {
            icon: Gauge,
            title: "Odometer aware",
            body: "Mark full tanks and log odo readings to get accurate cost per km and km/l.",
          },
          {
            icon: LineChart,
            title: "Trends that matter",
            body: "Spot when mileage drops or fuel spend spikes across all your vehicles.",
          },
        ].map((f) => (
          <div key={f.title} className="glass rounded-2xl p-6">
            <f.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-medium">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-16 text-xs text-muted-foreground">
        Fuelogue · prices via goodreturns.in (community source)
      </footer>
    </main>
  );
}
