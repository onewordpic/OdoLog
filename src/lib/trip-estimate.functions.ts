// Trip distance estimate via free OSM stack:
//   geocode → Nominatim (https://nominatim.openstreetmap.org)
//   route   → public OSRM   (https://router.project-osrm.org)
//
// Both are best-effort and require a User-Agent on Nominatim. We add a tiny
// in-memory cache per server instance to keep things polite.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  origin: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  roundTrip: z.boolean().default(false),
});

type GeoResult = { lat: number; lon: number; displayName: string };

const geoCache = new Map<string, GeoResult>();
const routeCache = new Map<string, number>(); // km
const UA = "OdoLog/1.0 (https://odolog.lovable.app)";

function trimCache<T>(map: Map<string, T>, max = 80) {
  if (map.size <= max) return;
  const first = map.keys().next().value;
  if (first !== undefined) map.delete(first);
}

async function geocode(query: string): Promise<GeoResult | null> {
  const key = query.trim().toLowerCase();
  const hit = geoCache.get(key);
  if (hit) return hit;
  // Bias to India for nicer results.
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const g: GeoResult = {
      lat: parseFloat(arr[0].lat),
      lon: parseFloat(arr[0].lon),
      displayName: arr[0].display_name,
    };
    geoCache.set(key, g);
    trimCache(geoCache);
    return g;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function routeKm(a: GeoResult, b: GeoResult): Promise<number | null> {
  const key = `${a.lat},${a.lon}|${b.lat},${b.lon}`;
  const hit = routeCache.get(key);
  if (hit != null) return hit;
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      routes?: Array<{ distance?: number }>;
    };
    const meters = json.routes?.[0]?.distance;
    if (typeof meters !== "number" || !Number.isFinite(meters)) return null;
    const km = meters / 1000;
    routeCache.set(key, km);
    trimCache(routeCache);
    return km;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export const estimateTripDistance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const [o, d] = await Promise.all([
      geocode(data.origin),
      geocode(data.destination),
    ]);
    if (!o)
      return { ok: false as const, error: `Couldn't find "${data.origin}"` };
    if (!d)
      return {
        ok: false as const,
        error: `Couldn't find "${data.destination}"`,
      };

    const oneWay = await routeKm(o, d);
    if (oneWay == null)
      return { ok: false as const, error: "Routing service unavailable" };

    const km = data.roundTrip ? oneWay * 2 : oneWay;
    return {
      ok: true as const,
      distanceKm: km,
      oneWayKm: oneWay,
      roundTrip: data.roundTrip,
      origin: { name: o.displayName, lat: o.lat, lon: o.lon },
      destination: { name: d.displayName, lat: d.lat, lon: d.lon },
    };
  });
