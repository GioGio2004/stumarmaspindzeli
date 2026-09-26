"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Role } from "@/lib/status";

type Membership = FunctionReturnType<typeof api.hotels.mine>[number];

type HotelContextValue = {
  loading: boolean;
  memberships: Membership[];
  current: Membership | null;
  hotelId: Id<"hotels"> | null;
  role: Role | null;
  setHotelId: (id: Id<"hotels">) => void;
};

const HotelContext = createContext<HotelContextValue | null>(null);
const STORAGE_KEY = "stumar.hotelId";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The hotel the signed-in member is working in; remembered per browser. */
export function HotelProvider({ children }: { children: ReactNode }) {
  const memberships = useQuery(api.hotels.mine);
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStored(),
  );

  const current = memberships?.find((m) => m.hotel._id === selected) ?? memberships?.[0] ?? null;

  const setHotelId = (id: Id<"hotels">) => {
    setSelected(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // private mode: the choice just isn't remembered
    }
  };

  return (
    <HotelContext.Provider
      value={{
        loading: memberships === undefined,
        memberships: memberships ?? [],
        current,
        hotelId: current?.hotel._id ?? null,
        role: (current?.role as Role | undefined) ?? null,
        setHotelId,
      }}
    >
      {children}
    </HotelContext.Provider>
  );
}

export function useHotel() {
  const value = useContext(HotelContext);
  if (!value) throw new Error("useHotel must be used inside HotelProvider");
  return value;
}

/** For pages rendered inside the app shell, where a hotel is guaranteed. */
export function useActiveHotel() {
  const { current, hotelId, role } = useHotel();
  if (!current || !hotelId || !role) throw new Error("No active hotel");
  return { membership: current, hotel: current.hotel, hotelId, role };
}
