"use client";

import { AnimatePresence, motion } from "motion/react";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import type { SlideProps } from "./deck";
import {
  BOARD_W,
  CARD_H,
  CARD_W,
  GuestHome,
  GuestToast,
  GuestTracker,
  LoadingScreen,
  LockScreen,
  MenuSheet,
  PHONE_W,
  RequestsBoard,
  RequestsSheet,
  cardSlot,
  type BoardTask,
  type GuestRequest,
  type RequestStatus,
} from "./replicas";
import { C, ease } from "./slides";

// The live demo: the real guest app on a phone and the real Requests board of
// the admin, side by side (see replicas.tsx). Each press is one beat; within a
// beat a clock (seconds since the press) drives the choreography. Everything
// sits at fixed stage coordinates, so nothing depends on measuring the page.

// Captions, callouts and the staff push are in Georgian; the phone and the
// board stay as the real apps show them (guest app in English, staff titles in Georgian).
const CAPTIONS = [
  "214-ე ოთახი. ტეგი საწოლის გვერდით.",
  "აპი იხსნება. რეგისტრაცია არ სჭირდება.",
  "„ორი სუფთა პირსახოცი, თუ შეიძლება“.",
  "დასუფთავება იღებს მოთხოვნას.",
  "„გზაშია“ — სტუმრის ტელეფონზეც ჩანს.",
  "მიტანილია 6 წუთში.",
  "ვახშამი? შეკვეთა პირდაპირ ოთახში.",
];

// ---- layout (px on the 1920x1080 stage) ----------------------------------------------

const PHONE = { left: 80, top: 196, width: 440, height: 846, bezel: 12 };
const SCREEN = { left: PHONE.left + PHONE.bezel, top: PHONE.top + PHONE.bezel, width: PHONE.width - 2 * PHONE.bezel, height: PHONE.height - 2 * PHONE.bezel };
const PHONE_SCALE = SCREEN.width / PHONE_W;
const BOARD = { left: 560, top: 196, width: 1300, height: 846 };
const BOARD_SCALE = BOARD.width / BOARD_W;

type Point = { x: number; y: number };
const onBoard = (x: number, y: number): Point => ({ x: BOARD.left + x * BOARD_SCALE, y: BOARD.top + y * BOARD_SCALE });
const cardCentre = (status: RequestStatus) => {
  const { x, y } = cardSlot(status, 0);
  return onBoard(x + CARD_W / 2, y + CARD_H / 2);
};
const PHONE_SEND: Point = { x: SCREEN.left + (PHONE_W / 2) * PHONE_SCALE, y: SCREEN.top + SCREEN.height - 50 * PHONE_SCALE };
const PHONE_TRACKER: Point = { x: SCREEN.left + (PHONE_W / 2) * PHONE_SCALE, y: SCREEN.top + SCREEN.height - 190 * PHONE_SCALE };

// ---- choreography ---------------------------------------------------------------------

const SEND = 1.4; // the guest presses send
const ARRIVE = 2.2; // the board receives it
const TRAVEL = 0.8;
const TAP: Record<number, number> = { 3: 0.9, 4: 0.5, 5: 0.5 }; // staff accept / start / finish

