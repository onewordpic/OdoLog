// Unified data layer: routes calls to Supabase when signed in, otherwise
// to localStorage so the app works fully without sign-in.

import { supabase } from "@/integrations/supabase/client";

export type VehicleIcon = "car" | "bike" | "scooter";

export type Vehicle = {
  id: string;
  name: string;
  fuel_type: "petrol" | "diesel";
  icon: VehicleIcon;
  created_at: string;
};

export type Refuel = {
  id: string;
  vehicle_id: string;
  refuel_date: string;
  amount_inr: number;
  rate_per_litre: number;
  litres: number;
  odo_km: number | null;
  full_tank: boolean;
  notes: string | null;
  created_at: string;
};

export type MaintenanceLog = {
  id: string;
  vehicle_id: string;
  service_date: string;
  service_type: string;
  odo_km: number | null;
  cost_inr: number | null;
  notes: string | null;
  next_service_odo_km: number | null;
  next_service_date: string | null;
  created_at: string;
};

export type Profile = {
  display_name: string;
  default_city: string;
};

const LS_VEHICLES = "fuelogue.vehicles";
const LS_REFUELS = "fuelogue.refuels";
const LS_PROFILE = "fuelogue.profile";

function lsRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsWrite<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

function normIcon(v: unknown): VehicleIcon {
  return v === "bike" || v === "scooter" ? v : "car";
}

// ---------- Vehicles ----------

export async function listVehicles(): Promise<Vehicle[]> {
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as any[]).map((v) => ({ ...v, icon: normIcon(v.icon) })) as Vehicle[];
  }
  const all = lsRead<Vehicle[]>(LS_VEHICLES, []).map((v) => ({
    ...v,
    icon: normIcon((v as any).icon),
  }));
  return [...all].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return { ...(data as any), icon: normIcon((data as any).icon) } as Vehicle;
  }
  const v = lsRead<Vehicle[]>(LS_VEHICLES, []).find((v) => v.id === id);
  if (!v) throw new Error("Vehicle not found");
  return { ...v, icon: normIcon((v as any).icon) };
}

export async function addVehicle(input: {
  name: string;
  fuel_type: "petrol" | "diesel";
  icon?: VehicleIcon;
}): Promise<Vehicle> {
  const icon = normIcon(input.icon);
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase
      .from("vehicles")
      .insert({ name: input.name, fuel_type: input.fuel_type, icon, user_id: userId } as any)
      .select()
      .single();
    if (error) throw error;
    return { ...(data as any), icon: normIcon((data as any).icon) } as Vehicle;
  }
  const v: Vehicle = {
    id: uid(),
    name: input.name,
    fuel_type: input.fuel_type,
    icon,
    created_at: new Date().toISOString(),
  };
  const all = lsRead<Vehicle[]>(LS_VEHICLES, []);
  all.push(v);
  lsWrite(LS_VEHICLES, all);
  return v;
}

export async function updateVehicle(
  id: string,
  patch: { name?: string; icon?: VehicleIcon; fuel_type?: "petrol" | "diesel" },
): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase
      .from("vehicles")
      .update(patch as any)
      .eq("id", id);
    if (error) throw error;
    return;
  }
  const all = lsRead<Vehicle[]>(LS_VEHICLES, []);
  const next = all.map((v) => (v.id === id ? { ...v, ...patch } : v));
  lsWrite(LS_VEHICLES, next);
}

export async function deleteVehicle(id: string): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  lsWrite(
    LS_VEHICLES,
    lsRead<Vehicle[]>(LS_VEHICLES, []).filter((v) => v.id !== id),
  );
  lsWrite(
    LS_REFUELS,
    lsRead<Refuel[]>(LS_REFUELS, []).filter((r) => r.vehicle_id !== id),
  );
}

// ---------- Refuels ----------

