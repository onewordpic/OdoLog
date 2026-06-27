import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/gcal/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        // Direct visit / no OAuth params — show a friendly idle screen.
        if (!code && !state && !error) {
          return renderShell({
            variant: "idle",
            title: "Nothing to do here",
            body: `<p>This page is only used while connecting your Google Calendar to OdoLog. You can safely close this tab and head back to settings.</p>`,
            settingsOrigin: null,
          });
        }

        if (error || !code || !state) {
          return renderShell({
            variant: "error",
            title: "Couldn't connect Google Calendar",
            body: `<p>Google didn't return what we needed to complete the connection.</p>`,
            details: error ?? "Missing code or state in the callback URL.",
            settingsOrigin: null,
          });
        }

        // State is `${userId}|${origin}` — must split on the first "|" only,
        // because origin contains "https://" (a plain split(":") would mangle it).
        const sep = state.indexOf("|");
        const userId = sep > 0 ? state.slice(0, sep) : "";
        const origin = sep > 0 ? state.slice(sep + 1) : "";
        if (!userId || !origin || !/^https?:\/\//.test(origin)) {
          return renderShell({
            variant: "error",
            title: "Invalid callback state",
            body: `<p>The connection state from Google didn't match what we sent. Please try connecting again from settings.</p>`,
            settingsOrigin: null,
          });
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return renderShell({
            variant: "error",
            title: "Google OAuth isn't configured",
            body: `<p>The server is missing Google OAuth credentials. Please contact support.</p>`,
            settingsOrigin: origin,
          });
        }

        const redirectUri = `${origin}/api/public/gcal/callback`;
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const txt = await tokenRes.text();
          return renderShell({
            variant: "error",
            title: "Google rejected the token exchange",
            body: `<p>We couldn't finish connecting your account.</p>`,
            details: txt,
            settingsOrigin: origin,
          });
        }

        const tok = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
        };

        if (!tok.refresh_token) {
          return renderShell({
            variant: "error",
            title: "Missing refresh token",
            body: `<p>Google didn't return a refresh token. Revoke OdoLog from your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google account permissions</a>, then try connecting again.</p>`,
            settingsOrigin: origin,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: upsertErr } = await supabaseAdmin
          .from("google_calendar_tokens")
          .upsert({
            user_id: userId,
            access_token: tok.access_token,
            refresh_token: tok.refresh_token,
            expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
            scope: tok.scope ?? null,
            sync_enabled: true,
          });

        if (upsertErr) {
          return renderShell({
            variant: "error",
            title: "Couldn't save your connection",
            body: `<p>We connected to Google but failed to store the token.</p>`,
            details: upsertErr.message,
            settingsOrigin: origin,
          });
        }

        // Bounce back to the settings page.
        return new Response(null, {
          status: 302,
          headers: { Location: `${origin}/app/settings?gcal=connected` },
        });
      },
    },
  },
});

// ---------- Branded status shell ----------

type Variant = "success" | "error" | "idle";

function renderShell(opts: {
  variant: Variant;
  title: string;
  body: string;
  details?: string;
  settingsOrigin: string | null;
}) {
  const settingsHref = opts.settingsOrigin
    ? `${opts.settingsOrigin}/app/settings`
    : `/app/settings`;

  const accent =
    opts.variant === "success"
      ? "#34d399"
      : opts.variant === "error"
      ? "#f87171"
      : "#a8b3bd";

  const icon =
    opts.variant === "success"
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`
      : opts.variant === "error"
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`;

  const detailsBlock = opts.details
    ? `<details style="margin-top:14px"><summary style="cursor:pointer;color:#a8b3bd;font-size:12px;letter-spacing:.04em;text-transform:uppercase">Technical details</summary><pre style="margin-top:8px;padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:#cdd5dd;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto">${escapeHtml(opts.details)}</pre></details>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(opts.title)} · OdoLog</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; min-height:100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, system-ui, sans-serif;
    color: #e7ecf1;
    background:
      radial-gradient(900px 600px at 12% 0%, rgba(52,211,153,.18), transparent 60%),
      radial-gradient(700px 500px at 100% 100%, rgba(96,165,250,.12), transparent 60%),
      linear-gradient(180deg, #0b0f0d 0%, #0a0d10 100%);
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .wordmark {
    position: absolute; top: 22px; left: 24px;
    font-weight: 700; letter-spacing: -.01em; font-size: 15px;
    color: #e7ecf1; opacity: .9;
  }
  .wordmark .dot { color: #34d399; }
  .card {
    width: 100%; max-width: 420px;
    background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.02));
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 24px;
    padding: 28px 24px;
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    box-shadow: 0 30px 80px -30px rgba(0,0,0,.6);
  }
  .iconwrap {
    width: 44px; height: 44px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    background: ${accent}1a; color: ${accent};
    margin-bottom: 14px;
  }
  .iconwrap svg { width: 22px; height: 22px; }
  h1 { font-size: 19px; font-weight: 700; margin: 0 0 6px; letter-spacing: -.01em; }
  p { margin: 6px 0; font-size: 14px; line-height: 1.55; color: #cdd5dd; }
  a { color: ${accent}; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .actions { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 14px; border-radius: 12px; font-size: 13px; font-weight: 600;
    border: 1px solid rgba(255,255,255,.1); color: #e7ecf1;
    background: rgba(255,255,255,.04); text-decoration: none;
    transition: background .15s ease;
  }
  .btn:hover { background: rgba(255,255,255,.08); text-decoration: none; }
  .btn.primary { background: ${accent}; color: #0b0f0d; border-color: transparent; }
  .btn.primary:hover { filter: brightness(1.05); }
  @media (max-width: 480px) {
    .card { padding: 22px 18px; border-radius: 20px; }
    .wordmark { top: 16px; left: 18px; }
  }
</style>
</head>
<body>
  <div class="wordmark">OdoLog<span class="dot">.</span></div>
  <main class="card" role="main">
    <div class="iconwrap" aria-hidden="true">${icon}</div>
    <h1>${escapeHtml(opts.title)}</h1>
    ${opts.body}
    ${detailsBlock}
    <div class="actions">
      <a class="btn primary" href="${settingsHref}">Back to settings</a>
      ${opts.variant === "error" ? `<a class="btn" href="${settingsHref}">Try again</a>` : ""}
    </div>
  </main>
  <script>
    // If this page was opened as a popup by the connect flow, notify the opener and close.
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: "odolog:gcal-callback", variant: ${JSON.stringify(opts.variant)} }, "*");
        if (${JSON.stringify(opts.variant)} === "success") {
          setTimeout(function(){ window.close(); }, 1200);
        }
      }
    } catch (e) {}
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] as string));
}
