// Google Calendar OAuth + sync server functions.
// Per-user OAuth: each signed-in user connects their own Google account.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CAL_API = "https://www.googleapis.com/calendar/v3";

function redirectUri(origin: string) {
  return `${origin}/api/public/gcal/callback`;
}

// ----- Start OAuth: returns an authorize URL -----
export const startGcalOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("Google OAuth not configured");
    const state = `${context.userId}:${data.origin}`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(data.origin),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_SCOPE,
      state,
    });
    return { url: `${GOOGLE_AUTH_URL}?${params.toString()}` };
  });

// ----- Connection status -----
export const getGcalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("google_calendar_tokens")
      .select("user_id, calendar_id, sync_enabled, expires_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, ...(data ?? {}) };
  });

// ----- Disconnect -----
export const disconnectGcal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("google_calendar_tokens")
      .delete()
      .eq("user_id", context.userId);
    return { ok: true };
  });

// ----- Toggle sync -----
export const setGcalSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("google_calendar_tokens")
      .update({ sync_enabled: data.enabled })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ----- Sync upcoming reminders to calendar -----
type EventDraft = {
  summary: string;
  description?: string;
  date: string; // YYYY-MM-DD
};

export const syncGcalReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokenRow } = await context.supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!tokenRow) throw new Error("Google Calendar not connected");
    if (!tokenRow.sync_enabled) return { ok: true, created: 0, skipped: "disabled" };

    // Refresh token if expired
    let accessToken = tokenRow.access_token;
    if (new Date(tokenRow.expires_at).getTime() <= Date.now() + 60_000) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = refreshed.access_token;
      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("user_id", context.userId);
    }

    // Gather events: vehicles + maintenance next_service_date
    const [{ data: vehicles }, { data: maint }] = await Promise.all([
      context.supabase
        .from("vehicles")
        .select("id, name, insurance_expiry, puc_expiry")
        .eq("user_id", context.userId),
      context.supabase
        .from("maintenance_logs")
        .select("vehicle_id, service_type, next_service_date")
        .eq("user_id", context.userId)
        .not("next_service_date", "is", null),
    ]);

    const events: EventDraft[] = [];
    for (const v of vehicles ?? []) {
      if (v.insurance_expiry) {
        events.push({
          summary: `🛡️ Insurance renewal: ${v.name}`,
          description: "Insurance policy expires today. Renew via OdoLog.",
          date: v.insurance_expiry,
        });
      }
      if (v.puc_expiry) {
        events.push({
          summary: `🌱 PUC renewal: ${v.name}`,
          description: "Pollution Under Control certificate expires.",
          date: v.puc_expiry,
        });
      }
    }
    const vehicleNames = new Map((vehicles ?? []).map((v) => [v.id, v.name]));
    for (const m of maint ?? []) {
      if (!m.next_service_date) continue;
      events.push({
        summary: `🔧 ${m.service_type} due: ${vehicleNames.get(m.vehicle_id) ?? "Vehicle"}`,
        description: "Scheduled via OdoLog.",
        date: m.next_service_date,
      });
    }

    let created = 0;
    for (const ev of events) {
      const res = await fetch(
        `${GOOGLE_CAL_API}/calendars/${encodeURIComponent(tokenRow.calendar_id || "primary")}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: ev.summary,
            description: ev.description,
            start: { date: ev.date },
            end: { date: ev.date },
            reminders: {
              useDefault: false,
              overrides: [
                { method: "popup", minutes: 24 * 60 },
                { method: "email", minutes: 7 * 24 * 60 },
              ],
            },
            source: { title: "OdoLog", url: "https://odolog.lovable.app" },
          }),
        },
      );
      if (res.ok) created += 1;
    }
    return { ok: true, created, total: events.length };
  });

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return (await res.json()) as { access_token: string; expires_in: number };
}
