"use client";

import { AnimatePresence, motion } from "motion/react";
import { BarChart3, BellRing, ConciergeBell, Languages, Nfc, PhoneCall, Radio, Route, ShieldCheck, Star, Unlink, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useState, type ComponentType, type CSSProperties, type ReactNode, type SVGProps } from "react";
import { Clover, Leaf, Ring, Star4 } from "@/components/brand/glyphs";
import { Scribble } from "@/components/brand/scribble";
import type { SlideProps } from "./deck";

export const ease = [0.22, 1, 0.36, 1] as const;
export const doorEase = [0.76, 0, 0.24, 1] as const;

// Fixed colours, so the deck looks the same whichever theme the admin is in.
// Every word on a slide is plain white; lime only marks icons, lines and progress.
export const C = {
  paper: "#f3f2ed",
  lime: "#e6fb2d",
  limeSoft: "#e3ef7a",
  graphite: "#3a3a37",
  ink: "#2d2d2d",
  card: "#1a1a18",
} as const;

// ---- shared pieces ----------------------------------------------------------------

/** A word that rises into view from behind a mask. */
export function Word({ children, delay, show = true }: { children: ReactNode; delay: number; show?: boolean }) {
  return (
    <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span
        className="inline-block"
        initial={{ y: "110%" }}
        animate={{ y: show ? "0%" : "110%" }}
        transition={{ delay: show ? delay : 0, duration: 0.85, ease }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** A sentence that rises in word by word. */
export function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <Word delay={delay + i * 0.06}>{word}</Word>{" "}
        </Fragment>
      ))}
    </>
  );
}

/** Fades and rises in; `show` lets a later step bring it in. */
export function Rise({ children, delay = 0, show = true, className }: { children: ReactNode; delay?: number; show?: boolean; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ delay: show ? delay : 0, duration: 0.7, ease }}
    >
      {children}
    </motion.div>
  );
}

// Caveat has no Georgian letters, so the deck's Georgian labels use the sans font
// (Noto Sans Georgian) instead of font-script; the tilt keeps the handwritten feel.
export function Eyebrow({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <Rise delay={delay}>
      <span className="inline-block -rotate-2 text-[60px] leading-none">{children}</span>
    </Rise>
  );
}

/** The slide headline. */
export function Headline({ children }: { children: ReactNode }) {
  return <h2 className="mt-6 text-[100px] font-medium leading-none tracking-[-0.045em]">{children}</h2>;
}

// ---- 1. intro -----------------------------------------------------------------------

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

const HALF = 120; // half the 2x2 mark, px on the 1920x1080 stage

// The guest app's loading mark. `corner` pins each glyph to the middle of the stage.
const DOORS: { bg: string; fg: string; Glyph: Glyph; corner: CSSProperties; origin: string; x: string; y: string }[] = [
  { bg: C.paper, fg: C.ink, Glyph: Star4, corner: { right: 0, bottom: 0 }, origin: "100% 100%", x: "-101%", y: "-4%" },
  { bg: C.lime, fg: "#111110", Glyph: Clover, corner: { left: 0, bottom: 0 }, origin: "0% 100%", x: "101%", y: "-4%" },
  { bg: C.graphite, fg: C.lime, Glyph: Ring, corner: { right: 0, top: 0 }, origin: "100% 0%", x: "-101%", y: "4%" },
  { bg: C.limeSoft, fg: C.ink, Glyph: Leaf, corner: { left: 0, top: 0 }, origin: "0% 0%", x: "101%", y: "4%" },
];

