// Unified data layer: routes calls to Supabase when signed in, otherwise
// to localStorage so the app works fully without sign-in.

import { supabase } from "@/integrations/supabase/client";

export type VehicleIcon = "car" | "bike" | "scooter";

export type Vehicle = {
  id: string;
  name: string;
  fuel_type: "petrol" | "diesel" | "cng" | "electric";
  icon: VehicleIcon;
  make: string | null;
  model_year: number | null;
  reg_number: string | null;
  image_url: string | null;
  insurance_expiry: string | null;
  puc_expiry: string | null;
  purchase_date: string | null;
  purchase_price_inr: number | null;
  is_guest: boolean;
  owner_name: string | null;
  /** Carburettor bikes with a main/reserve fuel tap. */
  has_reserve: boolean;
  reserve_litres: number | null;
  created_at: string;
};


export type FuelSubtype = "normal" | "e20" | "xp95" | "xp100" | null;

/** Tank the rider was on when they pulled in to refuel. */
export type TankState = "main" | "reserve" | null;

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
  fuel_subtype: FuelSubtype;
  fuel_brand: string | null;
  tank_state: TankState;
  /** Tank the rider was on after filling (tap flipped back to main, or left on reserve). */
  tank_state_after?: TankState;
  reserve_km: number | null;
  /** Odometer reading when the rider flipped the tap to reserve. */
  reserve_switch_odo_km?: number | null;
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
  condition: string | null;
  next_service_odo_km: number | null;
  next_service_date: string | null;
  created_at: string;
};


export type Trip = {
  id: string;
  vehicle_id: string;
  start_odo_km: number | null;
  end_odo_km: number | null;
  purpose: string | null;
  tolls_inr: number | null;
  notes: string | null;
  trip_date: string;
  created_at: string;
};

export type Profile = {
  display_name: string;
  default_city: string;
};

const LS_VEHICLES = "odolog.vehicles";
const LS_REFUELS = "odolog.refuels";
const LS_MAINT = "odolog.maintenance";
const LS_PROFILE = "odolog.profile";
const LS_TRIPS = "odolog.trips";

const LEGACY_KEYS: Record<string, string> = {
  [LS_VEHICLES]: "fuelogue.vehicles",
  [LS_REFUELS]: "fuelogue.refuels",
  [LS_MAINT]: "fuelogue.maintenance",
  [LS_PROFILE]: "fuelogue.profile",
};

function lsRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    let v = window.localStorage.getItem(key);
    const legacyKey = LEGACY_KEYS[key];
    if (!v && legacyKey) {
      v = window.localStorage.getItem(legacyKey);
      if (v) window.localStorage.setItem(key, v);
    }
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
  fuel_type: "petrol" | "diesel" | "cng" | "electric";
  icon?: VehicleIcon;
  make?: string | null;
  model_year?: number | null;
  reg_number?: string | null;
  image_url?: string | null;
  insurance_expiry?: string | null;
  puc_expiry?: string | null;
  purchase_date?: string | null;
  purchase_price_inr?: number | null;
  is_guest?: boolean;
  owner_name?: string | null;
  has_reserve?: boolean;
  reserve_litres?: number | null;
}): Promise<Vehicle> {
  const icon = normIcon(input.icon);
  const extras = {
    make: input.make ?? null,
    model_year: input.model_year ?? null,
    reg_number: input.reg_number ?? null,
    image_url: input.image_url ?? null,
    insurance_expiry: input.insurance_expiry ?? null,
    puc_expiry: input.puc_expiry ?? null,
    purchase_date: input.purchase_date ?? null,
    purchase_price_inr: input.purchase_price_inr ?? null,
    is_guest: input.is_guest ?? false,
    owner_name: input.owner_name ?? null,
    has_reserve: input.has_reserve ?? false,
    reserve_litres: input.reserve_litres ?? null,
  };
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        name: input.name,
        fuel_type: input.fuel_type,
        icon,
        user_id: userId,
        ...extras,
      } as any)
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
    ...extras,
    created_at: new Date().toISOString(),
  };
  const all = lsRead<Vehicle[]>(LS_VEHICLES, []);
  all.push(v);
  lsWrite(LS_VEHICLES, all);
  return v;
}

