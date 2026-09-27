"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "motion/react";
import { CalendarPlus, Copy, ExternalLink, KeyRound, LogOut, Users } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useActiveHotel } from "@/components/hotel-context";
import {
  ArrowButton,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Pill,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  StatTile,
  TextInput,
  buttonClass,
  useRun,
  useToast,
} from "@/components/kit";
import { RoleGate } from "@/components/role-gate";
import { roomLink } from "@/components/room-link";
import { StatusDot } from "@/components/tasks";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { dayKey, hotelTime, shortDate, startOfHotelDay, useNow } from "@/lib/format";
import type { TaskStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Room = FunctionReturnType<typeof api.rooms.list>[number];

export default function StaysPage() {
  return (
    <RoleGate allow={["manager", "reception"]}>
      <FrontDesk />
    </RoleGate>
  );
}

function FrontDesk() {
  const { hotelId, hotel } = useActiveHotel();
  const rooms = useQuery(api.rooms.list, { hotelId });
  const now = useNow(60_000);
  const [checkInRoom, setCheckInRoom] = useState<Room | null>(null);
  const [openStay, setOpenStay] = useState<{ room: Room; stayId: Id<"stays"> } | null>(null);
  const [filter, setFilter] = useState<"all" | "occupied" | "vacant">("all");

  const floors = useMemo(() => {
    const groups = new Map<string, Room[]>();
    for (const room of rooms ?? []) {
      if (filter === "occupied" && !room.currentStay) continue;
      if (filter === "vacant" && room.currentStay) continue;
      const key = room.floor ?? "—";
      groups.set(key, [...(groups.get(key) ?? []), room]);
    }
    return [...groups.entries()];
  }, [rooms, filter]);

  const occupied = rooms?.filter((r) => r.currentStay).length ?? 0;
  const endOfDay = startOfHotelDay(now + 86_400_000, hotel.timezone);
  const departures = rooms?.filter((r) => r.currentStay && r.currentStay.expectedCheckOutAt < endOfDay).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Front desk"
        title="Rooms & stays"
        description="Check a guest in and their room's tag opens the guest app. Check them out and it closes."
        actions={
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "occupied", label: "In house" },
              { value: "vacant", label: "Vacant" },
            ]}
          />
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="In house" value={occupied} tone="dark" hint={`of ${rooms?.length ?? 0} rooms`} />
        <StatTile label="Vacant" value={(rooms?.length ?? 0) - occupied} delay={0.05} />
        <StatTile label="Leaving today" value={departures} delay={0.1} />
        <StatTile
          label="Occupancy"
          value={rooms?.length ? Math.round((occupied / rooms.length) * 100) : 0}
          suffix="%"
          tone="lime"
          delay={0.15}
        />
      </div>

      {rooms === undefined ? (
        <Skeleton className="h-80 bg-panel" />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="No rooms yet"
          body="Add your rooms first. Each one gets its own tag link."
          action={
            <Link href="/rooms" className={buttonClass("primary")}>
              Add rooms
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {floors.map(([floor, list]) => (
            <section key={floor} className="rounded-[30px] bg-panel p-3 sm:p-4">
              <h2 className="mb-3 px-2 text-[13px] font-medium uppercase tracking-wider text-black/50">
                {floor === "—" ? "No floor" : `Floor ${floor}`}
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {list.map((room, i) => (
                  <RoomTile
                    key={room._id}
                    room={room}
                    index={i}
                    hidden={checkInRoom?._id === room._id || openStay?.room._id === room._id}
                    onClick={() =>
                      room.currentStay ? setOpenStay({ room, stayId: room.currentStay.stayId }) : setCheckInRoom(room)
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <CheckInSheet
        room={checkInRoom}
        onClose={() => setCheckInRoom(null)}
        onCheckedIn={(room, stayId) => {
          // Straight to the stay: reception reads the guest PIN out right away.
          setCheckInRoom(null);
          setOpenStay({ room, stayId });
        }}
      />
      <StaySheet room={openStay?.room ?? null} stayId={openStay?.stayId ?? null} onClose={() => setOpenStay(null)} />
    </>
  );
}

function RoomTile({ room, index, hidden, onClick }: { room: Room; index: number; hidden: boolean; onClick: () => void }) {
  const stay = room.currentStay;
  return (
    <motion.button
      type="button"
      layoutId={`room-${room._id}`}
      onClick={onClick}
      style={{ borderRadius: 22 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: hidden ? 0 : 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), type: "spring", bounce: 0.14, duration: 0.5 }}
      whileHover={{ y: -3 }}
      className={cn(
        "flex min-h-[124px] flex-col justify-between p-4 text-left",
        stay ? "bg-ink text-white" : "bg-white",
        !room.active && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">{room.number}</span>
        {stay ? (
          stay.openTasks > 0 ? (
            <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-medium text-black">{stay.openTasks} open</span>
          ) : (
            <span className="size-2.5 rounded-full bg-lime" />
          )
        ) : (
          <span className="text-[11px] text-black/40">{room.active ? "Vacant" : "Disabled"}</span>
        )}
      </div>
      {stay ? (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{stay.guestLabel ?? "Guest"}</p>
          <p className="text-[12px] text-white/55">until {shortDate(stay.expectedCheckOutAt)}</p>
        </div>
      ) : (
        <p className="text-[12px] font-medium text-black/55">Check in →</p>
      )}
    </motion.button>
  );
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ka", label: "ქართული" },
  { value: "ru", label: "Русский" },
  { value: "tr", label: "Türkçe" },
  { value: "he", label: "עברית" },
  { value: "ar", label: "العربية" },
];

function CheckInSheet({
  room,
  onClose,
  onCheckedIn,
}: {
  room: Room | null;
  onClose: () => void;
  onCheckedIn: (room: Room, stayId: Id<"stays">) => void;
}) {
  const { hotelId, hotel } = useActiveHotel();
  const checkIn = useMutation(api.stays.checkIn);
  const run = useRun();
  const [guestLabel, setGuestLabel] = useState("");
  const [language, setLanguage] = useState("en");
  const [nights, setNights] = useState("2");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [pmsRef, setPmsRef] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!room) return;
    // Check-out day at the hotel's check-out time, in the hotel's time zone.
    const leaveDay = dayKey(Date.now() + Number(nights) * 86_400_000, hotel.timezone);
    const checkout = hotelTime(leaveDay, hotel.checkoutTime ?? "12:00", hotel.timezone);
    const stayId = await run(
      () =>
        checkIn({
          hotelId,
          roomId: room._id,
          guestLabel: guestLabel.trim() || undefined,
          language,
          adults: Number(adults),
          children: Number(children),
          expectedCheckOutAt: checkout,
          pmsRef: pmsRef.trim() || undefined,
        }),
      `Room ${room.number} checked in`,
    );
    if (stayId) {
      setGuestLabel("");
      setPmsRef("");
      onCheckedIn(room, stayId);
    }
  };

  return (
    <Sheet
      open={room !== null}
      onClose={onClose}
      layoutId={room ? `room-${room._id}` : undefined}
      title={room ? `Check in · Room ${room.number}` : "Check in"}
      description="No passports here. A short label is enough for staff to recognise the stay."
    >
      <form onSubmit={submit} className="space-y-4 pb-2">
        <Field label="Guest label" hint="Optional, e.g. a surname or 'Family of 4'">
          <TextInput value={guestLabel} onChange={(e) => setGuestLabel(e.target.value)} maxLength={40} placeholder="Mr. Beridze" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Guest language">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Booking reference" hint="From your PMS, optional">
            <TextInput value={pmsRef} onChange={(e) => setPmsRef(e.target.value)} maxLength={40} />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Nights</span>
          <Segmented
            value={nights}
            onChange={setNights}
            options={["1", "2", "3", "4", "5", "7", "10"].map((n) => ({ value: n, label: n }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Adults">
            <Select value={adults} onChange={(e) => setAdults(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </Field>
          <Field label="Children">
            <Select value={children} onChange={(e) => setChildren(e.target.value)}>
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </Field>
        </div>
        <ArrowButton type="submit" className="w-full">
          Check in and switch on the room tag
        </ArrowButton>
      </form>
    </Sheet>
  );
}

function StaySheet({ room, stayId, onClose }: { room: Room | null; stayId: Id<"stays"> | null; onClose: () => void }) {
  const { hotel } = useActiveHotel();
  const stay = useQuery(api.stays.get, stayId ? { stayId } : "skip");
  const checkOut = useMutation(api.stays.checkOut);
  const extend = useMutation(api.stays.extend);
  const resetPin = useMutation(api.stays.resetPin);
  const pinOn = hotel.requireGuestPin === true;
  const run = useRun();
  const toast = useToast();

  const link = room ? roomLink(room.token) : "";

  return (
    <Sheet
      open={room !== null}
      onClose={onClose}
      layoutId={room ? `room-${room._id}` : undefined}
      title={room ? `Room ${room.number}` : "Stay"}
      description={stay?.stay.guestLabel ?? "Guest in house"}
    >
      {stay === undefined || !room ? (
        <Skeleton className="h-48 bg-panel" />
      ) : stay === null ? (
        <p className="text-black/55">This stay has ended.</p>
      ) : (
        <div className="space-y-5 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <Info label="Checked in" value={shortDate(stay.stay.checkInAt)} />
            <Info label="Leaves" value={shortDate(stay.stay.expectedCheckOutAt)} />
            <Info
              label="Guests"
              value={
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  {(stay.stay.adults ?? 0) + (stay.stay.children ?? 0) || "—"}
                </span>
              }
            />
          </div>

          {pinOn && stay.stay.status === "active" && stay.stay.guestPin && (
            <div className="flex items-center justify-between gap-4 rounded-[22px] bg-ink p-4 text-white">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] text-white/60">
                  <KeyRound className="size-3.5" />
                  Guest PIN
                </p>
                <p className="mt-0.5 font-mono text-3xl font-semibold tracking-[0.35em] text-lime tabular-nums">{stay.stay.guestPin}</p>
                <p className="mt-1 text-[12px] text-white/55">Tell the guest at check-in. Their phone asks for it once.</p>
              </div>
              <Button
                size="sm"
                variant="white"
                onClick={() =>
                  run(() => resetPin({ stayId: stay.stay._id }), "New PIN made. Phones using the old one must enter it again.")
                }
              >
                Reset
              </Button>
            </div>
          )}

          <div className="rounded-[22px] bg-paper p-4">
            <p className="text-[13px] font-medium">Room tag link</p>
            <p className="mt-1 truncate font-mono text-[12px] text-black/55">{link}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="white"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    toast("Link copied");
                  } catch {
                    toast("Copy blocked by the browser", "error");
                  }
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
              <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClass("white", "sm")}>
                <ExternalLink className="size-3.5" />
                Open guest view
              </a>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium">Requests during this stay</p>
            {stay.tasks.length === 0 ? (
              <p className="rounded-[20px] bg-paper px-4 py-5 text-center text-[13px] text-black/45">No requests yet</p>
            ) : (
              <ul className="space-y-1.5">
                {stay.tasks.map((task) => (
                  <li key={task._id} className="flex items-center justify-between gap-3 rounded-[18px] bg-paper px-4 py-2.5">
                    <span className="min-w-0 truncate text-[14px]">{task.title}</span>
                    <StatusDot status={task.status as TaskStatus} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                run(
                  () => extend({ stayId: stay.stay._id, expectedCheckOutAt: stay.stay.expectedCheckOutAt + 86_400_000 }),
                  "Extended by one night",
                )
              }
            >
              <CalendarPlus className="size-4" />
              Add a night
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={async () => {
                const ok = await run(() => checkOut({ stayId: stay.stay._id }), `Room ${room.number} checked out`);
                if (ok !== undefined) onClose();
              }}
            >
              <LogOut className="size-4 text-lime" />
              Check out
            </Button>
          </div>
          <Pill tone="stone">Check-out closes the room tag right away.</Pill>
        </div>
      )}
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-panel px-3 py-2.5">
      <p className="text-[11px] text-black/50">{label}</p>
      <p className="text-[15px] font-medium">{value}</p>
    </div>
  );
}

