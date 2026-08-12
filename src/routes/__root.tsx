import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { initThemeFromStorage } from "@/components/theme-toggle";
import { initThemingFromStorage } from "@/lib/theming";
import { Toaster } from "@/components/ui/sonner";

const InstallPrompt = lazy(() =>
  import("@/components/install-prompt").then((m) => ({ default: m.InstallPrompt })),
);

const PerfCollector = lazy(() =>
  import("@/components/perf-collector").then((m) => ({ default: m.PerfCollector })),
);


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md rounded-2xl p-10 text-center">
        <h1 className="text-6xl font-light tracking-tight">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page drifted off the map.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md rounded-2xl p-10 text-center">
        <h1 className="text-xl font-medium">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full glass px-5 py-2 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "OdoLog — Track fuel & cost per km" },
      {
        name: "description",
        content:
          "OdoLog tracks vehicle fuel consumption, calculating litres from INR spent, odometer readings, and daily fuel rates.",
      },
      { name: "theme-color", content: "#1c1917" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "OdoLog" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "OdoLog — Track fuel & cost per km" },
      {
        property: "og:description",
        content:
          "OdoLog tracks vehicle fuel consumption, calculating litres from INR spent, odometer readings, and daily fuel rates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "OdoLog — Track fuel & cost per km" },
      { name: "twitter:description", content: "Track your fuel consumption, log maintenance log and a lot more." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7650fee0-1176-4445-9fa6-16a034751866/id-preview-c0a707d1--21669def-ed77-42ec-a79e-6632364c7423.lovable.app-1782468456641.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7650fee0-1176-4445-9fa6-16a034751866/id-preview-c0a707d1--21669def-ed77-42ec-a79e-6632364c7423.lovable.app-1782468456641.png" },
      { name: "description", content: "Track your fuel consumption, log maintenance log and a lot more." },
      { property: "og:description", content: "Track your fuel consumption, log maintenance log and a lot more." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [perfOn, setPerfOn] = useState(false);

  useEffect(() => {
    initThemeFromStorage();
    initThemingFromStorage();
    markHydrationStart();
    const sync = () => setPerfOn(getPrefs().perfProfiling);
    sync();
    window.addEventListener(PREFS_EVENT, sync);
    return () => window.removeEventListener(PREFS_EVENT, sync);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      )
        return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Suspense fallback={null}>
        <InstallPrompt />
      </Suspense>
      {perfOn && (
        <Suspense fallback={null}>
          <PerfCollector />
        </Suspense>
      )}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}

