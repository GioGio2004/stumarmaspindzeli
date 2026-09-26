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

const DEFAULT_ZONE = "Asia/Tbilisi";

function zoneOrDefault(timeZone?: string) {
  if (!timeZone) return DEFAULT_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_ZONE;
  }
}

/** "YYYY-MM-DD" for a moment in the hotel's time zone. */
export function dayKey(ms: number, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zoneOrDefault(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ms);
}

/** How far `timeZone` is ahead of UTC at `ms`, in ms. */
function zoneOffset(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(ms / 1000) * 1000;
}

/** Epoch ms of a wall-clock time ("YYYY-MM-DD", "HH:MM") in the hotel's time zone. */
export function hotelTime(day: string, hhmm: string, timeZone?: string) {
  const zone = zoneOrDefault(timeZone);
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h || 0, min || 0);
  const first = guess - zoneOffset(guess, zone);
  // Re-check once so a DST change between the guess and the answer is handled.
  const second = guess - zoneOffset(first, zone);
  return second;
}

/** Midnight today in the hotel's time zone, as epoch ms. */
export function startOfHotelDay(now: number, timeZone?: string) {
  return hotelTime(dayKey(now, timeZone), "00:00", timeZone);
}

export { errorText } from "./errors";
