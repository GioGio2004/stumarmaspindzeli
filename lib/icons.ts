import { createElement } from "react";
import {
  Bath,
  BedDouble,
  ChefHat,
  Clock,
  ConciergeBell,
  Droplets,
  Flower2,
  Info,
  Link2,
  Shirt,
  Sparkles,
  Ticket,
  UtensilsCrossed,
  Waves,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Icon keys stored on departments and catalog items. */
export const iconMap: Record<string, LucideIcon> = {
  housekeeping: Sparkles,
  maintenance: Wrench,
  kitchen: ChefHat,
  spa: Flower2,
  reception: ConciergeBell,
  towel: Bath,
  robe: Shirt,
  pillow: BedDouble,
  water: Droplets,
  cleaning: Sparkles,
  repair: Wrench,
  dining: UtensilsCrossed,
  aquapark: Waves,
  ticket: Ticket,
  clock: Clock,
  info: Info,
  link: Link2,
};

export const iconKeys = Object.keys(iconMap);

export function iconFor(key?: string | null): LucideIcon {
  return (key && iconMap[key]) || ConciergeBell;
}

/** Renders the icon stored under `name` without creating a component during render. */
export function IconByKey({ name, className }: { name?: string | null; className?: string }) {
  return createElement(iconFor(name), { className });
}
