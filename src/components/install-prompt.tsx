import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * Polite, non-annoying install prompt.
 * - Shows on browser (not standalone, not Lovable preview).
 * - Waits until the user has visited at least twice.
 * - Snoozes for 14 days when dismissed; after 3 dismissals, never shows again.
 */

const VISITS_KEY = "odolog.visitCount";
const SNOOZE_KEY = "odolog.installPromptDismissedAt";
const COUNT_KEY = "odolog.installPromptDismissCount";
const SNOOZE_MS = 14 * 24 * 3600 * 1000;
const MAX_DISMISS = 3;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  return Boolean((window.navigator as any).standalone);
}

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") ||
    h.endsWith(".beta.lovable.dev") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

export function InstallPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || isPreviewHost()) return;

    // Track visits (per session).
    try {
      if (!sessionStorage.getItem("odolog.visitedThisSession")) {
        const next = (parseInt(localStorage.getItem(VISITS_KEY) || "0", 10) || 0) + 1;
        localStorage.setItem(VISITS_KEY, String(next));
        sessionStorage.setItem("odolog.visitedThisSession", "1");
      }
    } catch {}

    const visits = parseInt(localStorage.getItem(VISITS_KEY) || "0", 10) || 0;
    if (visits < 2) return;

    const dismissCount = parseInt(localStorage.getItem(COUNT_KEY) || "0", 10) || 0;
    if (dismissCount >= MAX_DISMISS) return;

    const snoozedAt = parseInt(localStorage.getItem(SNOOZE_KEY) || "0", 10) || 0;
    if (snoozedAt && Date.now() - snoozedAt < SNOOZE_MS) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
      // Delay so it doesn't pop the moment the page loads.
      setTimeout(() => setShow(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS Safari never fires beforeinstallprompt — show a guidance card.
    if (isIOS()) {
      setIos(true);
      setTimeout(() => setShow(true), 4000);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
      const c = (parseInt(localStorage.getItem(COUNT_KEY) || "0", 10) || 0) + 1;
      localStorage.setItem(COUNT_KEY, String(c));
    } catch {}
  }

  async function install() {
    if (!bip) return;
    try {
      await bip.prompt();
      const { outcome } = await bip.userChoice;
      if (outcome === "accepted") {
        localStorage.removeItem(SNOOZE_KEY);
        localStorage.setItem(COUNT_KEY, String(MAX_DISMISS));
      }
    } catch {}
    setShow(false);
    setBip(null);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 z-[60] pointer-events-none"
      style={{
        // Sit above the mobile action bar; on desktop, float bottom-right.
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
      }}
    >
      <div className="mx-auto max-w-md px-3 pointer-events-auto md:mx-0 md:ml-auto md:mr-4 md:max-w-sm">
        <div className="rounded-2xl bg-stone-900 text-stone-50 dark:bg-stone-50 dark:text-stone-900 shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/10 dark:ring-white/10 p-3 flex items-start gap-3 animate-fade-in-up">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--mint-accent)] text-stone-900 flex items-center justify-center">
            {ios ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Install OdoLog</div>
            <p className="mt-0.5 text-[12px] opacity-80 leading-snug">
              {ios
                ? "Tap Share, then 'Add to Home Screen' for the full app."
                : "Add it to your home screen — faster, offline-friendly, no browser bars."}
            </p>
            {!ios && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={install}
                  className="press rounded-full bg-[var(--mint-accent)] text-stone-900 px-3 py-1.5 text-xs font-semibold"
                >
                  Install
                </button>
                <button
                  onClick={dismiss}
                  className="press rounded-full px-3 py-1.5 text-xs font-medium opacity-70 hover:opacity-100"
                >
                  Not now
                </button>
              </div>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="press flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10 dark:hover:bg-black/10 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
