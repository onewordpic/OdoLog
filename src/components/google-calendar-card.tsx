import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Link2, Unlink, RefreshCw } from "lucide-react";
import {
  startGcalOAuth,
  getGcalStatus,
  disconnectGcal,
  setGcalSync,
  syncGcalReminders,
} from "@/lib/gcal.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function GoogleCalendarCard() {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useState(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    return undefined;
  });

  const statusQ = useQuery({
    queryKey: ["gcal-status"],
    queryFn: () => getGcalStatus(),
    enabled: authed === true,
    retry: false,
  });

  const connectMut = useMutation({
    mutationFn: async () => {
      const { url } = await startGcalOAuth({ data: { origin: window.location.origin } });
      window.location.href = url;
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnectGcal(),
    onSuccess: () => {
      toast.success("Google Calendar disconnected");
      qc.invalidateQueries({ queryKey: ["gcal-status"] });
    },
  });

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => setGcalSync({ data: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gcal-status"] }),
  });

  const syncMut = useMutation({
    mutationFn: () => syncGcalReminders(),
    onSuccess: (r: any) => toast.success(`Synced ${r?.created ?? 0} reminder(s) to Google Calendar`),
    onError: (e: any) => toast.error(e?.message ?? "Sync failed"),
  });

  if (authed === false) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Google Calendar</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Sign in to OdoLog with Google to sync maintenance and renewal reminders to your calendar.
        </p>
      </div>
    );
  }

  const connected = statusQ.data?.connected;
  const syncEnabled = statusQ.data?.sync_enabled;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Google Calendar</h3>
        </div>
        {connected && (
          <span className="text-[10px] uppercase tracking-wide rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
            Connected
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Push maintenance due dates, insurance renewals & PUC expiries to your Google Calendar with
        1-day & 1-week reminders.
      </p>

      {!connected ? (
        <button
          onClick={() => connectMut.mutate()}
          disabled={connectMut.isPending}
          className="press w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {connectMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Connect Google Calendar
        </button>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-xl glass-subtle px-3 py-2 text-sm">
            <span>Sync enabled</span>
            <input
              type="checkbox"
              checked={!!syncEnabled}
              onChange={(e) => toggleMut.mutate(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending || !syncEnabled}
              className="press inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {syncMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync now
            </button>
            <button
              onClick={() => disconnectMut.mutate()}
              disabled={disconnectMut.isPending}
              className="press inline-flex items-center justify-center gap-1.5 rounded-xl glass-subtle px-3 py-2 text-xs font-medium"
            >
              <Unlink className="h-3.5 w-3.5" /> Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
