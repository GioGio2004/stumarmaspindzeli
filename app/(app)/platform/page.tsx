"use client";

import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { ArrowUpRight, Building2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useHotel } from "@/components/hotel-context";
import { Avatar, EmptyState, PageHeader, Pill, Segmented, Skeleton, buttonClass } from "@/components/kit";
import { api } from "@/convex/_generated/api";
import { roleLabel, type Role } from "@/lib/status";

export default function PlatformPage() {
  const { current } = useHotel();
  if (!current?.supervisor) {
    return (
      <EmptyState
        title="Supervisor only"
        body="This page is for the platform owner."
        action={
          <Link href="/dashboard" className={buttonClass("primary")}>
            Back to overview
          </Link>
        }
      />
    );
  }
  return <Platform />;
}

function Platform() {
  const hotels = useQuery(api.platform.hotels);
  const users = useQuery(api.platform.users);
  const { setHotelId } = useHotel();
  const [tab, setTab] = useState<"hotels" | "people">("hotels");

  return (
    <>
      <PageHeader
        eyebrow="Supervisor"
        title="All hotels"
        description="Every property and every person on Stumar. You have manager rights everywhere."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "hotels", label: "Hotels" },
              { value: "people", label: "People" },
            ]}
          />
        }
      />
      {tab === "hotels" ? (
        hotels === undefined ? (
          <Skeleton className="h-60 bg-panel" />
        ) : (
          <div className="grid gap-3 rounded-[30px] bg-panel p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
            {hotels.map((row, i) => (
              <motion.div
                key={row.hotel._id}
                className="flex min-h-[190px] flex-col rounded-[24px] bg-white p-5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-full bg-lime">
                    <Building2 className="size-[18px]" />
                  </span>
                  <Pill tone="stone">{row.hotel.slug}</Pill>
                </div>
                <p className="mt-auto pt-6 text-lg font-medium">{row.hotel.name}</p>
                <p className="text-[13px] text-black/50">
                  {row.memberCount} people · {row.roomCount} rooms · {row.inHouse} in house
                </p>
                <Link
                  href="/dashboard"
                  onClick={() => setHotelId(row.hotel._id)}
                  className="mt-4 inline-flex w-max items-center gap-1.5 rounded-full bg-panel px-4 py-2 text-[13px] font-medium transition hover:bg-ink hover:text-white"
                >
                  Open
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        )
      ) : users === undefined ? (
        <Skeleton className="h-60 bg-panel" />
      ) : (
        <div className="rounded-[30px] bg-panel p-3 sm:p-4">
          <ul className="space-y-2">
            {users.map((row, i) => (
              <motion.li
                key={row.user._id}
                className="flex flex-wrap items-center gap-3 rounded-[22px] bg-white px-4 py-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Avatar name={row.user.name} imageUrl={row.user.imageUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{row.user.name}</p>
                  <p className="truncate text-[12px] text-black/45">{row.user.email ?? "No email"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {row.memberships.length === 0 && <Pill tone="outline">No hotel</Pill>}
                  {row.memberships.map((m) => (
                    <Pill key={m.hotelId} tone={m.role === "manager" ? "ink" : "stone"}>
                      {m.hotelName} · {roleLabel[m.role as Role]}
                    </Pill>
                  ))}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
