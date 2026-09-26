"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

const MIN_THUMB = 44;
const HIDE_AFTER_MS = 1100;

/**
 * Replaces the browser's page scrollbar with a floating pill: it fades in while
 * scrolling, turns lime on hover, and can be dragged or clicked on desktop.
 * Touch screens only see it while scrolling.
 */
export function ScrollIndicator() {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startScroll: number } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [scrollable, setScrollable] = useState(false);
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const doc = document.documentElement;
    let frame = 0;

    const layout = () => {
      frame = 0;
      const track = trackRef.current;
      const thumb = thumbRef.current;
      if (!track || !thumb) return;
      const view = window.innerHeight;
      const full = doc.scrollHeight;
      const canScroll = full > view + 1;
      setScrollable(canScroll);
      if (!canScroll) return;
      const trackHeight = track.clientHeight;
      const thumbHeight = Math.max(MIN_THUMB, (view / full) * trackHeight);
      const progress = window.scrollY / (full - view);
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${Math.min(1, Math.max(0, progress)) * (trackHeight - thumbHeight)}px)`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    const onScroll = () => {
      schedule();
      setActive(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setActive(false), HIDE_AFTER_MS);
    };

    schedule();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  const scrollRatio = () => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return 0;
    const room = track.clientHeight - thumb.offsetHeight;
    return room > 0 ? (document.documentElement.scrollHeight - window.innerHeight) / room : 0;
  };

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startScroll: window.scrollY };
    setDragging(true);
  };

  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const top = drag.current.startScroll + (e.clientY - drag.current.startY) * scrollRatio();
    window.scrollTo({ top, behavior: "instant" });
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  // Clicking the empty track jumps the page there.
  const jump = (e: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = (e.clientY - rect.top) / rect.height;
    const doc = document.documentElement;
    window.scrollTo({ top: fraction * (doc.scrollHeight - window.innerHeight), behavior: "smooth" });
  };

  return (
    <div
      ref={trackRef}
      aria-hidden="true"
      onPointerDown={jump}
      className={cn(
        "group fixed bottom-3 right-0.5 top-3 z-[70] w-4 transition-opacity duration-300 [@media(pointer:coarse)]:pointer-events-none",
        !scrollable && "hidden",
        active || dragging ? "opacity-100" : "opacity-0 hover:opacity-100",
      )}
    >
      <div
        ref={thumbRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: "none" }}
        className={cn(
          "absolute right-1 top-0 rounded-full transition-[width,background-color,box-shadow] duration-200",
          dragging
            ? "w-2.5 bg-lime shadow-[0_0_0_4px_rgb(230_251_45/0.25)]"
            : "w-1.5 bg-black/30 group-hover:w-2 hover:bg-lime hover:shadow-[0_0_0_4px_rgb(230_251_45/0.2)]",
        )}
      />
    </div>
  );
}
