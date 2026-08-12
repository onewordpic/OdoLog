// Client-side performance collector.
// Records core web vitals + phase timings for a page load and buffers them in
// sessionStorage. Flushed to the backend on visibilitychange / next load.
// Completely inert unless the `perfProfiling` pref is on.

export type SlowResource = {
  name: string;
  duration_ms: number;
  size_kb: number | null;
  kind: string;
};

export type PerfSample = {
  route: string;
  device: string;
  connection: string | null;
  app_version: string;
  ttfb_ms: number | null;
  fcp_ms: number | null;
  lcp_ms: number | null;
  hydration_ms: number | null;
  route_load_ms: number | null;
  total_ms: number | null;
  slow_resources: SlowResource[];
  captured_at: string;
};

export const APP_VERSION = "v2.1";
const BUFFER_KEY = "odolog.perf.buffer";
const MAX_BUFFER = 30;

const HYDRATION_START = "odolog:hydration-start";
const HYDRATION_END = "odolog:hydration-end";

function num(v: number | undefined | null): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0
    ? Math.round(v * 100) / 100
    : null;
}

function deviceLabel(): string {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function connectionLabel(): string | null {
  const c = (navigator as unknown as { connection?: { effectiveType?: string } })
    .connection;
  return c?.effectiveType ?? null;
}

export function markHydrationStart(): void {
  try {
    performance.mark(HYDRATION_START);
  } catch {
    /* noop */
  }
}

export function markHydrationEnd(): void {
  try {
    performance.mark(HYDRATION_END);
  } catch {
    /* noop */
  }
}

function hydrationDuration(): number | null {
  try {
    const start = performance.getEntriesByName(HYDRATION_START)[0];
    const end = performance.getEntriesByName(HYDRATION_END)[0];
    if (!start || !end) return null;
    return num(end.startTime - start.startTime);
  } catch {
    return null;
  }
}

function slowResources(limit = 5): SlowResource[] {
  try {
    const entries = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    return entries
      .filter((e) => e.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map((e) => {
        let name = e.name;
        try {
          const u = new URL(e.name);
          name = u.pathname.length > 1 ? u.pathname : u.host;
        } catch {
          /* keep raw */
        }
        return {
          name: name.length > 90 ? `…${name.slice(-88)}` : name,
          duration_ms: num(e.duration) ?? 0,
          size_kb: e.transferSize
            ? Math.round((e.transferSize / 1024) * 10) / 10
            : null,
          kind: e.initiatorType || "other",
        };
      });
  } catch {
    return [];
  }
}

export function readBuffer(): PerfSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(BUFFER_KEY);
    return raw ? (JSON.parse(raw) as PerfSample[]) : [];
  } catch {
    return [];
  }
}

export function clearBuffer(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(BUFFER_KEY);
  } catch {
    /* noop */
  }
}

function pushBuffer(sample: PerfSample): void {
  try {
    const next = [...readBuffer(), sample].slice(-MAX_BUFFER);
    window.sessionStorage.setItem(BUFFER_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

/**
 * Starts collecting for the current page load. Returns a cleanup fn.
 * `flush` is called with buffered samples when the page is hidden.
 */
export function startPerfCollection(
  flush: (samples: PerfSample[]) => Promise<void> | void,
): () => void {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return () => {};
  }

  let lcp: number | null = null;
  let fcp: number | null = null;
  let captured = false;
  const observers: PerformanceObserver[] = [];

  const observe = (type: string, cb: (e: PerformanceEntry) => void) => {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) cb(entry);
      });
      po.observe({ type, buffered: true } as PerformanceObserverInit);
      observers.push(po);
    } catch {
      /* unsupported */
    }
  };

  observe("largest-contentful-paint", (e) => {
    lcp = num(e.startTime);
  });
  observe("paint", (e) => {
    if (e.name === "first-contentful-paint") fcp = num(e.startTime);
  });

  const capture = (): PerfSample | null => {
    if (captured) return null;
    captured = true;
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const hydration = hydrationDuration();
    const total = num(nav?.loadEventEnd || performance.now());
    const sample: PerfSample = {
      route: window.location.pathname,
      device: deviceLabel(),
      connection: connectionLabel(),
      app_version: APP_VERSION,
      ttfb_ms: num(nav ? nav.responseStart - nav.requestStart : null),
      fcp_ms: fcp,
      lcp_ms: lcp,
      hydration_ms: hydration,
      route_load_ms:
        lcp != null && hydration != null && fcp != null
          ? num(Math.max(0, lcp - (fcp + hydration)))
          : null,
      total_ms: total,
      slow_resources: slowResources(),
      captured_at: new Date().toISOString(),
    };
    pushBuffer(sample);
    return sample;
  };

  const onHidden = () => {
    if (document.visibilityState !== "hidden") return;
    capture();
    const buffered = readBuffer();
    if (buffered.length) void flush(buffered);
  };

  // Capture once the load settles, so LCP has had a chance to fire.
  const timer = window.setTimeout(() => {
    capture();
    const buffered = readBuffer();
    if (buffered.length) void flush(buffered);
  }, 6000);

  document.addEventListener("visibilitychange", onHidden);

  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onHidden);
    observers.forEach((o) => o.disconnect());
  };
}

// ---- Aggregation helpers (used by the dashboard) ----

export function percentile(values: number[], p: number): number | null {
  const list = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const idx = Math.min(list.length - 1, Math.floor((p / 100) * list.length));
  return Math.round(list[idx]);
}

export function formatMs(v: number | null | undefined): string {
  if (v == null) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}