/** The mark pops in, grows until its quarters fill the stage, then opens like lift doors. */
function Doors({ openAt = 2.1 }: { openAt?: number }) {
  const [phase, setPhase] = useState<"mark" | "open" | "gone">("mark");
  useEffect(() => {
    const open = window.setTimeout(() => setPhase("open"), openAt * 1000);
    const gone = window.setTimeout(() => setPhase("gone"), (openAt + 1.1) * 1000);
    return () => {
      window.clearTimeout(open);
      window.clearTimeout(gone);
    };
  }, [openAt]);
  if (phase === "gone") return null;

  const closed = "inset(540px 960px 540px 960px round 36px)";
  const mark = `inset(${540 - HALF}px ${960 - HALF}px ${540 - HALF}px ${960 - HALF}px round 36px)`;
  const full = "inset(0px 0px 0px 0px round 36px)";
  const grow = { delay: 0.25, duration: openAt - 0.35 };
  const opening = phase === "open";

  return (
    <div className="absolute inset-0 z-20">
      <motion.div
        className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2"
        initial={{ clipPath: closed }}
        animate={{ clipPath: [closed, mark, mark, full] }}
        transition={{ ...grow, times: [0, 0.3, 0.62, 1], ease: ["backOut", "linear", doorEase] }}
      >
        {DOORS.map(({ bg, fg, Glyph, corner, origin, x, y }, i) => (
          <motion.div
            key={i}
            className="relative rounded-[36px]"
            style={{ background: bg }}
            animate={opening ? { x, y } : { x: 0, y: 0 }}
            transition={{ duration: 0.95, ease: doorEase, delay: opening && i > 1 ? 0.06 : 0 }}
          >
            <motion.span
              className="absolute grid place-items-center"
              style={{ ...corner, width: HALF - 4, height: HALF - 4, transformOrigin: origin }}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1, 2.4] }}
              transition={{ ...grow, times: [0, 0.62, 1], ease: doorEase }}
            >
              <motion.span
                className="block"
                style={{ color: fg }}
                initial={{ scale: 0, rotate: -135 }}
                animate={opening ? { scale: 0.5, rotate: 90, opacity: 0 } : { scale: 1, rotate: 0, opacity: 1 }}
                transition={opening ? { duration: 0.5, ease: doorEase } : { delay: 0.45 + i * 0.08, type: "spring", stiffness: 240, damping: 15 }}
              >
                <Glyph className="size-14" />
              </motion.span>
            </motion.span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export function IntroSlide() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 flex flex-col items-center justify-center px-24 text-center">
        <h1 className="text-[176px] font-medium leading-[0.95] tracking-[-0.05em]">
          <Word delay={2.3}>Stumar</Word>{" "}
          <span className="relative inline-block">
            <Scribble className="-inset-x-[4%] -inset-y-[14%] h-[128%] w-[108%]" delay={3.05} />
            <Word delay={2.4}>Maspindzeli</Word>
          </span>
        </h1>
        <Rise delay={2.75} className="mt-8 text-[56px]">
          სტუმარ-მასპინძელი
        </Rise>
        <Rise delay={3.0} className="mt-14 text-[68px] leading-tight">
          ზუსტი სურათი თქვენი სტუმრის შესახებ.
        </Rise>
        <Rise delay={3.25} className="mt-6 text-[44px]">
          რას აკეთებს · რა აწუხებს · რა უქმნის კომფორტს
        </Rise>
      </div>
      <Doors />
    </div>
  );
}

// ---- 2. the problem, and our goal ------------------------------------------------------

type Tone = "plain" | "bad" | "good";
type Point = { icon: LucideIcon; title: string; tone?: Tone };

const PROBLEM: Point[] = [
  { icon: PhoneCall, title: "სტუმარი რეცეფციას მიმართავს" },
  { icon: Unlink, title: "ჯაჭვი პერსონალამდე წყდება" },
  { icon: Star, title: "ცუდი შეფასება Booking-ზე", tone: "bad" },
];

const GOAL: Point[] = [
  { icon: Nfc, title: "სტუმრის ყოველი ქმედება", tone: "good" },
  { icon: ShieldCheck, title: "სრულიად ანონიმური მონაცემი", tone: "good" },
  { icon: BarChart3, title: "ანალიზი მენეჯერისთვის", tone: "good" },
];

function PointCard({ point, delay, children }: { point: Point; delay: number; children?: ReactNode }) {
  const { icon: Icon, title, tone = "plain" } = point;
  return (
    <motion.div
      className="flex flex-col gap-8 rounded-[36px] p-10"
      style={{ background: tone === "bad" ? "#2b1b18" : C.card }}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease }}
    >
      <span
        className="grid size-24 place-items-center rounded-full"
        style={{
          background: tone === "good" ? C.lime : tone === "bad" ? "#ff8c7a" : "rgba(255,255,255,0.1)",
          color: tone === "plain" ? "#ffffff" : "#111110",
        }}
      >
        <Icon className="size-11" />
      </span>
      <span className="text-balance text-[46px] font-medium leading-[1.1] tracking-[-0.02em]">{title}</span>
      {children}
    </motion.div>
  );
}

