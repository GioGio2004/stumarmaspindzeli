"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Hand-drawn lime loop that draws itself around a word or label. */
export function Scribble({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg
      viewBox="0 0 200 80"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("pointer-events-none absolute overflow-visible text-lime-soft", className)}
    >
      <motion.path
        d="M26 46C18 22 88 6 150 12c46 5 48 40 10 52-42 13-116 12-140-6C2 44 30 22 70 16c34-5 80-2 106 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { delay, duration: 1.1, ease: [0.65, 0, 0.35, 1] },
          opacity: { delay, duration: 0.2 },
        }}
      />
    </svg>
  );
}
