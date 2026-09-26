"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Clover, Dots, Ring, Star4 } from "@/components/brand/glyphs";
import { buttonClass } from "@/components/kit";
import { errorText } from "@/lib/errors";

// Anything that throws while rendering lands here instead of a blank page.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = errorText(error);

  return (
    <main className="grid min-h-dvh place-items-center p-3">
      <section className="w-full max-w-lg rounded-[30px] bg-panel p-8 text-center sm:p-10">
        <div className="flex justify-center gap-2">
          <Star4 className="size-8 text-ink" />
          <Clover className="size-8 text-white" />
          <Ring className="size-8 text-white" />
        </div>
        <h1 className="mt-6 text-3xl font-medium tracking-tight">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-black/60">
          {message && message.length < 160 ? message : "This page hit an unexpected error."} Try again, or go back to your
          home page.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className={buttonClass("primary")}>
            <RotateCw className="size-4 text-lime" />
            Try again
          </button>
          <Link href="/dashboard" className={buttonClass("ghost")}>
            Home
          </Link>
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-[13px] text-black/40">
          <Dots className="size-4" />
          Stumar
          {error.digest ? ` · ${error.digest}` : ""}
        </p>
      </section>
    </main>
  );
}