/** The link between two cards: dashed and grey today, solid lime with a moving dot with us. `label` sits on the line. */
function Link2({ good, delay, label }: { good: boolean; delay: number; label?: string }) {
  return (
    <div className="relative h-[3px] self-center">
      <motion.span
        className="absolute inset-0 origin-left"
        style={good ? { background: C.lime } : { borderTop: "3px dashed rgba(255,255,255,0.3)" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay, duration: 0.35 }}
      />
      {good && (
        <motion.span
          className="absolute -top-[6px] size-[15px] rounded-full"
          style={{ background: C.lime, boxShadow: `0 0 18px ${C.lime}` }}
          initial={{ left: "0%", opacity: 0 }}
          animate={{ left: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{ delay: delay + 0.3, duration: 1.1, repeat: Infinity, repeatDelay: 0.4 }}
        />
      )}
      {label && (
        <motion.span
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full px-3.5 py-1 text-[26px] font-semibold"
          style={{ background: C.lime, color: "#111110" }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.2, type: "spring", stiffness: 300, damping: 18 }}
        >
          {label}
        </motion.span>
      )}
    </div>
  );
}

export function IdeaSlide({ step }: SlideProps) {
  const after = step >= 1;
  const points = after ? GOAL : PROBLEM;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={after ? "after" : "before"} className="absolute inset-0 px-[140px] pt-[96px]" exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
        <Eyebrow>{after ? "ჩვენი მიზანი" : "პრობლემა"}</Eyebrow>
        <Headline>
          {after ? (
            <>
              <Words text="ვაქრობთ" delay={0.1} />
              <br />
              <span className="relative inline-block">
                <Scribble className="-inset-x-[8%] -inset-y-[16%] h-[132%] w-[116%]" delay={0.9} />
                <Word delay={0.3}>ბრმა</Word> <Word delay={0.36}>ზონას.</Word>
              </span>
            </>
          ) : (
            <>
              <Words text="სასტუმრომ არ იცის," delay={0.1} />
              <br />
              <Words text="რა აწუხებს სტუმარს." delay={0.3} />
            </>
          )}
        </Headline>
        <div className="mt-20 grid grid-cols-[1fr_72px_1fr_72px_1fr]">
          {points.map((point, i) => (
            <Fragment key={point.title}>
              {i > 0 && <Link2 good={after} delay={0.35 + i * 0.35 - 0.15} />}
              <PointCard point={point} delay={0.35 + i * 0.35} />
            </Fragment>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---- 3. how it works: the NFC tag and the AI, right before the demo ----------------------

const HOW: Point[] = [
  { icon: Nfc, title: "ტელეფონს თეგს ადებს", tone: "good" },
  { icon: Languages, title: "ითხოვს საკუთარ ენაზე", tone: "good" },
  { icon: Route, title: "პირდაპირ თანამშრომელთან", tone: "good" },
];

/** A guest writing in their own language (here Turkish) to the AI concierge. */
function GuestBubble() {
  return (
    <p className="self-start rounded-[26px] rounded-bl-[8px] px-6 py-4 text-[28px] leading-snug" style={{ background: C.paper, color: "#161615" }}>
      Lütfen iki temiz havlu getirir misiniz?
    </p>
  );
}

/** What the right staff member gets: the real push text (convex/push.ts), in Georgian. */
function StaffPush() {
  return (
    <div className="flex items-start gap-4 rounded-[26px] bg-white p-5 text-[#161615]">
      <span className="grid size-12 shrink-0 place-items-center rounded-[14px]" style={{ background: C.ink, color: C.lime }}>
        <BellRing className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-[24px] font-semibold leading-tight">ოთახი 214 — სუფთა პირსახოცების მიტანა ×2</span>
        <span className="mt-1.5 block text-[20px] text-black/55">ახალი მოთხოვნა. გახსენი ინსტრუქცია.</span>
      </span>
    </div>
  );
}

export function HowSlide() {
  return (
    <div className="absolute inset-0 px-[140px] pt-[96px]">
      <Eyebrow>როგორ ვაკეთებთ ამას?</Eyebrow>
      <Headline>
        <Words text="ერთი შეხება." delay={0.1} />
        <span className="relative inline-block">
          <Scribble className="-inset-x-[5%] -inset-y-[16%] h-[132%] w-[110%]" delay={0.9} />
          <Word delay={0.25}>ნებისმიერ</Word> <Word delay={0.31}>ენაზე.</Word>
        </span>
      </Headline>
      <div className="mt-20 grid grid-cols-[1fr_72px_1fr_72px_1fr]">
        <PointCard point={HOW[0]} delay={0.35}>
          <p className="text-[30px] leading-snug">გადმოწერის გარეშე, ციფრული მასპინძელი წამებში იხსნება</p>
        </PointCard>
        <Link2 good delay={0.55} />
        <PointCard point={HOW[1]} delay={0.7}>
          <GuestBubble />
        </PointCard>
        <Link2 good delay={0.9} label="AI" />
        <PointCard point={HOW[2]} delay={1.05}>
          <StaffPush />
        </PointCard>
      </div>
    </div>
  );
}

// ---- features (out of the pitch for now) --------------------------------------------

type Feature = { icon: LucideIcon; title: string };

const FOR_GUESTS: Feature[] = [
  { icon: Nfc, title: "თეგზე შეხება, აპლიკაციის გარეშე" },
  { icon: ConciergeBell, title: "შეკვეთა და დაჯავშნა" },
  { icon: Radio, title: "სტატუსი რეალურ დროში" },
];

const FOR_TEAM: Feature[] = [
  { icon: Route, title: "პირდაპირ საჭირო გუნდთან" },
  { icon: BellRing, title: "შეტყობინება ნებისმიერ ტელეფონზე" },
  { icon: BarChart3, title: "მენეჯერის დაფა რეალურ დროში" },
];

function FeatureCard({ label, items, show, delay, lime }: { label: string; items: Feature[]; show: boolean; delay: number; lime: boolean }) {
  return (
    <motion.div
      className="rounded-[40px] p-12"
      style={{ background: C.card }}
      initial={{ opacity: 0, y: 40 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ delay: show ? delay : 0, duration: 0.6, ease }}
    >
      <p className="text-[40px] font-medium">{label}</p>
      <ul className="mt-9 space-y-8">
        {items.map((f, i) => (
          <motion.li
            key={f.title}
            className="flex items-center gap-7"
            initial={{ opacity: 0, x: 24 }}
            animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
            transition={{ delay: show ? delay + 0.15 + i * 0.1 : 0, duration: 0.5, ease }}
          >
            <span className="grid size-20 shrink-0 place-items-center rounded-full" style={{ background: lime ? C.lime : C.paper, color: "#111110" }}>
              <f.icon className="size-9" />
            </span>
            <span className="text-[46px] font-medium leading-tight tracking-[-0.02em]">{f.title}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

export function FeaturesSlide({ step }: SlideProps) {
  return (
    <div className="absolute inset-0 px-[140px] pt-[96px]">
      <Eyebrow>ფუნქციები</Eyebrow>
      <Headline>
        <Words text="ერთი თეგი. ორი მხარე." delay={0.1} />
      </Headline>
      <div className="mt-16 grid grid-cols-2 gap-8">
        <FeatureCard label="სტუმრისთვის" items={FOR_GUESTS} show delay={0.4} lime />
        <FeatureCard label="სასტუმროს გუნდისთვის" items={FOR_TEAM} show={step >= 1} delay={0.1} lime={false} />
      </div>
    </div>
  );
}

// ---- outro --------------------------------------------------------------------------

function MiniMark() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DOORS.map(({ bg, fg, Glyph }, i) => (
        <motion.span
          key={i}
          className="grid size-[84px] place-items-center rounded-[22px]"
          style={{ background: bg, color: fg }}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 240, damping: 16 }}
        >
          <Glyph className="size-9" />
        </motion.span>
      ))}
    </div>
  );
}

export function OutroSlide() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <MiniMark />
      <h2 className="mt-12 text-[150px] font-medium leading-none tracking-[-0.05em]">
        <Words text="Stumar Maspindzeli" delay={0.4} />
      </h2>
      <Rise delay={0.8} className="mt-10 text-[48px]">
        ვაქცევთ სტუმრის გამოცდილებას ციფრულ, გაზომვად მონაცემად.
      </Rise>
      <Rise delay={1.1} className="mt-12">
        <span className="inline-block -rotate-2 text-[96px] leading-none">მადლობა ყურადღებისთვის!</span>
      </Rise>
      <Rise delay={1.45} className="mt-14 text-[36px]">
        stumar-maspindzeli-storefront.vercel.app
      </Rise>
    </div>
  );
}
