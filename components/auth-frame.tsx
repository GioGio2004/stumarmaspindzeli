"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Clover, Dots, Leaf, Ring, Star4 } from "./brand/glyphs";
import { Scribble } from "./brand/scribble";
import { ease } from "./kit";

/** Split layout for sign-in, sign-up and onboarding, in the storefront's style. */
export function AuthFrame({ title, mark, children }: { title: string; mark: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh gap-3 p-3 lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden rounded-[30px] bg-panel p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <Dots className="size-6" />
          <span className="text-xl font-bold tracking-tight">Stumar</span>
        </Link>
        <div>
          <p className="mb-3 inline-block -rotate-2 font-script text-3xl text-black/60">Welcome back!</p>
          <h1 className="max-w-lg text-6xl font-medium leading-[1.02] tracking-[-0.035em]">
            {title}{" "}
            <span className="relative inline-block whitespace-nowrap">
              <Scribble className="-inset-x-[8%] -inset-y-[22%] h-[144%] w-[116%]" delay={0.6} />
              {mark}
            </span>
          </h1>
        </div>
        <div className="flex items-end justify-between">
          <div className="grid grid-cols-3 gap-2">
            {[Star4, Clover, Ring, Leaf, Clover].map((Glyph, i) => (
              <motion.span
                key={i}
                className={i === 3 ? "col-start-2" : undefined}
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3 + i * 0.08, type: "spring", stiffness: 260, damping: 16 }}
              >
                <Glyph className={i === 0 ? "size-10 text-ink" : "size-10 text-white"} />
              </motion.span>
            ))}
          </div>
          <p className="max-w-[220px] text-right text-[14px] text-black/55">
            Guest requests, stays and your team in one calm place.
          </p>
        </div>
      </section>
      <motion.section
        className="flex flex-col items-center justify-center gap-6 py-10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
      >
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <Dots className="size-6" />
          <span className="text-xl font-bold tracking-tight">Stumar</span>
        </Link>
        {children}
      </motion.section>
    </main>
  );
}
