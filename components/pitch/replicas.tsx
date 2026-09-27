"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  ChevronUp,
  DoorOpen,
  Hand,
  LoaderCircle,
  Minus,
  Monitor,
  Nfc,
  Plus,
  Shirt,
  Star,
  UtensilsCrossed,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Clover, Dots, Leaf, Ring, Star4 } from "@/components/brand/glyphs";
import { Scribble } from "@/components/brand/scribble";
import { Avatar, Pill } from "@/components/kit";
import { boardColumns } from "@/lib/status";
import { cn } from "@/lib/utils";

// Faithful copies of the real screens (storefront guest app and the admin's
// Requests board), driven by props so the pitch can script them. The markup
// and classes follow components/guest/* in the storefront and components/tasks.tsx
// here; render them inside `.light-island` so they always use the light theme.


export type RequestStatus = "open" | "accepted" | "in_progress" | "done";
const STATUS_LABEL: Record<RequestStatus, string> = { open: "Sent", accepted: "Accepted", in_progress: "On the way", done: "Delivered" };
const STATUS_ORDER: RequestStatus[] = ["open", "accepted", "in_progress", "done"];

// ---- guest app (375px wide, like a phone) ------------------------------------------------

export const PHONE_W = 375;

export function LockScreen({ banner }: { banner: boolean }) {
  return (
    <div className="absolute inset-0 text-white" style={{ background: "radial-gradient(130% 90% at 50% 0%, #34363f 0%, #101014 70%)" }}>
      <div className="pt-[90px] text-center">
        <p className="text-[17px] font-medium text-white/70">Saturday, 27 September</p>
        <p className="mt-1 text-[88px] font-semibold leading-none tracking-[-0.04em]">21:42</p>
      </div>
      <AnimatePresence>
        {banner && (
          <motion.div
            className="absolute inset-x-3 top-[270px] flex items-center gap-3 rounded-[24px] bg-white/90 p-3.5 text-[#161615] shadow-lg"
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-[#2d2d2d] text-[#e6fb2d]">
              <Nfc className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">Room 214 · Gino Seaside</span>
              <span className="block text-[14px] text-black/55">Tap to open the guest app</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-x-0 bottom-[100px] flex flex-col items-center">
        <span className="relative grid size-24 place-items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border-2 border-[#e6fb2d]"
              initial={{ scale: 0.55, opacity: 0.8 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.66, ease: "easeOut" }}
            />
          ))}
          <span className="grid size-14 place-items-center rounded-full bg-[#e6fb2d] text-[#111110]">
            <Nfc className="size-7" />
          </span>
        </span>
        <p className="mt-6 text-[16px] text-white/60">Hold near the tag</p>
      </div>
    </div>
  );
}

const MARK: { bg: string; fg: string; Glyph: typeof Star4 }[] = [
  { bg: "bg-ink", fg: "text-lime", Glyph: Star4 },
  { bg: "bg-lime", fg: "text-black", Glyph: Clover },
  { bg: "bg-graphite", fg: "text-lime", Glyph: Ring },
  { bg: "bg-lime-soft", fg: "text-[#2d2d2d]", Glyph: Leaf },
];

/** The guest app's loading mark (components/guest/intro.tsx in the storefront). */
export function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
      <div className="grid grid-cols-2 gap-1.5">
        {MARK.map(({ bg, fg, Glyph }, i) => (
          <motion.span
            key={i}
            className={cn("grid size-[63px] place-items-center rounded-[20px]", bg)}
            initial={{ scale: 0, rotate: -120 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1 + i * 0.07, type: "spring", stiffness: 260, damping: 16 }}
          >
            <Glyph className={cn("size-7", fg)} />
          </motion.span>
        ))}
      </div>
      <motion.p className="mt-7 text-[14px] font-medium text-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
        Stumar Maspindzeli
      </motion.p>
    </div>
  );
}

