import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { checkNumber, cleanOptionalText, cleanText, fail, memberOrSignedOut, requireRole } from "./lib/access";
import schema from "./schema";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanTime(time: string): string {
  const t = time.trim();
  if (!TIME_RE.test(t)) fail("INVALID", "Time must be HH:MM");
  return t;
}

function cleanDays(days: number[] | undefined): number[] | undefined {
  if (days === undefined) return undefined;
  const out = [...new Set(days)].sort((a, b) => a - b);
  for (const d of out) {
    if (!Number.isInteger(d) || d < 0 || d > 6) fail("INVALID", "Days are 0 (Sun) to 6 (Sat)");
  }
  // Empty or all seven days both mean "every day".
  return out.length === 0 || out.length === 7 ? undefined : out;
}

export function sortEvents<T extends Pick<Doc<"resortEvents">, "time" | "sortOrder">>(rows: T[]) {
  return rows.sort((a, b) => a.time.localeCompare(b.time) || a.sortOrder - b.sortOrder);
}

async function loadEventAsManager(ctx: MutationCtx, eventId: Id<"resortEvents">) {
  const e = await ctx.db.get("resortEvents", eventId);
  if (e === null) fail("NOT_FOUND", "Event not found");
  await requireRole(ctx, e.hotelId, ["manager"]);
  return e;
}

export const list = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(schema.doc("resortEvents")),
  handler: async (ctx, { hotelId }) => {
    if ((await memberOrSignedOut(ctx, hotelId, ["manager"])) === null) return [];
    const rows = await ctx.db
      .query("resortEvents")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .take(200);
    return sortEvents(rows);
  },
});

export const create = mutation({
  args: {
    hotelId: v.id("hotels"),
    time: v.string(),
    title: v.string(),
    place: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())), // omitted = every day
    visible: v.optional(v.boolean()),
  },
  returns: v.id("resortEvents"),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.hotelId, ["manager"]);
    const existing = await ctx.db
      .query("resortEvents")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", args.hotelId))
      .take(200);
    if (existing.length >= 100) fail("LIMIT", "At most 100 events");
    return await ctx.db.insert("resortEvents", {
      hotelId: args.hotelId,
      time: cleanTime(args.time),
      title: cleanText(args.title, "Title", 80),
      place: cleanOptionalText(args.place, "Place", 80),
      daysOfWeek: cleanDays(args.daysOfWeek),
      visible: args.visible ?? true,
      sortOrder: existing.reduce((m, e) => Math.max(m, e.sortOrder + 1), 0),
    });
  },
});

/** Partial update. `place: null` clears it; `daysOfWeek: null` means every day. */
export const update = mutation({
  args: {
    eventId: v.id("resortEvents"),
    time: v.optional(v.string()),
    title: v.optional(v.string()),
    place: v.optional(v.union(v.string(), v.null())),
    daysOfWeek: v.optional(v.union(v.array(v.number()), v.null())),
    visible: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const e = await loadEventAsManager(ctx, args.eventId);
    const patch: Partial<Doc<"resortEvents">> = {};
    if (args.time !== undefined) patch.time = cleanTime(args.time);
    if (args.title !== undefined) patch.title = cleanText(args.title, "Title", 80);
    if (args.place !== undefined) {
      patch.place = args.place === null ? undefined : cleanOptionalText(args.place, "Place", 80);
    }
    if (args.daysOfWeek !== undefined) {
      patch.daysOfWeek = args.daysOfWeek === null ? undefined : cleanDays(args.daysOfWeek);
    }
    if (args.visible !== undefined) patch.visible = args.visible;
    if (args.sortOrder !== undefined) {
      patch.sortOrder = checkNumber(args.sortOrder, "Sort order", -1e6, 1e6);
    }
    await ctx.db.patch("resortEvents", e._id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { eventId: v.id("resortEvents") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const e = await ctx.db.get("resortEvents", eventId);
    if (e === null) return null;
    await requireRole(ctx, e.hotelId, ["manager"]);
    await ctx.db.delete("resortEvents", eventId);
    return null;
  },
});
