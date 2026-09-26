"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useActiveHotel } from "@/components/hotel-context";
import {
  ArrowButton,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Pill,
  Segmented,
  Sheet,
  Skeleton,
  TextInput,
  Toggle,
  buttonClass,
  useRun,
  useToast,
} from "@/components/kit";
import { RoleGate } from "@/components/role-gate";
import { roomLink } from "@/components/room-link";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export default function RoomsPage() {
  return (
    <RoleGate allow={["manager", "reception"]}>
      <Rooms />
    </RoleGate>
  );
}

function Rooms() {
  const { hotelId, role } = useActiveHotel();
  const rooms = useQuery(api.rooms.list, { hotelId });
  const update = useMutation(api.rooms.update);
  const rotate = useMutation(api.rooms.rotateToken);
  const remove = useMutation(api.rooms.remove);
  const run = useRun();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const manager = role === "manager";

  const copy = async (token?: string) => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(roomLink(token));
      toast("Tag link copied");
    } catch {
      toast("Copy blocked by the browser", "error");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="NFC tags & QR codes"
        title="Rooms"
        description="Each room has a private link for its tag. It only opens the guest app while someone is checked in."
        actions={
          manager && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add rooms
            </Button>
          )
        }
      />

      {!process.env.NEXT_PUBLIC_STOREFRONT_URL && (
        <p className="mb-4 rounded-[20px] bg-red-50 px-4 py-3 text-[13px] text-red-700">
          The guest app address isn&apos;t configured, so these links won&apos;t open it. Set NEXT_PUBLIC_STOREFRONT_URL for
          this deployment and redeploy.
        </p>
      )}

      {rooms === undefined ? (
        <Skeleton className="h-80 bg-panel" />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="No rooms yet"
          body="Add a range like 101–120 in one go."
          action={manager && <ArrowButton onClick={() => setAdding(true)}>Add rooms</ArrowButton>}
        />
      ) : (
        <div className="rounded-[30px] bg-panel p-3 sm:p-4">
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {rooms.map((room, i) => (
                <motion.li
                  key={room._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3), duration: 0.35 }}
                  className="flex flex-wrap items-center gap-3 rounded-[22px] bg-white px-4 py-3"
                >
                  <span className={cn("grid h-12 min-w-14 place-items-center rounded-2xl px-2 text-lg font-semibold tabular-nums", room.currentStay ? "bg-ink text-white" : "bg-panel")}>
                    {room.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">
                      {room.floor ? `Floor ${room.floor}` : "No floor"}
                      {room.currentStay && <Pill tone="lime" className="ml-2">In house</Pill>}
                    </p>
                    <p className="truncate font-mono text-[12px] text-black/45">{roomLink(room.token)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => copy(room.token)} aria-label={`Copy link for room ${room.number}`}>
                      <Copy className="size-3.5" />
                      <span className="hidden sm:inline">Copy link</span>
                    </Button>
                    <a
                      href={roomLink(room.token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open guest view for room ${room.number}`}
                      className={buttonClass("ghost", "sm")}
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                    {manager && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`New link for room ${room.number}`}
                          title="New link: the old tag stops working"
                          onClick={() => run(() => rotate({ roomId: room._id }), `Room ${room.number} has a new link`)}
                        >
                          <RefreshCw className="size-3.5" />
                        </Button>
                        <Toggle
                          label={room.active ? "Room enabled" : "Room disabled"}
                          checked={room.active}
                          onChange={(active) => run(() => update({ roomId: room._id, active }), active ? "Room enabled" : "Room disabled")}
                        />
                        <Button
                          size="sm"
                          variant="danger"
                          aria-label={`Delete room ${room.number}`}
                          disabled={Boolean(room.currentStay)}
                          onClick={() => run(() => remove({ roomId: room._id }), `Room ${room.number} deleted`)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <AddRoomsSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function AddRoomsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hotelId } = useActiveHotel();
  const create = useMutation(api.rooms.create);
  const createRange = useMutation(api.rooms.createRange);
  const run = useRun();
  const [mode, setMode] = useState<"range" | "single">("range");
  const [from, setFrom] = useState("101");
  const [to, setTo] = useState("110");
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("1");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok =
      mode === "range"
        ? await run(() => createRange({ hotelId, from: Number(from), to: Number(to), floor: floor.trim() || undefined }), "Rooms added")
        : await run(() => create({ hotelId, number: number.trim(), floor: floor.trim() || undefined }), `Room ${number} added`);
    if (ok !== undefined) {
      setNumber("");
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add rooms" width="max-w-lg">
      <form onSubmit={submit} className="space-y-4 pb-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "range", label: "A range" },
            { value: "single", label: "One room" },
          ]}
        />
        {mode === "range" ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="From">
              <TextInput type="number" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </Field>
            <Field label="To">
              <TextInput type="number" value={to} onChange={(e) => setTo(e.target.value)} required />
            </Field>
          </div>
        ) : (
          <Field label="Room number">
            <TextInput value={number} onChange={(e) => setNumber(e.target.value)} required maxLength={10} placeholder="214" />
          </Field>
        )}
        <Field label="Floor" hint="Optional">
          <TextInput value={floor} onChange={(e) => setFloor(e.target.value)} maxLength={8} />
        </Field>
        <ArrowButton type="submit" className="w-full">
          {mode === "range" ? `Add rooms ${from}–${to}` : "Add room"}
        </ArrowButton>
      </form>
    </Sheet>
  );
}
