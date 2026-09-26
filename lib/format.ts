"use client";

import { useEffect, useState } from "react";

/** Re-renders every `ms` so relative times stay fresh. Queries never read the clock. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function timeAgo(from: number, now: number) {
  const min = Math.max(0, Math.round((now - from) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export function minutesBetween(from: number, to: number) {
  return Math.max(0, Math.round((to - from) / 60_000));
}

export function clockTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "YYYY-MM-DD" for a moment in the hotel's time zone. */
export function dayKey(ms: number, timeZone = "Asia/Tbilisi") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

/** Midnight today in the hotel's time zone, as epoch ms (Tbilisi has no DST). */
export function startOfHotelDay(now: number, offsetHours = 4) {
  const shifted = now + offsetHours * 3_600_000;
  return shifted - (shifted % 86_400_000) - offsetHours * 3_600_000;
}

export function errorText(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong";
  return error.message.replace(/^.*Uncaught Error: /, "").split("\n")[0];
}
