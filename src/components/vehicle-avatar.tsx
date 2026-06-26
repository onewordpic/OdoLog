import { VehicleIcon as VIcon } from "@/components/vehicle-icon";
import type { Vehicle, VehicleIcon as VIconType } from "@/lib/data-store";
import { useState } from "react";

type VehicleLike = {
  icon: VIconType;
  make?: string | null;
  image_url?: string | null;
  name?: string;
};

/**
 * Renders a vehicle's photo when available, falling back to the
 * user-chosen icon (car / bike / scooter) on a soft tinted tile.
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