export async function updateVehicle(
  id: string,
  patch: {
    name?: string;
    icon?: VehicleIcon;
    fuel_type?: "petrol" | "diesel" | "cng" | "electric";
    make?: string | null;
    model_year?: number | null;
    reg_number?: string | null;
    image_url?: string | null;
    insurance_expiry?: string | null;
    puc_expiry?: string | null;
    purchase_date?: string | null;
    purchase_price_inr?: number | null;
    is_guest?: boolean;
    owner_name?: string | null;
    has_reserve?: boolean;
    reserve_litres?: number | null;
  },
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

export async function listAllRefuels(): Promise<
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
        .order("created_at", { ascending: false }),
      supabase.from("vehicles").select("*"),
    ]);
    if (r.error) throw r.error;
    if (v.error) throw v.error;
    refuels = r.data as Refuel[];
    vehicles = (v.data as any[]).map((x) => ({ ...x, icon: normIcon(x.icon) })) as Vehicle[];
  } else {
    refuels = lsRead<Refuel[]>(LS_REFUELS, []).sort((a, b) => {
      const d = b.refuel_date.localeCompare(a.refuel_date);
      return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
    });
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
  fuel_subtype?: FuelSubtype;
  fuel_brand?: string | null;
  tank_state?: TankState;
  reserve_km?: number | null;
}): Promise<void> {
  const userId = await getUserId();
  const subtype = input.fuel_subtype ?? null;
  const brand = input.fuel_brand ?? null;
  const tankState = input.tank_state ?? null;
  const reserveKm = input.reserve_km ?? null;
  if (userId) {
    const { error } = await supabase.from("refuels").insert({
      ...input,
      fuel_subtype: subtype,
      fuel_brand: brand,
      tank_state: tankState,
      reserve_km: reserveKm,
      user_id: userId,
    } as any);
    if (error) throw error;
    return;
  }
  const r: Refuel = {
    id: uid(),
    ...input,
    fuel_subtype: subtype,
    fuel_brand: brand,
    tank_state: tankState,
    reserve_km: reserveKm,
    notes: null,
    created_at: new Date().toISOString(),
  };
  const all = lsRead<Refuel[]>(LS_REFUELS, []);
  all.push(r);
  lsWrite(LS_REFUELS, all);
}

export async function updateRefuel(
  id: string,
  patch: {
    refuel_date: string;
    amount_inr: number;
    rate_per_litre: number;
    litres: number;
    odo_km: number | null;
    full_tank: boolean;
    fuel_subtype?: FuelSubtype;
    fuel_brand?: string | null;
    tank_state?: TankState;
    reserve_km?: number | null;
  },
): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase
      .from("refuels")
      .update(patch as any)
      .eq("id", id);
    if (error) throw error;
    return;
  }
  const all = lsRead<Refuel[]>(LS_REFUELS, []);
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Refuel not found");
  all[idx] = { ...all[idx], ...patch };
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

// Wipes ALL user data: cloud (when signed in) and local guest data.
// Profile row is reset to empty defaults rather than deleted.
export async function clearAllData(): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    // Delete in FK-safe order; RLS scopes each delete to the current user.
    const r1 = await supabase.from("refuels").delete().eq("user_id", userId);
    if (r1.error) throw r1.error;
    const r2 = await supabase
      .from("maintenance_logs")
      .delete()
      .eq("user_id", userId);
    if (r2.error) throw r2.error;
    const r3 = await supabase.from("vehicles").delete().eq("user_id", userId);
    if (r3.error) throw r3.error;
    await supabase
      .from("profiles")
      .update({ display_name: "", default_city: "delhi" })
      .eq("id", userId);
  }
  // Always clear local data too, regardless of auth state.
  if (typeof window !== "undefined") {
    for (const k of [
      LS_VEHICLES,
      LS_REFUELS,
      LS_MAINT,
      LS_PROFILE,
      "fuelogue.vehicles",
      "fuelogue.refuels",
      "fuelogue.maintenance",
      "fuelogue.profile",
    ]) {
      window.localStorage.removeItem(k);
    }
  }
}