/** Top of the guest home on a phone: header, hero and the first card. */
export function GuestHome() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-white px-3">
      <header className="flex h-20 items-center justify-between gap-3 pt-5">
        <span className="flex min-w-0 items-center gap-2.5">
          <Dots className="size-6 shrink-0" />
          <span className="truncate text-[22px] font-bold tracking-tight">GINO</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="grid size-11 place-items-center rounded-full bg-white ring-1 ring-black/5">
            <Monitor className="size-[18px]" />
          </span>
          <span className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[15px] font-medium text-white">
            <DoorOpen className="size-4 text-lime" />
            Room 214
          </span>
        </span>
      </header>
      <section className="rounded-[30px] bg-panel p-4 pb-5">
        <p className="mb-3 inline-block -rotate-2 font-script text-2xl text-black/70">Welcome to Gino Seaside!</p>
        <h1 className="text-[40px] font-medium leading-[1.04] tracking-[-0.035em]">
          Everything for your stay,{" "}
          <span className="relative inline-block">
            <Scribble className="-inset-x-[6%] -inset-y-[18%] h-[136%] w-[112%]" delay={0.6} />
            one tap
          </span>{" "}
          away
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-black/60">Ask for anything, book the water park and spa, or chat with the concierge in your language.</p>
        <div className="mt-6 h-[260px] overflow-hidden rounded-[28px] bg-white p-5">
          <span className="grid size-11 place-items-center rounded-full bg-panel">
            <Bath className="size-[18px]" />
          </span>
          <h2 className="mt-3 text-xl font-medium tracking-tight">Room requests</h2>
          <p className="mt-1 text-[14px] leading-snug text-black/55">Towels, pillows, cleaning. Tap once and the right team is on it.</p>
        </div>
      </section>
    </div>
  );
}

/** The dimmed page and a bottom sheet, like FeaturePanel on a phone. */
function Sheet({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-0 bg-[rgb(10_10_9/0.6)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
      <motion.div
        className="absolute inset-x-2 bottom-2 top-16 flex flex-col overflow-hidden rounded-[30px] bg-white shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", bounce: 0.14, duration: 0.6 }}
      >
        <div className="flex items-center gap-3 px-5 pt-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-panel">
            <Icon className="size-[18px]" />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-2xl font-medium tracking-tight">{title}</h2>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-panel">
            <X className="size-5" />
          </span>
        </div>
        <div className="relative min-h-0 flex-1 px-5 pb-5 pt-4">{children}</div>
      </motion.div>
    </div>
  );
}

function SendBar({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <motion.div
      className="absolute inset-x-5 bottom-5 flex h-14 items-center justify-between gap-3 rounded-full bg-ink pl-6 pr-2 text-[15px] font-medium text-white"
      animate={{ scale: pressed ? 0.95 : 1 }}
      transition={{ duration: 0.15 }}
    >
      <span className="truncate">{label}</span>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-black">
        <ArrowRight className="size-4" />
      </span>
    </motion.div>
  );
}

function QtyStepper({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white p-0.5 ring-1 ring-black/10">
      <span className="grid size-7 place-items-center rounded-full text-black">
        <Minus className="size-3.5" />
      </span>
      <motion.span key={value} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="w-4 text-center text-[13px] font-medium tabular-nums text-black">
        {value}
      </motion.span>
      <span className="grid size-7 place-items-center rounded-full text-black">
        <Plus className="size-3.5" />
      </span>
    </span>
  );
}

const REQUEST_ITEMS: { icon: LucideIcon; title: string }[] = [
  { icon: Bath, title: "Fresh towels" },
  { icon: Waves, title: "Pool towels" },
  { icon: Shirt, title: "Bathrobe" },
  { icon: BedDouble, title: "Extra pillows" },
];

