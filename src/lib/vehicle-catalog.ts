// Curated catalog of popular vehicles in India for autocomplete suggestions.
// Image URLs point to Wikimedia Commons. If they fail to load the UI falls back
// to a brand-initial badge, so a broken link never breaks the layout.

import type { VehicleIcon } from "@/lib/data-store";

export type CatalogEntry = {
  make: string;
  model: string;
  type: VehicleIcon;
  fuel: "petrol" | "diesel";
  image?: string;
  /** Manufacturer-claimed mileage in km/L (ARAI / company figure). */
  claimed_kmpl?: number;
};

export const VEHICLE_CATALOG: CatalogEntry[] = [
  // ---- Cars ----
  { make: "Maruti Suzuki", model: "Swift", type: "car", fuel: "petrol",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/2024_Suzuki_Swift_Hybrid_Ultra_1.2_Front.jpg/640px-2024_Suzuki_Swift_Hybrid_Ultra_1.2_Front.jpg" },
  { make: "Maruti Suzuki", model: "Baleno", type: "car", fuel: "petrol",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/2022_Suzuki_Baleno_GL_1.5_front.jpg/640px-2022_Suzuki_Baleno_GL_1.5_front.jpg" },
  { make: "Maruti Suzuki", model: "Wagon R", type: "car", fuel: "petrol" },
  { make: "Maruti Suzuki", model: "Alto K10", type: "car", fuel: "petrol" },
  { make: "Maruti Suzuki", model: "Brezza", type: "car", fuel: "petrol" },
  { make: "Maruti Suzuki", model: "Ertiga", type: "car", fuel: "petrol" },
  { make: "Maruti Suzuki", model: "Dzire", type: "car", fuel: "petrol" },
  { make: "Maruti Suzuki", model: "Grand Vitara", type: "car", fuel: "petrol" },

  { make: "Hyundai", model: "i20", type: "car", fuel: "petrol",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/2020_Hyundai_i20_Premium_T-GDi_1.0_Front.jpg/640px-2020_Hyundai_i20_Premium_T-GDi_1.0_Front.jpg" },
  { make: "Hyundai", model: "i10 Nios", type: "car", fuel: "petrol" },
  { make: "Hyundai", model: "Creta", type: "car", fuel: "petrol",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/2020_Hyundai_Creta_Sport_1.5.jpg/640px-2020_Hyundai_Creta_Sport_1.5.jpg" },
  { make: "Hyundai", model: "Venue", type: "car", fuel: "petrol" },
  { make: "Hyundai", model: "Verna", type: "car", fuel: "petrol" },
  { make: "Hyundai", model: "Exter", type: "car", fuel: "petrol" },

  { make: "Tata", model: "Nexon", type: "car", fuel: "petrol",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Tata_Nexon_facelift_front_view.jpg/640px-Tata_Nexon_facelift_front_view.jpg" },
  { make: "Tata", model: "Punch", type: "car", fuel: "petrol" },
  { make: "Tata", model: "Harrier", type: "car", fuel: "diesel" },
  { make: "Tata", model: "Safari", type: "car", fuel: "diesel" },
  { make: "Tata", model: "Tiago", type: "car", fuel: "petrol" },
  { make: "Tata", model: "Altroz", type: "car", fuel: "petrol" },

  { make: "Mahindra", model: "XUV700", type: "car", fuel: "diesel" },
  { make: "Mahindra", model: "XUV300", type: "car", fuel: "petrol" },
  { make: "Mahindra", model: "Thar", type: "car", fuel: "diesel",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Mahindra_Thar_LX_4WD_Hard_Top_2021.jpg/640px-Mahindra_Thar_LX_4WD_Hard_Top_2021.jpg" },
  { make: "Mahindra", model: "Scorpio N", type: "car", fuel: "diesel" },
  { make: "Mahindra", model: "Bolero", type: "car", fuel: "diesel" },

  { make: "Kia", model: "Seltos", type: "car", fuel: "petrol" },
  { make: "Kia", model: "Sonet", type: "car", fuel: "petrol" },
  { make: "Kia", model: "Carens", type: "car", fuel: "petrol" },

  { make: "Honda", model: "City", type: "car", fuel: "petrol",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/2020_Honda_City_RS_1.5_front.jpg/640px-2020_Honda_City_RS_1.5_front.jpg" },
  { make: "Honda", model: "Amaze", type: "car", fuel: "petrol" },
  { make: "Honda", model: "Elevate", type: "car", fuel: "petrol" },

  { make: "Toyota", model: "Innova Crysta", type: "car", fuel: "diesel" },
  { make: "Toyota", model: "Innova Hycross", type: "car", fuel: "petrol" },
  { make: "Toyota", model: "Fortuner", type: "car", fuel: "diesel" },
  { make: "Toyota", model: "Glanza", type: "car", fuel: "petrol" },
  { make: "Toyota", model: "Urban Cruiser Hyryder", type: "car", fuel: "petrol" },

  { make: "Volkswagen", model: "Virtus", type: "car", fuel: "petrol" },
  { make: "Volkswagen", model: "Taigun", type: "car", fuel: "petrol" },
  { make: "Skoda", model: "Slavia", type: "car", fuel: "petrol" },
  { make: "Skoda", model: "Kushaq", type: "car", fuel: "petrol" },

  { make: "Renault", model: "Kwid", type: "car", fuel: "petrol" },
  { make: "Nissan", model: "Magnite", type: "car", fuel: "petrol" },
  { make: "MG", model: "Hector", type: "car", fuel: "petrol" },
  { make: "MG", model: "Astor", type: "car", fuel: "petrol" },

  // ---- Bikes ----
  { make: "Royal Enfield", model: "Classic 350", type: "bike", fuel: "petrol",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Royal_Enfield_Classic_350_Halcyon_Black.jpg/640px-Royal_Enfield_Classic_350_Halcyon_Black.jpg" },
  { make: "Royal Enfield", model: "Hunter 350", type: "bike", fuel: "petrol" },
  { make: "Royal Enfield", model: "Meteor 350", type: "bike", fuel: "petrol" },
  { make: "Royal Enfield", model: "Himalayan", type: "bike", fuel: "petrol" },
  { make: "Royal Enfield", model: "Bullet 350", type: "bike", fuel: "petrol" },

  { make: "Bajaj", model: "Pulsar NS200", type: "bike", fuel: "petrol" },
  { make: "Bajaj", model: "Pulsar 150", type: "bike", fuel: "petrol" },
  { make: "Bajaj", model: "Dominar 400", type: "bike", fuel: "petrol" },
  { make: "Bajaj", model: "Platina 110", type: "bike", fuel: "petrol" },

  { make: "Hero", model: "Splendor Plus", type: "bike", fuel: "petrol" },
  { make: "Hero", model: "HF Deluxe", type: "bike", fuel: "petrol" },
  { make: "Hero", model: "Passion Pro", type: "bike", fuel: "petrol" },
  { make: "Hero", model: "Xtreme 160R", type: "bike", fuel: "petrol" },

  { make: "Honda", model: "Shine", type: "bike", fuel: "petrol" },
  { make: "Honda", model: "Unicorn", type: "bike", fuel: "petrol" },
  { make: "Honda", model: "SP 125", type: "bike", fuel: "petrol" },
  { make: "Honda", model: "CB350", type: "bike", fuel: "petrol" },

  { make: "TVS", model: "Apache RTR 160", type: "bike", fuel: "petrol" },
  { make: "TVS", model: "Apache RTR 200", type: "bike", fuel: "petrol" },
  { make: "TVS", model: "Raider 125", type: "bike", fuel: "petrol" },

  { make: "Yamaha", model: "MT-15", type: "bike", fuel: "petrol" },
  { make: "Yamaha", model: "R15 V4", type: "bike", fuel: "petrol" },
  { make: "Yamaha", model: "FZ-S", type: "bike", fuel: "petrol" },

  { make: "KTM", model: "Duke 200", type: "bike", fuel: "petrol" },
  { make: "KTM", model: "Duke 390", type: "bike", fuel: "petrol" },
  { make: "KTM", model: "RC 390", type: "bike", fuel: "petrol" },

  // ---- Scooters ----
  { make: "Honda", model: "Activa 6G", type: "scooter", fuel: "petrol",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/2020_Honda_Activa_6G.jpg/640px-2020_Honda_Activa_6G.jpg" },
  { make: "Honda", model: "Dio", type: "scooter", fuel: "petrol" },
  { make: "TVS", model: "Jupiter", type: "scooter", fuel: "petrol" },
  { make: "TVS", model: "Ntorq 125", type: "scooter", fuel: "petrol" },
  { make: "Suzuki", model: "Access 125", type: "scooter", fuel: "petrol" },
  { make: "Suzuki", model: "Burgman Street", type: "scooter", fuel: "petrol" },
  { make: "Yamaha", model: "Fascino 125", type: "scooter", fuel: "petrol" },
  { make: "Yamaha", model: "RayZR 125", type: "scooter", fuel: "petrol" },
  { make: "Hero", model: "Pleasure Plus", type: "scooter", fuel: "petrol" },
  { make: "Hero", model: "Destini 125", type: "scooter", fuel: "petrol" },
  { make: "Aprilia", model: "SR 160", type: "scooter", fuel: "petrol" },
];

export function searchCatalog(query: string, limit = 6): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const scored: { e: CatalogEntry; s: number }[] = [];
  for (const e of VEHICLE_CATALOG) {
    const model = e.model.toLowerCase();
    const make = e.make.toLowerCase();
    const full = `${make} ${model}`;
    let s = 0;
    if (model === q || full === q) s = 100;
    else if (model.startsWith(q)) s = 80;
    else if (full.startsWith(q)) s = 70;
    else if (model.includes(q)) s = 50;
    else if (make.includes(q) || full.includes(q)) s = 30;
    if (s > 0) scored.push({ e, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.e);
}

// Stable color per brand for the fallback badge.
export function brandColor(make: string): string {
  let h = 0;
  for (let i = 0; i < make.length; i++) h = (h * 31 + make.charCodeAt(i)) >>> 0;
  return `oklch(0.65 0.14 ${h % 360})`;
}

export function brandInitials(make: string): string {
  return make
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Look up the manufacturer-claimed (ARAI / company) mileage in km/L from the
 * catalog. Matches by exact model first, then model+make case-insensitive.
 * Returns null if no claim is recorded.
 */
export function claimedMileage(
  name: string | null | undefined,
  make: string | null | undefined,
): number | null {
  const n = (name ?? "").trim().toLowerCase();
  const m = (make ?? "").trim().toLowerCase();
  if (!n) return null;
  // Exact match on model + make wins.
  const byBoth = VEHICLE_CATALOG.find(
    (e) =>
      e.model.toLowerCase() === n &&
      (m ? e.make.toLowerCase() === m : true) &&
      e.claimed_kmpl != null,
  );
  if (byBoth?.claimed_kmpl != null) return byBoth.claimed_kmpl;
  // Fallback: model-only match.
  const byModel = VEHICLE_CATALOG.find(
    (e) => e.model.toLowerCase() === n && e.claimed_kmpl != null,
  );
  return byModel?.claimed_kmpl ?? null;
}

// ---- Manufacturer-claimed mileage (ARAI / company figures, approximate) ----
// Attach claimed_kmpl to a handful of popular entries. Anything not listed
// just returns null from claimedMileage() — UI hides the chip gracefully.
const CLAIMED: Record<string, number> = {
  // cars
  "maruti suzuki|swift": 22.4,
  "maruti suzuki|baleno": 22.3,
  "maruti suzuki|wagon r": 24.4,
  "maruti suzuki|alto k10": 24.4,
  "maruti suzuki|brezza": 20.1,
  "maruti suzuki|ertiga": 20.5,
  "maruti suzuki|dzire": 23.3,
  "maruti suzuki|grand vitara": 21.1,
  "hyundai|i20": 20.0,
  "hyundai|i10 nios": 20.7,
  "hyundai|creta": 17.7,
  "hyundai|venue": 17.5,
  "hyundai|verna": 20.6,
  "hyundai|exter": 19.4,
  "tata|nexon": 17.4,
  "tata|punch": 18.8,
  "tata|harrier": 16.8,
  "tata|safari": 16.3,
  "tata|tiago": 19.0,
  "tata|altroz": 19.3,
  "mahindra|xuv700": 16.0,
  "mahindra|xuv300": 17.0,
  "mahindra|thar": 15.2,
  "mahindra|scorpio n": 15.0,
  "mahindra|bolero": 16.0,
  "kia|seltos": 17.7,
  "kia|sonet": 18.4,
  "kia|carens": 17.9,
  "honda|city": 17.8,
  "honda|amaze": 18.6,
  "honda|elevate": 15.3,
  "toyota|innova crysta": 13.5,
  "toyota|innova hycross": 21.1,
  "toyota|fortuner": 14.4,
  "toyota|glanza": 22.3,
  "toyota|urban cruiser hyryder": 21.1,
  "volkswagen|virtus": 18.5,
  "volkswagen|taigun": 18.5,
  "skoda|slavia": 19.4,
  "skoda|kushaq": 18.0,
  "renault|kwid": 22.0,
  "nissan|magnite": 19.7,
  "mg|hector": 13.7,
  "mg|astor": 14.5,
  // bikes
  "royal enfield|classic 350": 41.0,
  "royal enfield|hunter 350": 36.2,
  "royal enfield|meteor 350": 41.0,
  "royal enfield|himalayan": 32.0,
  "royal enfield|bullet 350": 37.0,
  "bajaj|pulsar ns200": 35.0,
  "bajaj|pulsar 150": 50.0,
  "bajaj|dominar 400": 28.0,
  "bajaj|platina 110": 70.0,
  "hero|splendor plus": 80.6,
  "hero|hf deluxe": 83.0,
  "hero|passion pro": 60.0,
  "hero|xtreme 160r": 45.0,
  "honda|shine": 65.0,
  "honda|unicorn": 51.0,
  "honda|sp 125": 65.0,
  "honda|cb350": 38.0,
  "tvs|apache rtr 160": 45.0,
  "tvs|apache rtr 200": 40.0,
  "tvs|raider 125": 67.0,
  "yamaha|mt-15": 47.0,
  "yamaha|r15 v4": 47.0,
  "yamaha|fz-s": 45.0,
  "ktm|duke 200": 35.0,
  "ktm|duke 390": 27.0,
  "ktm|rc 390": 27.0,
  // scooters
  "honda|activa 6g": 47.0,
  "honda|dio": 55.0,
  "tvs|jupiter": 62.0,
  "tvs|ntorq 125": 47.0,
  "suzuki|access 125": 64.0,
  "suzuki|burgman street": 47.0,
  "yamaha|fascino 125": 50.0,
  "yamaha|rayzr 125": 50.0,
  "hero|pleasure plus": 55.0,
  "hero|destini 125": 50.0,
  "aprilia|sr 160": 35.0,
};

for (const e of VEHICLE_CATALOG) {
  const k = `${e.make.toLowerCase()}|${e.model.toLowerCase()}`;
  if (CLAIMED[k] != null) e.claimed_kmpl = CLAIMED[k];
}