// ---------- Maintenance ----------

export async function listMaintenance(vehicleId: string): Promise<MaintenanceLog[]> {
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase
      .from("maintenance_logs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("service_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as MaintenanceLog[];
  }
  return lsRead<MaintenanceLog[]>(LS_MAINT, [])
    .filter((m) => m.vehicle_id === vehicleId)
    .sort((a, b) => {
      const d = b.service_date.localeCompare(a.service_date);
      return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
    });
}

export async function listAllMaintenance(): Promise<
  (MaintenanceLog & { vehicle_name: string; vehicle_icon: VehicleIcon })[]
> {
  const userId = await getUserId();
  let logs: MaintenanceLog[] = [];
  let vehicles: Vehicle[] = [];
  if (userId) {
    const [m, v] = await Promise.all([
      supabase
        .from("maintenance_logs")
        .select("*")
        .order("service_date", { ascending: false }),
      supabase.from("vehicles").select("*"),
    ]);
    if (m.error) throw m.error;
    if (v.error) throw v.error;
    logs = m.data as MaintenanceLog[];
    vehicles = (v.data as any[]).map((x) => ({
      ...x,
      icon: normIcon(x.icon),
    })) as Vehicle[];
  } else {
    logs = lsRead<MaintenanceLog[]>(LS_MAINT, []).sort((a, b) =>
      b.service_date.localeCompare(a.service_date),
    );
    vehicles = lsRead<Vehicle[]>(LS_VEHICLES, []).map((v) => ({
      ...v,
      icon: normIcon((v as any).icon),
    }));
  }
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  return logs.map((m) => {
    const v = byId.get(m.vehicle_id);
    return {
      ...m,
      vehicle_name: v?.name ?? "Unknown",
      vehicle_icon: v?.icon ?? "car",
    };
  });
}



export async function addMaintenance(input: {
  vehicle_id: string;
  service_date: string;
  service_type: string;
  odo_km: number | null;
  cost_inr: number | null;
  notes: string | null;
  condition?: string | null;
  next_service_odo_km: number | null;
  next_service_date: string | null;
}): Promise<void> {
  const payload = { condition: input.condition ?? null, ...input };
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase.from("maintenance_logs").insert({
      ...payload,
      user_id: userId,
    });
    if (error) throw error;
    return;
  }
  const m: MaintenanceLog = {
    id: uid(),
    ...payload,
    condition: payload.condition ?? null,
    created_at: new Date().toISOString(),
  };
  const all = lsRead<MaintenanceLog[]>(LS_MAINT, []);
  all.push(m);
  lsWrite(LS_MAINT, all);
}


export async function deleteMaintenance(id: string): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase.from("maintenance_logs").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  lsWrite(
    LS_MAINT,
    lsRead<MaintenanceLog[]>(LS_MAINT, []).filter((m) => m.id !== id),
  );
}

export async function listTrips(vehicleId: string): Promise<Trip[]> {
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("trip_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Trip[];
  }
  const all = lsRead<Trip[]>(LS_TRIPS, [])
    .filter((t) => t.vehicle_id === vehicleId)
    .sort((a, b) => {
      const d = b.trip_date.localeCompare(a.trip_date);
      return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
    });
  return all;
}

export async function addTrip(input: {
  vehicle_id: string;
  start_odo_km: number | null;
  end_odo_km: number | null;
  purpose: string | null;
  tolls_inr: number | null;
  notes: string | null;
  trip_date: string;
}): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase.from("trips").insert({ ...input, user_id: userId });
    if (error) throw error;
    return;
  }
  const t: Trip = {
    id: uid(),
    ...input,
    tolls_inr: input.tolls_inr ?? 0,
    created_at: new Date().toISOString(),
  };
  const all = lsRead<Trip[]>(LS_TRIPS, []);
  all.push(t);
  lsWrite(LS_TRIPS, all);
}

export async function deleteTrip(id: string): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  lsWrite(
    LS_TRIPS,
    lsRead<Trip[]>(LS_TRIPS, []).filter((t) => t.id !== id),
  );
}