function scene(step: number, t: number) {
  const tapAt = TAP[step];
  const tapped = tapAt !== undefined && t >= tapAt;
  const replied = tapAt !== undefined && t >= tapAt + 0.1 + TRAVEL;

  // Board: the towels card moves New → Accepted → In progress → Done.
  let towels: RequestStatus | null = null;
  if (step === 2) towels = t >= ARRIVE ? "open" : null;
  else if (step === 3) towels = tapped ? "accepted" : "open";
  else if (step === 4) towels = tapped ? "in_progress" : "accepted";
  else if (step === 5) towels = tapped ? "done" : "in_progress";
  else if (step > 5) towels = "done";
  const pressing = (step === 3 || step === 5) && !tapped && t >= (tapAt ?? 0) - 0.35;

  const tasks: BoardTask[] = [];
  if (step === 6 && t >= ARRIVE) {
    // As guest/requests.ts:createOrder titles it for staff.
    tasks.push({
      id: "dinner",
      status: "open",
      room: "214",
      title: "Order: 2 items",
      detail: "Margherita pizza ×1, Mint & lime lemonade ×1 · total 35₾",
      team: "Kitchen",
      age: "just now",
    });
  }
  if (towels) {
    // Staff see the catalog's Georgian title; the guest tapped "Fresh towels".
    tasks.push({
      id: "towels",
      status: towels,
      room: "214",
      title: "სუფთა პირსახოცების მიტანა ×2",
      team: "Housekeeping",
      age: "just now",
      assignee: towels === "open" ? undefined : "Nino Beridze",
      doneAt: "21:49",
      pressing,
    });
  }

  // Phone: what the guest sees.
  const guestTowels: RequestStatus =
    step < 3 ? "open"
    : step === 3 ? (replied ? "accepted" : "open")
    : step === 4 ? (replied ? "in_progress" : "accepted")
    : step === 5 ? (replied ? "done" : "in_progress")
    : "done";
  const rating = step === 5 && replied ? Math.max(0, Math.min(5, Math.floor((t - 1.9) / 0.15) + 1)) : step > 5 ? 5 : 0;
  const requests: GuestRequest[] = [];
  if (step === 6 && t >= SEND) requests.push({ title: "Order: 2 items", team: "Kitchen", status: "open" });
  if (step > 2 || (step === 2 && t >= SEND)) requests.push({ title: "Fresh towels ×2", team: "Housekeeping", status: guestTowels, rating });

  const packet =
    step === 2 || step === 6
      ? { from: PHONE_SEND, to: cardCentre("open"), start: SEND }
      : tapAt !== undefined && towels
        ? { from: cardCentre(towels), to: PHONE_TRACKER, start: tapAt + 0.1 }
        : null;

  const notice =
    (step === 2 || step === 6) && t >= ARRIVE && t < ARRIVE + 3.2
      ? step === 2
        ? { title: "ახალი მოთხოვნა · ოთახი 214", body: "სუფთა პირსახოცი ×2 → დასუფთავება" }
        : { title: "ახალი შეკვეთა · ოთახი 214", body: "პიცა და ლიმონათი → სამზარეულო" }
      : null;

  return { tasks, requests, packet, notice };
}

// What the audience should notice, pinned next to it.
const CALLOUTS: { step: number; at: number; text: string; x: number; y: number }[] = [
  { step: 0, at: 0.9, text: "ჩამოტვირთვის გარეშე", x: 85, y: 440 },
  { step: 2, at: 2.5, text: "მხოლოდ დასუფთავება იღებს, ქართულად", x: 600, y: 705 },
  { step: 3, at: 1.9, text: "სტუმარი მაშინვე ხედავს", x: 120, y: 752 },
  { step: 5, at: 0.9, text: "შესრულების დრო იზომება", x: 1340, y: 705 },
  { step: 6, at: 2.5, text: "+35₾ ოთახის ანგარიშზე", x: 600, y: 745 },
];

/** Seconds since this step began. */
function useStepClock(step: number) {
  const [clock, setClock] = useState({ step, t: 0 });
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - start) / 1000;
      setClock({ step, t });
      if (t > 6) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [step]);
  return clock.step === step ? clock.t : 0;
}

