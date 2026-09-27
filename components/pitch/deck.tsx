"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { HowSlide, IdeaSlide, IntroSlide, OutroSlide } from "./slides";
import { InsightsSlide, SaasSlide, TeamSlide } from "./story";
import { WorkflowSlide } from "./workflow";

// The pitch deck, in the order of the spoken pitch (Georgian script). Each slide
// animates from its `step` prop; `steps` is how many presses it takes before the
// deck moves on. Add, drop or reorder slides here; slides.tsx and story.tsx also
// keep earlier slides that are out of the pitch for now (features, market,
// unique, traction, the ₾5 business model, the ask).
//
//   → ↓ Space Enter PageDown (clickers)  next      ← ↑ PageUp Backspace  back
//   1-9  jump to a slide     F  full screen     Home / End  first / last

export type SlideProps = { step: number };

type Slide = { id: string; label: string; steps: number; Component: ComponentType<SlideProps> };

const SLIDES: Slide[] = [
  { id: "intro", label: "Stumar Maspindzeli", steps: 1, Component: IntroSlide },
  { id: "problem", label: "Problem, then our goal", steps: 2, Component: IdeaSlide },
  { id: "how", label: "How we do it", steps: 1, Component: HowSlide }, // the NFC + AI paragraph
  { id: "demo", label: "Live demo", steps: 7, Component: WorkflowSlide },
  { id: "insights", label: "Behind the scenes", steps: 2, Component: InsightsSlide },
  { id: "business", label: "Business model", steps: 1, Component: SaasSlide },
  { id: "team", label: "Team", steps: 1, Component: TeamSlide },
  { id: "outro", label: "Thank you", steps: 1, Component: OutroSlide },
];

// Slides are drawn on a fixed 16:9 stage and scaled to fit, so they look the
// same on a laptop and a projector.
const STAGE_W = 1920;
const STAGE_H = 1080;

type Position = { slide: number; step: number };

function fromHash(): Position {
  const n = Number(window.location.hash.slice(1));
  return Number.isInteger(n) && n >= 1 && n <= SLIDES.length ? { slide: n - 1, step: 0 } : { slide: 0, step: 0 };
}

const subscribeResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
const stageScale = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

export function Deck() {
  // Nothing renders until the stage is measured on the client, so reading the hash here is safe.
  const [pos, setPos] = useState<Position>(() => (typeof window === "undefined" ? { slide: 0, step: 0 } : fromHash()));
  const scale = useSyncExternalStore(subscribeResize, stageScale, () => 0);
  const [chrome, setChrome] = useState(false);

  const next = useCallback(
    () =>
      setPos(({ slide, step }) => {
        if (step < SLIDES[slide].steps - 1) return { slide, step: step + 1 };
        return slide < SLIDES.length - 1 ? { slide: slide + 1, step: 0 } : { slide, step };
      }),
    [],
  );
  const prev = useCallback(
    () =>
      setPos(({ slide, step }) => {
        if (step > 0) return { slide, step: step - 1 };
        return slide > 0 ? { slide: slide - 1, step: SLIDES[slide - 1].steps - 1 } : { slide, step };
      }),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault();
          next();
          return;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          prev();
          return;
        case "Home":
          setPos({ slide: 0, step: 0 });
          return;
        case "End":
          setPos({ slide: SLIDES.length - 1, step: 0 });
          return;
        case "f":
        case "F":
          toggleFullscreen();
          return;
        default:
          if (/^[1-9]$/.test(e.key) && Number(e.key) <= SLIDES.length) setPos({ slide: Number(e.key) - 1, step: 0 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Keep the slide in the URL so a refresh lands on the same slide.
  useEffect(() => {
    window.history.replaceState(null, "", `#${pos.slide + 1}`);
  }, [pos.slide]);

  // The exit link and key hints show only while the mouse moves.
  useEffect(() => {
    let timer = 0;
    const show = () => {
      setChrome(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setChrome(false), 2500);
    };
    window.addEventListener("mousemove", show);
    return () => {
      window.removeEventListener("mousemove", show);
      window.clearTimeout(timer);
    };
  }, []);

  const slide = SLIDES[pos.slide];
  const progress = (pos.slide + (pos.step + 1) / slide.steps) / SLIDES.length;

  return (
    // The admin's dark theme turns `white` into its card colour; pin it here so slide text stays white in either theme.
    <div
      className="fixed inset-0 z-[60] cursor-default select-none overflow-hidden bg-[#070706] text-white [--color-black:#000000] [--color-white:#ffffff]"
      onClick={next}
    >
      {scale > 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
          <div
            className="absolute left-0 top-0 overflow-hidden bg-[#0f0f0e]"
            style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <slide.Component step={pos.step} />
              </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 h-[6px] bg-[#e6fb2d] transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      <div className={`transition-opacity duration-300 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <Link
          href="/dashboard"
          onClick={(e) => e.stopPropagation()}
          className="fixed left-5 top-5 inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
        >
          <ArrowLeft className="size-4" />
          ადმინ-პანელი
        </Link>
        <p className="fixed bottom-5 left-5 text-[13px] text-white">→ შემდეგი · ← უკან · F სრული ეკრანი · 1-{SLIDES.length} გადასვლა</p>
      </div>
    </div>
  );
}
