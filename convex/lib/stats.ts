import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const DEFAULT_TIMEZONE = "Asia/Tbilisi";

/** "YYYY-MM-DD" of `ts` in the given IANA timezone (falls back to Tbilisi, then UTC). */
export function dayKey(ts: number, timeZone: string | undefined): string {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ts);
  try {
    return fmt(timeZone ?? DEFAULT_TIMEZONE);
  } catch {
    try {
      return fmt(DEFAULT_TIMEZONE);
    } catch {
      return new Date(ts).toISOString().slice(0, 10);
    }
  }
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local calendar day, weekday (0 = Sunday) and "HH:MM" of `ts` in a timezone. */
export function localParts(
  ts: number,
  timeZone: string | undefined,
): { day: string; dow: number; hhmm: string } {
  const parts = (tz: string) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(ts);
    const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
    const hour = get("hour") === "24" ? "00" : get("hour");
    return { dow: WEEKDAYS[get("weekday")] ?? 0, hhmm: `${hour.padStart(2, "0")}:${get("minute")}` };
  };
  let local: { dow: number; hhmm: string };
  try {
    local = parts(timeZone ?? DEFAULT_TIMEZONE);
  } catch {
    local = parts(DEFAULT_TIMEZONE);
  }
  return { day: dayKey(ts, timeZone), ...local };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(0);
    return true;
  } catch {
    return false;
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/** Calendar arithmetic on "YYYY-MM-DD" keys (timezone independent). */
export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Record keys must be non-empty ASCII and not start with "$" or "_". */
export function safeStatKey(key: string | undefined): string | null {
  if (!key) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,63}$/.test(key)) return null;
  return key;
}

/** Stat key for a catalog item: its slug, or "id:<itemId>" when it has none. */
export function itemStatKey(item: Pick<Doc<"catalogItems">, "_id" | "key">): string {
  return item.key ?? `id:${item._id}`;
}

export const dailyStatsFields = {
  day: v.string(),
  requests: v.number(),
  done: v.number(),
  responseMsTotal: v.number(),
  responseCount: v.number(),
  completionMsTotal: v.number(),
  completionCount: v.number(),
  appOpens: v.number(),
  byDepartment: v.record(v.string(), v.number()),
  byItem: v.record(v.string(), v.number()),
  featureViews: v.record(v.string(), v.number()),
  responseMsByDepartment: v.record(v.string(), v.number()),
  responseCountByDepartment: v.record(v.string(), v.number()),
};

export const dailyStatsValidator = v.object(dailyStatsFields);

export type DailyStatsValue = {
  day: string;
  requests: number;
  done: number;
  responseMsTotal: number;
  responseCount: number;
  completionMsTotal: number;
  completionCount: number;
  appOpens: number;
  byDepartment: Record<string, number>;
  byItem: Record<string, number>;
  featureViews: Record<string, number>;
  responseMsByDepartment: Record<string, number>;
  responseCountByDepartment: Record<string, number>;
};

export function emptyStats(day: string): DailyStatsValue {
  return {
    day,
    requests: 0,
    done: 0,
    responseMsTotal: 0,
    responseCount: 0,
    completionMsTotal: 0,
    completionCount: 0,
    appOpens: 0,
    byDepartment: {},
    byItem: {},
    featureViews: {},
    responseMsByDepartment: {},
    responseCountByDepartment: {},
  };
}

export function statsValue(doc: Doc<"dailyStats">): DailyStatsValue {
  return {
    day: doc.day,
    requests: doc.requests,
    done: doc.done,
    responseMsTotal: doc.responseMsTotal,
    responseCount: doc.responseCount,
    completionMsTotal: doc.completionMsTotal,
    completionCount: doc.completionCount,
    appOpens: doc.appOpens,
    byDepartment: doc.byDepartment,
    byItem: doc.byItem,
    featureViews: doc.featureViews,
    responseMsByDepartment: doc.responseMsByDepartment,
    responseCountByDepartment: doc.responseCountByDepartment,
  };
}

export async function getDailyStats(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<"hotels">,
  day: string,
): Promise<Doc<"dailyStats"> | null> {
  return await ctx.db
    .query("dailyStats")
    .withIndex("by_hotelId_and_day", (q) => q.eq("hotelId", hotelId).eq("day", day))
    .unique();
}

export type StatUpdate = {
  requests?: number;
  done?: number;
  responseMs?: number; // one created -> accepted sample
  completionMs?: number; // one created -> done sample
  appOpens?: number;
  departmentId?: Id<"departments">; // counted in byDepartment when `requests` is set
  itemKey?: string; // counted in byItem when `requests` is set
  feature?: string; // counted in featureViews
  itemOnly?: string; // bump byItem without counting a request (extra order lines)
};

const MAX_RECORD_KEYS = 200;

function bump(rec: Record<string, number>, key: string | null, by: number) {
  if (key === null || by === 0) return rec;
  if (!(key in rec) && Object.keys(rec).length >= MAX_RECORD_KEYS) return rec;
  return { ...rec, [key]: (rec[key] ?? 0) + by };
}

/** Apply counter changes to the hotel's dailyStats row for the day of `now`. */
export async function recordStats(
  ctx: MutationCtx,
  hotel: Pick<Doc<"hotels">, "_id" | "timezone">,
  now: number,
  update: StatUpdate,
): Promise<void> {
  const day = dayKey(now, hotel.timezone);
  const existing = await getDailyStats(ctx, hotel._id, day);
  const s = existing ? statsValue(existing) : emptyStats(day);

  const requests = update.requests ?? 0;
  const deptKey = update.departmentId ? safeStatKey(update.departmentId) : null;
  const next: DailyStatsValue = {
    ...s,
    requests: s.requests + requests,
    done: s.done + (update.done ?? 0),
    appOpens: s.appOpens + (update.appOpens ?? 0),
    byDepartment: bump(s.byDepartment, requests ? deptKey : null, requests),
    byItem: bump(
      bump(s.byItem, requests ? safeStatKey(update.itemKey) : null, requests),
      safeStatKey(update.itemOnly),
      1,
    ),
    featureViews: bump(s.featureViews, safeStatKey(update.feature), 1),
  };
  if (update.responseMs !== undefined && Number.isFinite(update.responseMs)) {
    const ms = Math.max(0, update.responseMs);
    next.responseMsTotal += ms;
    next.responseCount += 1;
    next.responseMsByDepartment = bump(next.responseMsByDepartment, deptKey, ms);
    next.responseCountByDepartment = bump(next.responseCountByDepartment, deptKey, 1);
  }
  if (update.completionMs !== undefined && Number.isFinite(update.completionMs)) {
    next.completionMsTotal += Math.max(0, update.completionMs);
    next.completionCount += 1;
  }

  if (existing) {
    await ctx.db.patch("dailyStats", existing._id, next);
  } else {
    await ctx.db.insert("dailyStats", { hotelId: hotel._id, ...next });
  }
}