export function WorkflowSlide({ step }: SlideProps) {
  const t = useStepClock(step);
  const { tasks, requests, packet, notice } = scene(step, t);
  const callouts = CALLOUTS.filter((c) => c.step === step && t >= c.at);

  return (
    <div className="absolute inset-0">
      <Caption step={step} />
      <Phone step={step} t={t} requests={requests} />

      <div className="absolute overflow-hidden rounded-[34px] shadow-[0_40px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/10" style={BOARD}>
        <div className="light-island absolute left-0 top-0" style={{ transform: `scale(${BOARD_SCALE})`, transformOrigin: "0 0" }}>
          <RequestsBoard tasks={tasks} height={BOARD.height / BOARD_SCALE} />
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.title}
            className="light-island absolute flex w-[400px] items-center gap-3 rounded-[24px] bg-white/95 p-4 shadow-2xl ring-1 ring-black/5"
            style={{ left: BOARD.left + BOARD.width - 420, top: BOARD.top + 20 }}
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-ink text-lime">
              <BellRing className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] text-black/45">Stumar · ახლა</span>
              <span className="block text-[17px] font-semibold">{notice.title}</span>
              <span className="block truncate text-[15px] text-black/60">{notice.body}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {packet && t >= packet.start && t <= packet.start + TRAVEL + 0.15 && <Packet key={step} from={packet.from} to={packet.to} />}

      <AnimatePresence>
        {callouts.map((c) => (
          <motion.span
            key={`${c.step}-${c.text}`}
            className="absolute z-40 inline-flex items-center gap-3 whitespace-nowrap rounded-full bg-[#111110] py-3.5 pl-4 pr-7 text-[30px] font-medium text-white"
            style={{ left: c.x, top: c.y, boxShadow: `inset 0 0 0 3px ${C.lime}, 0 12px 40px rgba(0,0,0,0.45)` }}
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="size-4 rounded-full" style={{ background: C.lime }} />
            {c.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Caption({ step }: { step: number }) {
  return (
    <div className="absolute left-[80px] right-[60px] top-[36px] flex items-start justify-between gap-10">
      <div>
        <span className="inline-block -rotate-2 font-script text-[48px] leading-none">როგორ მუშაობს</span>
        <AnimatePresence mode="wait">
          <motion.h2
            key={step}
            className="mt-3 text-[68px] font-medium leading-none tracking-[-0.035em]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease }}
          >
            {CAPTIONS[step]}
          </motion.h2>
        </AnimatePresence>
      </div>
      <div className="mt-3 flex gap-2">
        {CAPTIONS.map((_, i) => (
          <span key={i} className="h-2.5 rounded-full transition-all duration-500" style={{ width: i === step ? 40 : 10, background: i <= step ? C.lime : "rgba(255,255,255,0.15)" }} />
        ))}
      </div>
    </div>
  );
}

function Packet({ from, to }: { from: Point; to: Point }) {
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 160 };
  return (
    <motion.span
      className="pointer-events-none absolute left-0 top-0 z-30 size-7 rounded-full"
      style={{ background: C.lime, boxShadow: `0 0 30px 10px ${C.lime}66` }}
      initial={{ x: from.x - 14, y: from.y - 14, scale: 0.4, opacity: 0 }}
      animate={{ x: [from.x - 14, mid.x - 14, to.x - 14], y: [from.y - 14, mid.y - 14, to.y - 14], scale: [0.4, 1.2, 0.6], opacity: [0, 1, 0.85] }}
      transition={{ duration: TRAVEL, ease: "easeInOut", times: [0, 0.5, 1] }}
    />
  );
}

// ---- the guest's phone ----------------------------------------------------------------

function Phone({ step, t, requests }: { step: number; t: number; requests: GuestRequest[] }) {
  const screen = step === 0 ? "lock" : step === 1 && t < 1.6 ? "loading" : "home";
  const sheet = step === 2 && t < SEND ? "requests" : step === 6 && t < SEND ? "menu" : null;
  const toast = step === 2 && t >= SEND && t < SEND + 2.6 ? "Fresh towels requested" : step === 6 && t >= SEND && t < SEND + 2.6 ? "Order sent to the kitchen" : null;
  const pressed = t >= 1.1 && t < 1.35;

  return (
    <div className="absolute rounded-[64px] bg-[#0b0b0a] shadow-[0_40px_120px_rgba(0,0,0,0.65)] ring-1 ring-white/10" style={{ left: PHONE.left, top: PHONE.top, width: PHONE.width, height: PHONE.height }}>
      <div className="light-island absolute overflow-hidden rounded-[52px] bg-white" style={{ left: PHONE.bezel, top: PHONE.bezel, width: SCREEN.width, height: SCREEN.height }}>
        <div className="absolute left-0 top-0" style={{ width: PHONE_W, height: SCREEN.height / PHONE_SCALE, transform: `scale(${PHONE_SCALE})`, transformOrigin: "0 0" }}>
          <AnimatePresence initial={false}>
            <motion.div key={screen} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              {screen === "lock" && <LockScreen banner={t >= 0.5} />}
              {screen === "loading" && <LoadingScreen />}
              {screen === "home" && <GuestHome />}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>
            {sheet === "requests" && <RequestsSheet key="requests" qty={t >= 0.75 ? 2 : t >= 0.35 ? 1 : 0} pressed={pressed} />}
            {sheet === "menu" && <MenuSheet key="menu" picked={[false, t >= 0.35, false, t >= 0.75]} pressed={pressed} />}
          </AnimatePresence>
          <AnimatePresence>{toast && <GuestToast key={toast} text={toast} />}</AnimatePresence>
          {screen === "home" && !sheet && <GuestTracker requests={requests} open={step >= 3} />}
        </div>
        <div className="absolute left-1/2 top-[12px] h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}
