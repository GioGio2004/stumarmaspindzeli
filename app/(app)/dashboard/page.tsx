"use client";

import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, Clock, DoorOpen, Inbox, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActiveHotel } from "@/components/hotel-context";
import { Card, PageHeader, Pill, SectionTitle, Skeleton, StatTile, ease } from "@/components/kit";
import { api } from "@/convex/_generated/api";
import { dayKey, timeAgo, useNow } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { role } = useActiveHotel();
  const router = useRouter();
  useEffect(() => {
    if (role === "staff") router.replace("/queue");
  }, [role, router]);
  if (role === "staff") return null;
  return <Overview />;
}

function Overview() {
  const { hotelId, hotel } = useActiveHotel();
  const now = useNow(60_000);
  const day = dayKey(now, hotel.timezone ?? "Asia/Tbilisi");
  const stats = useQuery(api.stats.overview, { hotelId, day });
  const activity = useQuery(api.stats.activity, { hotelId });

  const openTotal = stats ? stats.openByStatus.open + stats.openByStatus.accepted + stats.openByStatus.in_progress : 0;
  const avgResponse = stats && stats.today.responseCount > 0 ? stats.today.responseMsTotal / stats.today.responseCount / 60_000 : 0;

  return (
    <>
      <PageHeader
        eyebrow="Good to see you"
        title={hotel.name}
        description="What guests asked for today, how fast the team answered, and who is in house."
        actions={
          <Link
            href="/requests"
            className="group inline-flex h-12 items-center gap-3 rounded-full bg-ink pl-5 pr-1.5 text-[15px] font-medium text-white"
          >
            Open the board
            <span className="grid size-9 place-items-center rounded-full bg-lime text-black transition group-hover:rotate-45">
              <ArrowUpRight className="size-4" />
            </span>
          </Link>
        }
      />

      {stats && stats.escalatedOpen > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Link href="/requests" className="flex items-center gap-3 rounded-[24px] bg-red-50 px-5 py-4 text-red-800 ring-1 ring-red-200">
            <AlertTriangle className="size-5 shrink-0" />
            <span className="flex-1 text-[14px] font-medium">
              {stats.escalatedOpen} request{stats.escalatedOpen > 1 ? "s have" : " has"} waited too long without anyone accepting.
            </span>
            <ArrowUpRight className="size-4" />
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats ? (
          <>
            <StatTile label="Open requests" value={openTotal} tone="dark" icon={<Inbox className="size-4" />} hint={`${stats.openByStatus.open} waiting for someone`} />
            <StatTile label="Requests today" value={stats.today.requests} icon={<CheckCheck className="size-4" />} hint={`${stats.today.done} done`} delay={0.05} />
            <StatTile label="Avg. response" value={avgResponse} decimals={1} suffix="min" icon={<Clock className="size-4" />} hint="request → accepted" delay={0.1} />
            <StatTile label="Guests in house" value={stats.inHouse} tone="lime" icon={<DoorOpen className="size-4" />} hint={`${stats.roomsTotal} rooms`} delay={0.15} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[148px] bg-panel" />)
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-[30px] bg-panel p-4 sm:p-5">
            <SectionTitle>Last 7 days</SectionTitle>
            <Card className="pb-4">
              {stats ? <WeekChart days={stats.last7} /> : <Skeleton className="h-52 bg-panel" />}
            </Card>
          </section>

          <section className="rounded-[30px] bg-panel p-4 sm:p-5">
            <SectionTitle>Team load right now</SectionTitle>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {stats?.departmentLoad.map((d, i) => {
                const max = Math.max(1, ...stats.departmentLoad.map((x) => x.open));
                return (
                  <Card key={d.departmentId} delay={0.05 * i} className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-medium">{d.name}</p>
                      <Pill tone={d.open > 0 ? "lime" : "stone"}>{d.open} open</Pill>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel">
                      <motion.div
                        className="h-full rounded-full bg-ink"
                        initial={{ width: 0 }}
                        animate={{ width: `${(d.open / max) * 100}%` }}
                        transition={{ duration: 0.8, ease, delay: 0.2 + i * 0.05 }}
                      />
                    </div>
                    <p className="mt-2 text-[12px] text-black/45">
                      {d.avgResponseMin !== null && d.avgResponseMin !== undefined ? `${d.avgResponseMin} min avg. response today` : "No responses yet today"}
                    </p>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[30px] bg-panel p-4 sm:p-5">
            <SectionTitle>Most requested today</SectionTitle>
            <Card className="p-3">
              {stats && stats.topItems.length > 0 ? (
                <ol className="space-y-1">
                  {stats.topItems.map((item, i) => (
                    <li key={item.key} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-paper">
                      <span className={cn("grid size-7 place-items-center rounded-full text-[12px] font-semibold", i === 0 ? "bg-lime" : "bg-panel")}>{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[14px]">{item.title}</span>
                      <span className="text-[14px] font-medium tabular-nums">{item.count}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-3 py-6 text-center text-[13px] text-black/45">No guest requests yet today</p>
              )}
            </Card>
          </section>

          <section className="rounded-[30px] bg-graphite p-4 text-white sm:p-5">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-[13px] font-medium uppercase tracking-wider text-white/55">Live activity</h2>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-white/60">
                <span className="size-1.5 animate-pulse rounded-full bg-lime" />
                Live
              </span>
            </div>
            <ul className="space-y-1.5">
              {activity === undefined && <Skeleton className="h-40 bg-white/5" />}
              {activity?.length === 0 && <p className="py-6 text-center text-[13px] text-white/45">Quiet so far</p>}
              {activity?.slice(0, 12).map((entry, i) => (
                <motion.li
                  key={`${entry.kind}-${entry.at}-${i}`}
                  className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-2.5"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <span className="grid h-8 min-w-8 place-items-center rounded-xl bg-white/10 px-1.5 text-[12px] font-semibold tabular-nums">
                    {entry.roomNumber ?? "·"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{entry.text}</span>
                  <span className="shrink-0 text-[11px] text-white/45">{timeAgo(entry.at, now)}</span>
                </motion.li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function WeekChart({ days }: { days: { day: string; requests: number; done: number; avgResponseMin?: number | null }[] }) {
  const max = Math.max(4, ...days.map((d) => d.requests));
  return (
    <div>
      <div className="flex h-52 items-end gap-2 sm:gap-4">
        {days.map((d, i) => {
          const label = new Date(`${d.day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" });
          const isToday = i === days.length - 1;
          return (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[12px] font-medium tabular-nums text-black/60">{d.requests || ""}</span>
              <div className="relative flex w-full max-w-14 flex-1 items-end overflow-hidden rounded-2xl bg-paper">
                <motion.div
                  className={cn("w-full rounded-2xl", isToday ? "bg-lime" : "bg-ink")}
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.requests / max) * 100}%` }}
                  transition={{ duration: 0.9, ease, delay: 0.1 + i * 0.06 }}
                />
              </div>
              <span className={cn("text-[12px]", isToday ? "font-medium" : "text-black/45")}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
