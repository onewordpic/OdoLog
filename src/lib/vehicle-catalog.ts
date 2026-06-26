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
