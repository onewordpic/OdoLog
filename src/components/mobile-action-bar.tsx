import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Fuel, Route as RouteIcon, X, ChevronRight, LayoutGrid } from "lucide-react";
import { listVehicles, type Vehicle } from "@/lib/data-store";
import { useQuery } from "@tanstack/react-query";
import { VehicleIcon } from "@/components/vehicle-icon";
import { TripPlannerModal } from "@/components/trip-planner-modal";
import { getPrefs, PREFS_EVENT } from "@/lib/prefs";

/**
 * Sticky mobile action bar — three actions only:
 *  - Log fuel (primary, mint pill)
 *  - Trip insight (secondary, icon-only)
 *  - Garage (secondary, icon-only)
 *
 * Uses a neutral surface so it never blends into the green "Active
 * vehicle" hero card. The primary pill can be pinned left or right via
 * the user's `handed` preference.
 */
export function MobileActionBar({
  onAddVehicle: _onAddVehicle,
}: {
  // Kept for backwards-compat; bar no longer triggers add-vehicle directly.
  onAddVehicle?: () => void;
}) {
  const navigate = useNavigate();
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const [picker, setPicker] = useState(false);
  const [trip, setTrip] = useState(false);
  const [handed, setHanded] = useState<"left" | "right">("right");

  useEffect(() => {
    const sync = () => setHanded(getPrefs().handed);
    sync();
    window.addEventListener(PREFS_EVENT, sync);
    return () => window.removeEventListener(PREFS_EVENT, sync);
  }, []);

  function logFuel() {
    const list = (vehicles.data ?? []).filter((v) => v.fuel_type !== "electric");
    if (list.length === 0) {
      // No fuelable vehicle — send them to Garage to add one.
      navigate({ to: "/app/garage" });
      return;
    }
    if (list.length === 1) {
      navigate({
        to: "/app/vehicle/$id",
        params: { id: list[0].id },
        search: { refuel: 1 } as any,
      });
      return;
    }
    setPicker(true);
  }

  const primary = (
    <button
      key="log"
      type="button"
      onClick={logFuel}
      className="press flex-1 flex items-center justify-center gap-2 rounded-full bg-[var(--mint-accent)] text-stone-900 py-2.5 text-sm font-semibold shadow-sm"
    >
      <Fuel className="h-4 w-4" /> Log fuel
    </button>
  );

  const secondary = (
    <div key="secondary" className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => setTrip(true)}
        aria-label="Trip insight"
        className="press flex h-11 w-11 items-center justify-center rounded-full bg-foreground/8 hover:bg-foreground/15 text-foreground"
      >
        <RouteIcon className="h-4 w-4" />
      </button>
      <Link
        to="/app/garage"
        aria-label="Garage"
        className="press flex h-11 w-11 items-center justify-center rounded-full bg-foreground/8 hover:bg-foreground/15 text-foreground"
      >
        <Cog className="h-4 w-4" />
      </Link>
    </div>
  );

  return (
    <>
      <div
        className="fixed bottom-0 inset-x-0 z-40 md:hidden pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="mx-auto max-w-md px-3 pb-3 pointer-events-auto">
          <div
            className="rounded-full border border-foreground/10 shadow-[0_8px_30px_rgba(0,0,0,0.18)] flex items-center gap-1.5 p-1.5 bg-[var(--background)]/95 supports-[backdrop-filter]:bg-[var(--background)]/75 supports-[backdrop-filter]:backdrop-blur-xl ring-1 ring-foreground/5"
          >
            {handed === "left"
              ? [primary, secondary]
              : [secondary, primary]}
          </div>
        </div>
      </div>

      {picker && (
        <VehiclePickerSheet
          vehicles={(vehicles.data ?? []).filter(
            (v) => v.fuel_type !== "electric",
          )}
          onClose={() => setPicker(false)}
        />
      )}

      <TripPlannerModal open={trip} onClose={() => setTrip(false)} />
    </>
  );
}

function VehiclePickerSheet({
  vehicles,
  onClose,
}: {
  vehicles: Vehicle[];
  onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/50 backdrop-blur-md animate-fade-in md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 animate-slide-up"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.25rem)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Log fuel for…</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="press flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 hover:bg-foreground/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-3 space-y-1.5">
          {vehicles.map((v) => (
            <li key={v.id}>
              <Link
                to="/app/vehicle/$id"
                params={{ id: v.id }}
                search={{ refuel: 1 } as any}
                onClick={onClose}
                className="press flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 p-3 hover:bg-foreground/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-foreground/5 flex items-center justify-center shrink-0">
                    <VehicleIcon icon={v.icon ?? "car"} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {v.make ? `${v.make} ${v.name}` : v.name}
                    </div>
                    <div className="text-[11px] capitalize text-muted-foreground">
                      {v.fuel_type}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
