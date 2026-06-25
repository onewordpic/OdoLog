import { Car, Bike } from "lucide-react";
import type { VehicleIcon as VIcon } from "@/lib/data-store";
import type { ComponentType, SVGProps } from "react";

// Lucide doesn't ship a "scooter" — use a custom inline SVG that matches the lucide stroke style.
function Scooter(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="18" r="3" />
      <path d="M5 18h6l3-9h3" />
      <path d="M14 9l-1-3h-3" />
      <path d="M16 18h-2l-1-4" />
    </svg>
  );
}

const MAP: Record<VIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  car: Car,
  bike: Bike,
  scooter: Scooter,
};

export function VehicleIcon({
  icon,
  className,
}: {
  icon: VIcon;
  className?: string;
}) {
  const C = MAP[icon] ?? Car;
  return <C className={className} />;
}

export const VEHICLE_ICONS: { id: VIcon; label: string }[] = [
  { id: "car", label: "Car" },
  { id: "bike", label: "Bike" },
  { id: "scooter", label: "Scooter" },
];
