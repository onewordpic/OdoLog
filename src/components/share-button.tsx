import { Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  getPrefs,
  DEFAULT_SHARE_MESSAGE,
  DEFAULT_SHARE_URL,
} from "@/lib/prefs";

function buildPayload() {
  const prefs = getPrefs();
  const text = (prefs.shareMessage || DEFAULT_SHARE_MESSAGE).trim();
  const url = (prefs.shareUrl || DEFAULT_SHARE_URL).trim();
  return { title: "OdoLog", text, url };
}

export async function shareOdoLog() {
  const payload = buildPayload();
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share(payload);
      return;
    }
  } catch {
    // user cancelled or unsupported — fall through to clipboard
  }
  try {
    await navigator.clipboard.writeText(`${payload.text} ${payload.url}`.trim());
    toast.success("Share link copied to clipboard");
  } catch {
    toast.error("Couldn't copy link");
  }
}

export function ShareIconButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={shareOdoLog}
      aria-label="Share OdoLog"
      className={
        className ||
        "press flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition"
      }
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}

export function ShareCard() {
  return (
    <div className="relative animate-fade-in-up overflow-hidden rounded-3xl border border-foreground/10 bg-gradient-to-br from-primary/15 via-foreground/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Share2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Spread the word</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Know a friend who'd love a no-nonsense fuel log? Share OdoLog with them.
            Customize the message below.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={shareOdoLog}
              className="press inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background hover:opacity-90"
            >
              <Share2 className="h-3.5 w-3.5" /> Share with friends
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