export async function listRefuels(vehicleId: string): Promise<Refuel[]> {
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase
      .from("refuels")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("refuel_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Refuel[];
  }
  return lsRead<Refuel[]>(LS_REFUELS, [])
    .filter((r) => r.vehicle_id === vehicleId)
    .sort((a, b) => {
      const d = b.refuel_date.localeCompare(a.refuel_date);
      return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
    });
}

export async function listRecentRefuels(limit = 10): Promise<
  (Refuel & { vehicle_name: string; vehicle_icon: VehicleIcon })[]
> {
  const userId = await getUserId();
  let refuels: Refuel[] = [];
  let vehicles: Vehicle[] = [];

  if (userId) {
    const [r, v] = await Promise.all([
      supabase
        .from("refuels")
        .select("*")
        .order("refuel_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase.from("vehicles").select("*"),
    ]);
    if (r.error) throw r.error;
    if (v.error) throw v.error;
    refuels = r.data as Refuel[];
    vehicles = (v.data as any[]).map((x) => ({ ...x, icon: normIcon(x.icon) })) as Vehicle[];
  } else {
    refuels = lsRead<Refuel[]>(LS_REFUELS, [])
      .sort((a, b) => {
        const d = b.refuel_date.localeCompare(a.refuel_date);
        return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
      })
      .slice(0, limit);
    vehicles = lsRead<Vehicle[]>(LS_VEHICLES, []).map((v) => ({
      ...v,
      icon: normIcon((v as any).icon),
    }));
  }

  const byId = new Map(vehicles.map((v) => [v.id, v]));
  return refuels.map((r) => {
    const v = byId.get(r.vehicle_id);
    return {
      ...r,
      vehicle_name: v?.name ?? "Unknown",
      vehicle_icon: v?.icon ?? "car",
    };
  });
}

export async function addRefuel(input: {
  vehicle_id: string;
  refuel_date: string;
  amount_inr: number;
  rate_per_litre: number;
  litres: number;
  odo_km: number | null;
  full_tank: boolean;
}): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase.from("refuels").insert({
      ...input,
      user_id: userId,
    });
    if (error) throw error;
    return;
  }
  const r: Refuel = {
    id: uid(),
    ...input,
    notes: null,
    created_at: new Date().toISOString(),
  };
  const all = lsRead<Refuel[]>(LS_REFUELS, []);
  all.push(r);
  lsWrite(LS_REFUELS, all);
}

export async function deleteRefuel(id: string): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase.from("refuels").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  lsWrite(
    LS_REFUELS,
    lsRead<Refuel[]>(LS_REFUELS, []).filter((r) => r.id !== id),
  );
}

export async function dashboardStats(): Promise<{
  spend: number;
  litres: number;
  count: number;
}> {
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase
      .from("refuels")
      .select("amount_inr, litres");
    if (error) throw error;
    return {
      spend: data.reduce((s, r) => s + Number(r.amount_inr), 0),
      litres: data.reduce((s, r) => s + Number(r.litres), 0),
      count: data.length,
    };
  }
  const all = lsRead<Refuel[]>(LS_REFUELS, []);
  return {
    spend: all.reduce((s, r) => s + Number(r.amount_inr), 0),
    litres: all.reduce((s, r) => s + Number(r.litres), 0),
    count: all.length,
  };
}

// ---------- Profile ----------

export async function getProfile(): Promise<Profile> {
  const userId = await getUserId();
  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, default_city")
      .single();
    return {
      display_name: data?.display_name ?? "",
      default_city: data?.default_city ?? "delhi",
    };
  }
  return lsRead<Profile>(LS_PROFILE, { display_name: "", default_city: "delhi" });
}

export async function saveProfile(input: Profile): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: input.display_name.trim(),
        default_city: input.default_city.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw error;
    return;
  }
  lsWrite(LS_PROFILE, {
    display_name: input.display_name.trim(),
    default_city: input.default_city.toLowerCase(),
  });
}

export async function isSignedIn(): Promise<boolean> {
  return (await getUserId()) !== null;
}
