import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/gcal/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error || !code || !state) {
          return htmlResponse(
            `<h2>Google Calendar connection failed</h2><p>${error ?? "Missing code/state"}</p>`,
          );
        }

        // State is `${userId}|${origin}` — must split on the first "|" only,
        // because origin contains "https://" (a plain split(":") would mangle it).
        const sep = state.indexOf("|");
        const userId = sep > 0 ? state.slice(0, sep) : "";
        const origin = sep > 0 ? state.slice(sep + 1) : "";
        if (!userId || !origin || !/^https?:\/\//.test(origin)) {
          return htmlResponse(`<h2>Invalid state</h2><p>Could not parse callback state. Try connecting again.</p>`);
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return htmlResponse("<h2>Google OAuth is not configured on the server.</h2>");
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
          return htmlResponse(
            `<h2>Token exchange failed</h2><pre>${escapeHtml(txt)}</pre>`,
          );
        }

        const tok = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
        };

        if (!tok.refresh_token) {
          return htmlResponse(
            `<h2>Missing refresh token</h2><p>Google did not return a refresh token. Revoke OdoLog from your Google account, then try connecting again.</p>`,
          );
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
          return htmlResponse(`<h2>Failed to save token</h2><p>${upsertErr.message}</p>`);
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

function htmlResponse(body: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:24px;max-width:560px;margin:auto">${body}<p><a href="/app/settings">Back to OdoLog settings</a></p></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
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
