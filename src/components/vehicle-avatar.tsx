import { VehicleIcon as VIcon } from "@/components/vehicle-icon";
import { brandColor, brandInitials } from "@/lib/vehicle-catalog";
import type { Vehicle, VehicleIcon as VIconType } from "@/lib/data-store";
import { useState } from "react";

type VehicleLike = {
  icon: VIconType;
  make?: string | null;
  image_url?: string | null;
  name?: string;
};

/**
 * Renders a vehicle's photo when available, falling back to a brand badge,
 * then to the generic icon. Use everywhere we previously rendered just the icon.
 */
export function VehicleAvatar({
  vehicle,
  size = 40,
  rounded = "rounded-xl",
  className = "",
}: {
  vehicle: VehicleLike;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const img = vehicle.image_url && !imgFailed ? vehicle.image_url : null;
  const dim = { width: size, height: size };

  if (img) {
    return (
      <div
        className={`relative overflow-hidden ${rounded} ${className}`}
        style={dim}
      >
        <img
          src={img}
          alt={vehicle.name ?? "Vehicle"}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (vehicle.make) {
    const c = brandColor(vehicle.make);
    return (
      <div
        className={`flex items-center justify-center ${rounded} ${className}`}
        style={{
          ...dim,
          background: `linear-gradient(135deg, ${c}, oklch(0.92 0.04 240))`,
        }}
        aria-label={vehicle.make}
      >
        <span
          className="font-semibold text-white drop-shadow-sm"
          style={{ fontSize: size * 0.36 }}
        >
          {brandInitials(vehicle.make)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-primary/10 ${rounded} ${className}`}
      style={dim}
    >
      <VIcon icon={vehicle.icon} className="h-1/2 w-1/2 text-primary" />
    </div>
  );
}

export type { Vehicle };
