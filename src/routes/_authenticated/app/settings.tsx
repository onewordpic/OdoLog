import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

const CITIES = [
  "Delhi",
  "Mumbai",
  "Bangalore",
  "Chennai",
  "Kolkata",
  "Hyderabad",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Kochi",
  "Chandigarh",
];

function SettingsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("delhi");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("display_name, default_city")
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.display_name ?? "");
          setCity(data.default_city ?? "delhi");
        }
        setLoading(false);
      });
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name.trim(),
          default_city: city.toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/app"
          className="glass flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-light tracking-tight">Settings</h1>
      </header>

      {loading ? (
        <div className="glass flex h-24 items-center justify-center rounded-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="glass space-y-5 rounded-2xl p-6"
        >
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Default city for fuel prices
            </span>
            <select
              value={CITIES.find((c) => c.toLowerCase() === city.toLowerCase()) ?? city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-xl glass-input glass-input-focus px-4 py-3 text-sm"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Used to auto-fetch today's petrol/diesel rate when logging a
              refuel.
            </p>
          </label>

          <button
            type="submit"
            disabled={save.isPending}
            className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
    </main>
  );
}
