import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listVehicles, listAllRefuels, listAllMaintenance } from "@/lib/data-store";
import { Award, Zap, Fuel, Wrench, Car, Bike, Leaf, Gauge, PiggyBank } from "lucide-react";

interface BadgeDef {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const BADGES: BadgeDef[] = [
  {
    id: "first_refuel",
    label: "First Refuel",
    description: "Logged your first refuel",
    icon: <Fuel className="h-5 w-5" />,
    color: "text-sky-400",
  },
  {
    id: "tank_master",
    label: "Tank Master",
    description: "10 full-tank refuels",
    icon: <Fuel className="h-5 w-5" />,
    color: "text-emerald-400",
  },
  {
    id: "road_warrior",
    label: "Road Warrior",
    description: "Driven 1,000 km total",
    icon: <Gauge className="h-5 w-5" />,
    color: "text-amber-400",
  },
  {
    id: "efficiency_pro",
    label: "Efficiency Pro",
    description: "Achieved 20 km/L or more",
    icon: <PiggyBank className="h-5 w-5" />,
    color: "text-lime-400",
  },
  {
    id: "maintenance_pro",
    label: "Maintenance Pro",
    description: "Logged 5 maintenance items",
    icon: <Wrench className="h-5 w-5" />,
    color: "text-violet-400",
  },
  {
    id: "garage_collector",
    label: "Garage Collector",
    description: "Own 3 or more vehicles",
    icon: <Car className="h-5 w-5" />,
    color: "text-rose-400",
  },
  {
    id: "ev_pioneer",
    label: "EV Pioneer",
    description: "Own an electric vehicle",
    icon: <Zap className="h-5 w-5" />,
    color: "text-teal-400",
  },
  {
    id: "centurion",
    label: "Centurion",
    description: "Single refuel of ₹5,000+",
    icon: <Award className="h-5 w-5" />,
    color: "text-orange-400",
  },
];

function computeUnlocked(
  vehicles: Awaited<ReturnType<typeof listVehicles>>,
  refuels: Awaited<ReturnType<typeof listAllRefuels>>,
  maintenance: Awaited<ReturnType<typeof listAllMaintenance>>,
): Set<string> {
  const unlocked = new Set<string>();

  if (refuels.length > 0) unlocked.add("first_refuel");
  if (refuels.filter((r) => r.full_tank).length >= 10) unlocked.add("tank_master");
  if (refuels.some((r) => Number(r.amount_inr) >= 5000)) unlocked.add("centurion");

  // Total distance across all vehicles (max - min odo per vehicle)
  const odoByVehicle = new Map<string, number[]>();
  for (const r of refuels) {
    if (r.odo_km == null) continue;
    const arr = odoByVehicle.get(r.vehicle_id) ?? [];
    arr.push(Number(r.odo_km));
    odoByVehicle.set(r.vehicle_id, arr);
  }
  let totalKm = 0;
  for (const arr of odoByVehicle.values()) {
    if (arr.length >= 2) {
      totalKm += Math.max(...arr) - Math.min(...arr);
    }
  }
  if (totalKm >= 1000) unlocked.add("road_warrior");

  // Efficiency: km/L >= 20 for any vehicle
  for (const v of vehicles) {
    const vRefuels = refuels.filter((r) => r.vehicle_id === v.id);
    if (vRefuels.length < 2) continue;
    const odo = vRefuels.map((r) => Number(r.odo_km)).filter((n) => !isNaN(n));
    const litres = vRefuels.reduce((s, r) => s + Number(r.litres), 0);
    if (odo.length >= 2 && litres > 0) {
      const km = Math.max(...odo) - Math.min(...odo);
      if (km / litres >= 20) unlocked.add("efficiency_pro");
    }
  }

  if (maintenance.length >= 5) unlocked.add("maintenance_pro");
  if (vehicles.length >= 3) unlocked.add("garage_collector");
  if (vehicles.some((v) => v.fuel_type === "electric")) unlocked.add("ev_pioneer");

  return unlocked;
}

export function AchievementBadges() {
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const refuels = useQuery({ queryKey: ["all-refuels"], queryFn: listAllRefuels });
  const maintenance = useQuery({ queryKey: ["all-maintenance"], queryFn: listAllMaintenance });

  const unlocked = useMemo(() => {
    if (!vehicles.data || !refuels.data || !maintenance.data) return new Set<string>();
    return computeUnlocked(vehicles.data, refuels.data, maintenance.data);
  }, [vehicles.data, refuels.data, maintenance.data]);

  if (!vehicles.data || !refuels.data || !maintenance.data) return null;
  if (unlocked.size === 0) return null;

  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Award className="h-4 w-4 text-primary" />
        Achievements
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BADGES.map((badge) => {
          const isUnlocked = unlocked.has(badge.id);
          return (
            <div
              key={badge.id}
              className={`glass rounded-2xl p-3 text-center transition ${
                isUnlocked ? "opacity-100" : "opacity-40 grayscale"
              }`}
              title={badge.description}
            >
              <div className={`mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5 ${badge.color}`}>
                {badge.icon}
              </div>
              <div className="text-xs font-medium">{badge.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
                {badge.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
