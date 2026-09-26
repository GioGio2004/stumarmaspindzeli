"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Clover, Ring, Star4 } from "@/components/brand/glyphs";
import { buttonClass } from "@/components/kit";
import { errorText } from "@/lib/errors";

// Errors inside the app keep the sidebar, so staff can move on to another page.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto mt-6 w-full max-w-lg rounded-[30px] bg-panel p-8 text-center sm:p-10">
      <div className="flex justify-center gap-2">
        <Star4 className="size-8 text-ink" />
        <Clover className="size-8 text-white" />
        <Ring className="size-8 text-white" />
      </div>
      <h1 className="mt-6 text-2xl font-medium tracking-tight">This page couldn&apos;t load</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-black/60">{errorText(error)}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={buttonClass("primary")}>
          <RotateCw className="size-4 text-lime" />
          Try again
        </button>
        <Link href="/dashboard" className={buttonClass("ghost")}>
          Home
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-[12px] text-black/40">Reference {error.digest}</p>}
    </section>
  );
}
