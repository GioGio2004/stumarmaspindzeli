import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  canSeeDepartment,
  checkInt,
  checkTimestamp,
  cleanOptionalText,
  fail,
  newStayCredentials,
  requireRole,
} from "./lib/access";
import { makeEnricher, openTasksForHotel, taskSummaryValidator } from "./lib/tasks";
import schema from "./schema";

const LANG_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

async function loadStayAsDesk(ctx: MutationCtx, stayId: Id<"stays">) {
  const stay = await ctx.db.get("stays", stayId);
  if (stay === null) fail("NOT_FOUND", "Stay not found");
  await requireRole(ctx, stay.hotelId, ["manager", "reception"]);
  return stay;
}

/** Close a stay and detach it from its room. Shared with the auto-checkout cron. */
export async function closeStay(ctx: MutationCtx, stay: Doc<"stays">, now: number) {
  // The guest key dies with the stay; requests nobody started are cancelled.
  await ctx.db.patch("stays", stay._id, { status: "checked_out", checkedOutAt: now, guestKey: undefined });
  const open = await ctx.db
    .query("tasks")
    .withIndex("by_stayId", (q) => q.eq("stayId", stay._id))
    .order("desc")
    .take(100);
  for (const t of open) {
    if (t.status === "open") await ctx.db.patch("tasks", t._id, { status: "cancelled", cancelledAt: now });
  }
  const room = await ctx.db.get("rooms", stay.roomId);
  if (room && room.currentStayId === stay._id) {
    await ctx.db.patch("rooms", room._id, { currentStayId: undefined });
  }
}

export const checkIn = mutation({
  args: {
    hotelId: v.id("hotels"),
    roomId: v.id("rooms"),
    guestLabel: v.optional(v.string()),
    language: v.optional(v.string()),
    adults: v.optional(v.number()),
    children: v.optional(v.number()),
    expectedCheckOutAt: v.number(),
    pmsRef: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.id("stays"),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.hotelId, ["manager", "reception"]);
    const room = await ctx.db.get("rooms", args.roomId);
    if (room === null || room.hotelId !== args.hotelId) fail("NOT_FOUND", "Room not found");
    if (!room.active) fail("ROOM_INACTIVE", "Room is disabled");
    const active = await ctx.db
      .query("stays")
      .withIndex("by_roomId_and_status", (q) => q.eq("roomId", room._id).eq("status", "active"))
      .first();
    if (active) fail("ROOM_OCCUPIED", `Room ${room.number} already has a guest`);

    const now = Date.now();
    const expectedCheckOutAt = checkTimestamp(args.expectedCheckOutAt, "Checkout");
    if (expectedCheckOutAt <= now) fail("INVALID", "Checkout must be in the future");
    if (expectedCheckOutAt > now + 365 * 24 * 3600 * 1000) fail("INVALID", "Stay too long");
    const language = cleanOptionalText(args.language, "Language", 12);
    if (language !== undefined && !LANG_RE.test(language)) fail("INVALID", "Invalid language");

    const stayId = await ctx.db.insert("stays", {
      hotelId: args.hotelId,
      roomId: room._id,
      status: "active",
      guestLabel: cleanOptionalText(args.guestLabel, "Guest label", 40),
      language,
      adults: args.adults !== undefined ? checkInt(args.adults, "Adults", 0, 20) : undefined,
      children:
        args.children !== undefined ? checkInt(args.children, "Children", 0, 20) : undefined,
      checkInAt: now,
      expectedCheckOutAt,
      pmsRef: cleanOptionalText(args.pmsRef, "PMS reference", 64),
      note: cleanOptionalText(args.note, "Note", 500),
      ...newStayCredentials(),
    });
    await ctx.db.patch("rooms", room._id, { currentStayId: stayId });
    return stayId;
  },
});

export const checkOut = mutation({
  args: { stayId: v.id("stays") },
  returns: v.null(),
  handler: async (ctx, { stayId }) => {
    const stay = await loadStayAsDesk(ctx, stayId);
    if (stay.status !== "active") return null; // idempotent
    await closeStay(ctx, stay, Date.now());
    return null;
  },
});

export const extend = mutation({
  args: { stayId: v.id("stays"), expectedCheckOutAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stay = await loadStayAsDesk(ctx, args.stayId);
    if (stay.status !== "active") fail("INVALID", "Stay is already checked out");
    const at = checkTimestamp(args.expectedCheckOutAt, "Checkout");
    if (at <= stay.checkInAt) fail("INVALID", "Checkout must be after check-in");
    await ctx.db.patch("stays", stay._id, { expectedCheckOutAt: at });
    return null;
  },
});

/** New PIN for a stay; phones that unlocked with the old one must unlock again. */
export const resetPin = mutation({
  args: { stayId: v.id("stays") },
  returns: v.string(),
  handler: async (ctx, { stayId }) => {
    const stay = await loadStayAsDesk(ctx, stayId);
    if (stay.status !== "active") fail("INVALID", "This stay has ended");
    const creds = newStayCredentials();
    await ctx.db.patch("stays", stay._id, creds);
    return creds.guestPin;
  },
});

export const listActive = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(
    schema.doc("stays").extend({ roomNumber: v.optional(v.string()), openTasks: v.number() }),
  ),
  handler: async (ctx, { hotelId }) => {
    // Guest details are for the front desk, not every staff member.
    await requireRole(ctx, hotelId, ["manager", "reception"]);
    const stays = await ctx.db
      .query("stays")
      .withIndex("by_hotelId_and_status", (q) => q.eq("hotelId", hotelId).eq("status", "active"))
      .take(500);
    const openByStay = new Map<Id<"stays">, number>();
    for (const t of await openTasksForHotel(ctx, hotelId)) {
      if (t.stayId) openByStay.set(t.stayId, (openByStay.get(t.stayId) ?? 0) + 1);
    }
    const out = [];
    for (const s of stays) {
      const room = await ctx.db.get("rooms", s.roomId);
      out.push({ ...s, guestKey: undefined, roomNumber: room?.number, openTasks: openByStay.get(s._id) ?? 0 });
    }
    return out.sort((a, b) =>
      (a.roomNumber ?? "").localeCompare(b.roomNumber ?? "", "en", { numeric: true }),
    );
  },
});

export const get = query({
  args: { stayId: v.id("stays") },
  returns: v.union(
    v.object({
      stay: schema.doc("stays"),
      room: v.union(
        v.object({ _id: v.id("rooms"), number: v.string(), floor: v.optional(v.string()) }),
        v.null(),
      ),
      tasks: v.array(taskSummaryValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, { stayId }) => {
    const stay = await ctx.db.get("stays", stayId);
    if (stay === null) return null;
    const { membership } = await requireRole(ctx, stay.hotelId, ["manager", "reception"]);
    const room = await ctx.db.get("rooms", stay.roomId);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_stayId", (q) => q.eq("stayId", stayId))
      .order("desc")
      .take(50);
    const enrich = makeEnricher(ctx);
    const visible = tasks.filter((t) => canSeeDepartment(membership, t.departmentId));
    return {
      stay: { ...stay, guestKey: undefined },
      room: room ? { _id: room._id, number: room.number, floor: room.floor } : null,
      tasks: await Promise.all(visible.map(enrich)),
    };
  },
});