/** The Room requests panel (RequestsPanel) with "Fresh towels" picked. */
export function RequestsSheet({ qty, pressed }: { qty: number; pressed: boolean }) {
  return (
    <Sheet icon={Bath} title="Room requests">
      <p className="max-w-xl text-[15px] leading-relaxed text-black/60">Pick what you need. Each request goes only to the team that handles it.</p>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {REQUEST_ITEMS.map(({ icon: Icon, title }, i) => {
          const on = i === 0 && qty > 0;
          return (
            <div key={title} className={cn("relative rounded-[22px] p-3.5 ring-1 transition-colors duration-300", on ? "bg-lime/30 ring-ink" : "bg-paper ring-transparent")}>
              <span className="flex flex-col items-start gap-3">
                <span className={cn("grid size-10 place-items-center rounded-2xl transition-colors duration-300", on ? "bg-lime" : "bg-white")}>
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium leading-tight">{title}</span>
                  <span className="mt-0.5 block text-[11px] text-black/50">Housekeeping</span>
                </span>
              </span>
              <AnimatePresence>
                {on && (
                  <motion.span className="absolute right-2.5 top-2.5" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                    <QtyStepper value={qty} />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <SendBar label={qty ? "Send to Housekeeping" : "Pick something first"} pressed={pressed} />
    </Sheet>
  );
}

const DISHES = [
  { title: "Spaghetti Bolognese", price: 28, photo: "/pitch/spaghetti-bolognese.webp" },
  { title: "Margherita pizza", price: 25, photo: "/pitch/margherita-pizza.webp" },
  { title: "Grilled salmon", price: 42, photo: "/pitch/grilled-salmon.webp" },
  { title: "Mint & lime lemonade", price: 10, photo: "/pitch/mint-lime-lemonade.webp" },
];

/** The In-room dining panel with two dishes added. */
export function MenuSheet({ picked, pressed }: { picked: boolean[]; pressed: boolean }) {
  const total = DISHES.reduce((sum, d, i) => sum + (picked[i] ? d.price : 0), 0);
  return (
    <Sheet icon={UtensilsCrossed} title="In-room dining">
      <p className="text-[15px] leading-relaxed text-black/60">Order to your room. It goes on your room bill.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {DISHES.map((d, i) => (
          <div key={d.title} className={cn("overflow-hidden rounded-[20px] bg-paper ring-2 transition-colors duration-300", picked[i] ? "ring-lime" : "ring-transparent")}>
            <div className="relative aspect-[16/11] bg-panel">
              <Image src={d.photo} alt="" fill unoptimized sizes="180px" className="object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[12px] font-medium tabular-nums">{d.price}₾</span>
              {picked[i] && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-lime text-[12px] font-semibold text-black">
                  1
                </motion.span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5">
              <span className="text-[13px] font-medium leading-tight">{d.title}</span>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", picked[i] ? "bg-ink text-white" : "bg-panel")}>
                {picked[i] ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              </span>
            </div>
          </div>
        ))}
      </div>
      <SendBar label={total ? `Order to my room · ${total}₾` : "Add a dish first"} pressed={pressed} />
    </Sheet>
  );
}

/** The lime confirmation toast at the bottom of the guest app. */
export function GuestToast({ text }: { text: string }) {
  return (
    <motion.div
      className="absolute inset-x-0 bottom-[92px] flex justify-center px-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <span className="flex items-center gap-3 rounded-full bg-lime py-2 pl-2 pr-5 text-[14px] font-medium text-black shadow-2xl">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-lime">
          <Check className="size-3.5" />
        </span>
        {text}
      </span>
    </motion.div>
  );
}

export type GuestRequest = { title: string; team: string; status: RequestStatus; rating?: number };

/** The floating "my requests" tracker, optionally opened to show progress. */
export function GuestTracker({ requests, open }: { requests: GuestRequest[]; open: boolean }) {
  const latest = requests[0];
  const active = requests.filter((r) => r.status !== "done").length;
  if (!latest) return null;
  return (
    <motion.div
      className="absolute inset-x-3 bottom-4"
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
    >
      <AnimatePresence>
        {open && (
          <motion.ul
            className="mb-2 space-y-2 rounded-[26px] bg-white p-2.5 shadow-2xl ring-1 ring-black/5"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            {requests.map((r) => {
              const step = STATUS_ORDER.indexOf(r.status);
              return (
                <li key={r.title} className="rounded-[20px] bg-paper p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="truncate text-[12px] text-black/50">{r.team}</p>
                    </div>
                    <motion.span key={r.status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 text-[12px] font-medium">
                      {STATUS_LABEL[r.status]}
                    </motion.span>
                  </div>
                  <div className="mt-3 flex gap-1">
                    {STATUS_ORDER.map((s, i) => (
                      <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                        <motion.span
                          className={cn("block h-full rounded-full", i === step && r.status !== "done" ? "bg-lime" : "bg-ink")}
                          initial={false}
                          animate={{ width: i <= step ? "100%" : "0%" }}
                          transition={{ duration: 0.5 }}
                        />
                      </span>
                    ))}
                  </div>
                  {r.status === "done" && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[12px] text-black/50">{r.rating ? "Thanks for rating!" : "How did we do?"}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className="grid size-8 place-items-center rounded-full">
                            <Star className={cn("size-4 transition-colors", (r.rating ?? 0) >= n ? "fill-ink text-ink" : "text-black/25")} />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
      <div className="flex w-full items-center gap-3 rounded-full bg-ink py-2 pl-2 pr-4 text-left text-white shadow-2xl">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-black">
          {latest.status === "done" ? <Check className="size-4" strokeWidth={2.5} /> : <LoaderCircle className="size-4 animate-spin" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{latest.title}</span>
          <motion.span key={latest.status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="block truncate text-[12px] text-white/60">
            {STATUS_LABEL[latest.status]} · {latest.team}
          </motion.span>
        </span>
        {requests.length > 1 && <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[12px]">{active > 0 ? `${active} active` : "All done"}</span>}
        <ChevronUp className={cn("size-4 shrink-0 transition-transform", open ? "rotate-0" : "rotate-180")} />
      </div>
    </motion.div>
  );
}

// ---- admin: the Requests board -----------------------------------------------------------

export const BOARD_W = 1100; // logical width of the board section
export const BOARD_PAD = 32;
export const COL_W = 250;
export const COL_GAP = 12;
export const COL_TOP = 206; // header + team filter, from the section's top edge
export const COL_HEAD = 50; // column title row
export const CARD_W = 226;
export const CARD_H = 158;

export type BoardTask = {
  id: string;
  status: RequestStatus;
  room: string;
  title: string;
  detail?: string;
  team: string;
  age: string;
  assignee?: string;
  doneAt?: string;
  pressing?: boolean; // the staff member's finger is on Accept / Done
};

const TEAMS = ["Housekeeping", "Kitchen", "Reception", "Spa"];

/** Where a card sits, relative to the section's top-left corner. */
export function cardSlot(status: RequestStatus, row: number) {
  const col = boardColumns.findIndex((c) => c.status === status);
  return {
    x: BOARD_PAD + col * (COL_W + COL_GAP) + (COL_W - CARD_W) / 2,
    y: COL_TOP + COL_HEAD + row * (CARD_H + 10),
  };
}

/** The admin's Requests page body: header, team filter, four columns and task cards. */
export function RequestsBoard({ tasks, height }: { tasks: BoardTask[]; height: number }) {
  const openBy = (team: string) => tasks.filter((t) => t.status === "open" && t.team === team).length;
  return (
    <div className="relative bg-background" style={{ width: BOARD_W, height, padding: BOARD_PAD }}>
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 inline-block -rotate-1 font-script text-2xl text-black/60">Live board</p>
          <h1 className="text-5xl font-medium leading-[1.05] tracking-[-0.03em]">Requests</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-black/60">Every guest and staff request, routed to the team that handles it.</p>
        </div>
        <span className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-white">
          <Plus className="size-4" />
          New task
        </span>
      </header>
      <div className="mt-6 inline-flex rounded-full bg-white p-1 ring-1 ring-black/5">
        {["All teams", ...TEAMS].map((label, i) => {
          const count = i === 0 ? 0 : openBy(label);
          return (
            <span key={label} className={cn("relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium", i === 0 ? "bg-ink text-white" : "text-black/60")}>
              {label}
              {count > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="rounded-full bg-lime px-1.5 text-[11px] text-black">
                  {count}
                </motion.span>
              )}
            </span>
          );
        })}
      </div>

      {boardColumns.map((column, i) => {
        const count = tasks.filter((t) => t.status === column.status).length;
        return (
          <section
            key={column.status}
            className="absolute flex flex-col rounded-[28px] bg-panel p-3"
            style={{ left: BOARD_PAD + i * (COL_W + COL_GAP), top: COL_TOP, width: COL_W, bottom: BOARD_PAD }}
          >
            <div className="mb-3 flex items-center justify-between px-2 pt-1">
              <h2 className="text-[15px] font-medium">{column.title}</h2>
              <motion.span key={count} initial={{ scale: 1.35 }} animate={{ scale: 1 }}>
                <Pill tone={column.status === "open" && count ? "lime" : "white"}>{count}</Pill>
              </motion.span>
            </div>
            {count === 0 && (
              <p className="rounded-[22px] border border-dashed border-black/10 px-4 py-8 text-center text-[13px] text-black/40">
                {column.status === "open" ? "All caught up" : "Nothing here"}
              </p>
            )}
          </section>
        );
      })}

      {tasks.map((task) => {
        const row = tasks.filter((t) => t.status === task.status).indexOf(task);
        const { x, y } = cardSlot(task.status, row);
        return <BoardCard key={task.id} task={task} x={x} y={y} />;
      })}
    </div>
  );
}

/** A copy of TaskCard (components/tasks.tsx), placed by coordinates so it can glide between columns. */
function BoardCard({ task, x, y }: { task: BoardTask; x: number; y: number }) {
  const { status } = task;
  return (
    <motion.article
      className={cn("absolute left-0 top-0 rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]", status === "done" && "opacity-80")}
      style={{ width: CARD_W, minHeight: CARD_H }}
      initial={{ x, y: y - 26, opacity: 0, scale: 0.96 }}
      animate={{ x, y, opacity: 1, scale: 1 }}
      transition={{ type: "spring", bounce: 0.15, duration: 0.7 }}
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid h-12 min-w-12 shrink-0 place-items-center rounded-2xl px-2 text-[15px] font-semibold tabular-nums transition-colors duration-300", status === "open" ? "bg-lime" : "bg-panel")}>
          {task.room}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-medium leading-tight">{task.title}</p>
          {task.detail && <p className="mt-0.5 line-clamp-2 text-[13px] text-black/55">{task.detail}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill tone="stone">{task.team}</Pill>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-3">
        <span className="flex min-w-0 items-center gap-2 text-[12px] text-black/50">
          {task.assignee ? (
            <>
              <Avatar name={task.assignee} size={22} />
              <span className="truncate">{task.assignee}</span>
            </>
          ) : (
            <span>{task.age}</span>
          )}
        </span>
        {status === "open" && (
          <motion.span
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-medium text-white"
            animate={{ scale: task.pressing ? 0.88 : 1 }}
            transition={{ duration: 0.15 }}
          >
            <Hand className="size-3.5 text-lime" />
            Accept
          </motion.span>
        )}
        {(status === "accepted" || status === "in_progress") && (
          <motion.span
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-lime px-3 text-[12px] font-medium text-black"
            animate={{ scale: task.pressing ? 0.88 : 1 }}
            transition={{ duration: 0.15 }}
          >
            <Check className="size-3.5" />
            Done
          </motion.span>
        )}
        {status === "done" && task.doneAt && <span className="text-[12px] text-black/45">{task.doneAt}</span>}
      </div>
    </motion.article>
  );
}

