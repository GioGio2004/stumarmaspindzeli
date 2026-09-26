import Link from "next/link";
import { Clover, Dots, Ring, Star4 } from "@/components/brand/glyphs";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-3">
      <section className="w-full max-w-lg rounded-[30px] bg-panel p-8 text-center sm:p-10">
        <div className="flex justify-center gap-2">
          <Star4 className="size-8 text-ink" />
          <Clover className="size-8 text-white" />
          <Ring className="size-8 text-white" />
        </div>
        <p className="mt-6 font-script text-2xl text-black/55">Page not found</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-black/60">The link may be old or mistyped.</p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white"
        >
          Go to my home page
        </Link>
        <p className="mt-8 flex items-center justify-center gap-2 text-[13px] text-black/40">
          <Dots className="size-4" />
          Stumar
        </p>
      </section>
    </main>
  );
}
