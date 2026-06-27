import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Car, Bike, MapPin, Leaf, Droplet, Gauge, IndianRupee, ExternalLink } from "lucide-react";
import { fetchPublicGarage, type PublicGarage } from "@/lib/insights.functions";

export const Route = createFileRoute("/g/$handle")({
  loader: async ({ params }) => {
    const data = await fetchPublicGarage({ data: { handle: params.handle } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const d = loaderData as PublicGarage | undefined;
    const name = d?.display_name || `@${params.handle}`;
    const title = `${name}'s Garage · OdoLog`;
    const desc = d?.public_bio || `${d?.vehicles.length ?? 0} vehicles tracked on OdoLog.`;
    const url = `https://odolog.lovable.app/g/${params.handle}`;
    const img = d?.vehicles.find((v) => v.image_url)?.image_url ?? d?.public_avatar_url ?? null;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        ...(img ? [{ property: "og:image", content: img } as const, { property: "twitter:image", content: img } as const] : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
  component: PublicGarageView,
});

function PublicGarageView() {
  const params = Route.useParams();
  const d = Route.useLoaderData();
  const totalKm = d.vehicles.reduce((s, v) => s + (v.lifetime_km ?? 0), 0);
  const totalSpend = d.vehicles.reduce((s, v) => s + v.total_spend, 0);
  const totalCo2 = d.vehicles.reduce((s, v) => s + v.co2_kg, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-4 sm:p-8 space-y-6 animate-fade-in">
        <header className="flex items-center justify-between text-xs">
          <Link to="/" className="font-semibold tracking-tight">
            OdoLog<span className="text-primary">.</span>
          </Link>
          <Link to="/" className="text-muted-foreground hover:text-foreground flex items-center gap-1">
            Track your own <ExternalLink className="h-3 w-3" />
          </Link>
        </header>

        <section className="glass rounded-3xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-foreground/5 flex items-center justify-center overflow-hidden text-2xl font-semibold">
              {d.public_avatar_url ? (
                <img src={d.public_avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (d.display_name || params.handle)[0]?.toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold truncate">{d.display_name || `@${params.handle}`}</h1>
              <div className="text-xs text-muted-foreground">@{params.handle}</div>
              {d.default_city && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {capitalize(d.default_city)}
                </div>
              )}
            </div>
          </div>
          {d.public_bio && <p className="mt-4 text-sm text-foreground/80">{d.public_bio}</p>}
        </section>

        <section className="grid grid-cols-3 gap-3">
          <Stat icon={Gauge} label="Total km" value={totalKm > 0 ? totalKm.toLocaleString("en-IN") : "—"} />
          <Stat icon={IndianRupee} label="Spent" value={totalSpend > 0 ? `₹${totalSpend.toLocaleString("en-IN")}` : "—"} />
          <Stat icon={Leaf} label="CO₂" value={totalCo2 > 0 ? `${totalCo2.toFixed(0)} kg` : "—"} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Garage ({d.vehicles.length})</h2>
          {d.vehicles.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No public vehicles yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {d.vehicles.map((v) => (
                <article key={v.id} className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-foreground/5 overflow-hidden flex items-center justify-center">
                      {v.image_url ? (
                        <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                      ) : v.icon === "bike" || v.icon === "scooter" ? (
                        <Bike className="h-5 w-5" />
                      ) : (
                        <Car className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {[v.make, v.model_year, capitalize(v.fuel_type)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px]">
                    <Mini value={v.lifetime_km ? v.lifetime_km.toLocaleString("en-IN") : "—"} label="km" />
                    <Mini value={v.refuel_count > 0 ? v.refuel_count.toString() : "—"} label="refuels" />
                    <Mini value={v.co2_kg > 0 ? `${v.co2_kg.toFixed(0)}` : "—"} label="kg CO₂" />
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="pt-4 text-center text-[11px] text-muted-foreground">
          Powered by <Link to="/" className="font-medium underline-offset-2 hover:underline">OdoLog</Link> · Fuel & maintenance tracker for India
        </footer>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-primary" />
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-foreground/5 py-1">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="glass rounded-3xl p-8 text-center max-w-sm">
        <h1 className="text-lg font-semibold">Garage not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This handle isn't claimed yet, or the owner has made their garage private.
        </p>
        <Link to="/" className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Open OdoLog
        </Link>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="glass rounded-3xl p-8 text-center max-w-sm">
        <h1 className="text-lg font-semibold">Couldn't load this garage</h1>
        <p className="mt-2 text-xs text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}
