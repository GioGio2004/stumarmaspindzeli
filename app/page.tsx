"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { motion } from "motion/react";
import { ArrowRight, BellRing, DoorOpen, Inbox, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Clover, Dots, Leaf, Ring, Star4 } from "@/components/brand/glyphs";
import { Scribble } from "@/components/brand/scribble";
import { buttonClass, ease } from "@/components/kit";

const POINTS = [
  { icon: Inbox, title: "Requests that route themselves", body: "Towels go to housekeeping, dinner to the kitchen. Nobody else is pinged." },
  { icon: DoorOpen, title: "Check-in switches the room on", body: "The room's tag opens the guest app only while a stay is active." },
  { icon: BellRing, title: "Nothing waits unseen", body: "Unaccepted requests escalate to managers after a few minutes." },
  { icon: Sparkles, title: "A playbook in every task", body: "New staff follow the steps the manager wrote, in Georgian." },
];

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1400px] flex-col px-3 sm:px-6">
      <header className="flex h-20 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Dots className="size-6" />
          <span className="text-xl font-bold tracking-tight">Stumar</span>
        </div>
        {!isLoading && !isAuthenticated && (
          <div className="flex items-center gap-2">
            <SignInButton mode="redirect">
              <button type="button" className={buttonClass("ghost")}>
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button type="button" className={buttonClass("primary")}>
                Get started
              </button>
            </SignUpButton>
          </div>
        )}
      </header>

      <main className="flex-1 rounded-[30px] bg-panel p-5 sm:p-10 lg:p-14">
        <motion.p
          className="mb-3 inline-block -rotate-2 font-script text-3xl text-black/60"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          For hotel teams
        </motion.p>
        <h1 className="max-w-4xl text-[44px] font-medium leading-[1.02] tracking-[-0.035em] sm:text-7xl">
          Every guest request, handled by the{" "}
          <span className="relative inline-block whitespace-nowrap">
            <Scribble className="-inset-x-[6%] -inset-y-[18%] h-[136%] w-[112%]" delay={0.8} />
            right person
          </span>
        </h1>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SignUpButton mode="redirect">
            <button type="button" className="group inline-flex h-12 items-center gap-3 rounded-full bg-ink pl-5 pr-1.5 text-[15px] font-medium text-white">
              Set up your hotel
              <span className="grid size-9 place-items-center rounded-full bg-lime text-black transition group-hover:translate-x-0.5">
                <ArrowRight className="size-4" />
              </span>
            </button>
          </SignUpButton>
          <div className="flex gap-1.5">
            {[Star4, Clover, Ring, Leaf].map((Glyph, i) => (
              <Glyph key={i} className={i === 0 ? "size-8 text-ink" : "size-8 text-white"} />
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((point, i) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={point.title}
                className={i === 1 ? "rounded-[26px] bg-graphite p-6 text-white" : "rounded-[26px] bg-white p-6"}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease }}
                whileHover={{ y: -4 }}
              >
                <span className={i === 1 ? "grid size-11 place-items-center rounded-full bg-white/10" : "grid size-11 place-items-center rounded-full bg-panel"}>
                  <Icon className="size-[18px]" />
                </span>
                <h2 className="mt-10 text-xl font-medium tracking-tight">{point.title}</h2>
                <p className={i === 1 ? "mt-1 text-[14px] text-white/60" : "mt-1 text-[14px] text-black/55"}>{point.body}</p>
              </motion.div>
            );
          })}
        </div>
      </main>
      <footer className="py-6 text-center text-[13px] text-black/45">Stumar Maspindzeli · Guest-host for Georgian hotels</footer>
    </div>
  );
}
