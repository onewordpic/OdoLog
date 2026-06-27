import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Link as LinkIcon, Loader2, Lock, Check, Copy, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listVehicles, type Vehicle } from "@/lib/data-store";
import { setPublicHandle, setPublicBio, setVehicleVisibility } from "@/lib/insights.functions";

type VehicleWithVis = Vehicle & { garage_visibility?: "private" | "public" };

export function PublicGarageCard() {
  const qc = useQueryClient();
  const setHandle = useServerFn(setPublicHandle);
  const setBio = useServerFn(setPublicBio);
  const setVis = useServerFn(setVehicleVisibility);

  const profile = useQuery({
    queryKey: ["public-garage-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("public_handle, public_bio")
        .maybeSingle();
      return data ?? { public_handle: null, public_bio: null };
    },
  });

  // Load vehicles with visibility (data-store doesn't return the column,
  // so fetch directly from supabase here)
  const vehiclesQ = useQuery({
    queryKey: ["vehicles-with-visibility"],
    queryFn: async () => {
      const list = await listVehicles();
      const { data } = await supabase
        .from("vehicles")
        .select("id, garage_visibility");
      const visMap = new Map((data ?? []).map((r: any) => [r.id, r.garage_visibility]));
      return list.map((v) => ({ ...v, garage_visibility: visMap.get(v.id) ?? "private" })) as VehicleWithVis[];
    },
  });

  const [handle, setHandleState] = useState("");
  const [bio, setBioState] = useState("");

  useEffect(() => {
    if (profile.data) {
      setHandleState((profile.data as any).public_handle ?? "");
      setBioState((profile.data as any).public_bio ?? "");
    }
  }, [profile.data]);

  const saveHandle = useMutation({
    mutationFn: async (h: string | null) => setHandle({ data: { handle: h } }),
    onSuccess: () => {
      toast.success(handle ? "Public handle saved" : "Handle removed");
      qc.invalidateQueries({ queryKey: ["public-garage-profile"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save handle"),
  });

  const saveBio = useMutation({
    mutationFn: async (b: string | null) => setBio({ data: { bio: b } }),
    onSuccess: () => {
      toast.success("Bio saved");
      qc.invalidateQueries({ queryKey: ["public-garage-profile"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save bio"),
  });

  const toggleVis = useMutation({
    mutationFn: async (args: { id: string; visibility: "private" | "public" }) =>
      setVis({ data: { vehicleId: args.id, visibility: args.visibility } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles-with-visibility"] }),
    onError: (e: any) => toast.error(e?.message ?? "Couldn't update"),
  });

  const liveHandle = (profile.data as any)?.public_handle ?? null;
  const publicUrl = liveHandle ? `https://odolog.lovable.app/g/${liveHandle}` : null;
  const publicCount = (vehiclesQ.data ?? []).filter((v) => v.garage_visibility === "public").length;

  return (
    <section className="glass rounded-3xl p-5 sm:p-6 space-y-4">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Globe className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Public garage</h2>
          <p className="text-xs text-muted-foreground">
            Share a clean read-only page of your garage. No PII — reg numbers, insurance, and refuel logs stay private.
          </p>
        </div>
      </header>

      {/* Handle */}
      <div>
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Your handle</label>
        <div className="mt-1 flex items-stretch gap-2">
          <div className="flex items-center rounded-xl glass-input px-3 text-xs text-muted-foreground">odolog.app/g/</div>
          <input
            value={handle}
            onChange={(e) => setHandleState(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30))}
            placeholder="safwan"
            className="flex-1 rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm tabular-nums"
          />
          <button
            onClick={() => saveHandle.mutate(handle.trim() || null)}
            disabled={saveHandle.isPending || handle === (liveHandle ?? "")}
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saveHandle.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          3–30 chars, lowercase letters/numbers/hyphen/underscore.
        </p>
      </div>

      {/* Bio */}
      <div>
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Short bio (optional)</label>
        <textarea
          value={bio}
          onChange={(e) => setBioState(e.target.value.slice(0, 280))}
          rows={2}
          placeholder="Weekend rider · Kerala highways · KTM + Honda"
          className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-2.5 text-sm"
        />
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{bio.length}/280</span>
          <button
            onClick={() => saveBio.mutate(bio.trim() || null)}
            disabled={saveBio.isPending || bio === ((profile.data as any)?.public_bio ?? "")}
            className="rounded-full glass-subtle px-3 py-1 text-[11px] font-medium disabled:opacity-50"
          >
            Save bio
          </button>
        </div>
      </div>

      {/* Live URL */}
      {publicUrl && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
          <LinkIcon className="h-3.5 w-3.5 text-primary" />
          <a href={publicUrl} target="_blank" rel="noreferrer" className="flex-1 truncate text-xs font-medium underline-offset-2 hover:underline">
            {publicUrl}
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Copied");
            }}
            className="rounded-full p-1.5 hover:bg-foreground/5"
            aria-label="Copy public garage URL"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Vehicles */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Which vehicles to show
          </label>
          {liveHandle && (
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] tabular-nums">
              {publicCount} public
            </span>
          )}
        </div>
        {!liveHandle && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            <Sparkles className="h-3.5 w-3.5" /> Claim a handle above first, then choose which vehicles to make public.
          </div>
        )}
        <div className="mt-2 space-y-1.5">
          {(vehiclesQ.data ?? []).map((v) => {
            const isPublic = v.garage_visibility === "public";
            return (
              <div key={v.id} className="flex items-center gap-2 rounded-xl glass-subtle px-3 py-2 text-xs">
                <span className="flex-1 truncate font-medium">{v.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {isPublic ? "Visible" : "Private"}
                </span>
                <button
                  onClick={() =>
                    toggleVis.mutate({
                      id: v.id,
                      visibility: isPublic ? "private" : "public",
                    })
                  }
                  disabled={!liveHandle || toggleVis.isPending}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                    isPublic
                      ? "bg-primary/15 text-primary"
                      : "bg-foreground/5 hover:bg-foreground/10"
                  }`}
                  aria-label={isPublic ? "Make private" : "Make public"}
                >
                  {isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {isPublic ? "Public" : "Private"}
                </button>
              </div>
            );
          })}
          {!vehiclesQ.isLoading && (vehiclesQ.data ?? []).length === 0 && (
            <div className="rounded-xl glass-subtle px-3 py-3 text-center text-xs text-muted-foreground">
              <Lock className="mx-auto mb-1 h-3.5 w-3.5" /> Add a vehicle first.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
