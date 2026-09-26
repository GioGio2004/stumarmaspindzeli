import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  checkInt,
  cleanOptionalText,
  cleanText,
  fail,
  memberOrSignedOut,
  randomToken,
  requireRole,
} from "./lib/access";
import { openTasksForHotel } from "./lib/tasks";

const ROOM_TOKEN_BYTES = 16;

export function compareRoomNumbers(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}

async function roomByNumber(ctx: MutationCtx, hotelId: Id<"hotels">, number: string) {
  return await ctx.db
    .query("rooms")
    .withIndex("by_hotelId_and_number", (q) => q.eq("hotelId", hotelId).eq("number", number))
    .first();
}

async function loadRoomAsManager(ctx: MutationCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get("rooms", roomId);
  if (room === null) fail("NOT_FOUND", "Room not found");
  await requireRole(ctx, room.hotelId, ["manager"]);
  return room;
}

/**
 * Rooms sorted by number with a summary of the current stay. The room token
 * (guest credential) is only included for managers and reception.
 */
export const list = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(
    v.object({
      _id: v.id("rooms"),
      _creationTime: v.number(),
      number: v.string(),
      floor: v.optional(v.string()),
      active: v.boolean(),
      token: v.optional(v.string()),
      currentStay: v.union(
        v.object({
          stayId: v.id("stays"),
          guestLabel: v.optional(v.string()),
          checkInAt: v.number(),
          expectedCheckOutAt: v.number(),
          openTasks: v.number(),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, { hotelId }) => {
    const member = await memberOrSignedOut(ctx, hotelId);
    if (member === null) return [];
    const { membership } = member;
    const showToken = membership.role !== "staff";
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .take(500);
    const stays = await ctx.db
      .query("stays")
      .withIndex("by_hotelId_and_status", (q) => q.eq("hotelId", hotelId).eq("status", "active"))
      .take(500);
    const stayById = new Map<Id<"stays">, Doc<"stays">>(stays.map((s) => [s._id, s]));
    const openByStay = new Map<Id<"stays">, number>();
    for (const t of await openTasksForHotel(ctx, hotelId)) {
      if (t.stayId) openByStay.set(t.stayId, (openByStay.get(t.stayId) ?? 0) + 1);
    }
    return rooms
      .sort((a, b) => compareRoomNumbers(a.number, b.number))
      .map((r) => {
        const stay = r.currentStayId ? stayById.get(r.currentStayId) : undefined;
        return {
          _id: r._id,
          _creationTime: r._creationTime,
          number: r.number,
          floor: r.floor,
          active: r.active,
          token: showToken ? r.token : undefined,
          currentStay: stay
            ? {
                stayId: stay._id,
                guestLabel: stay.guestLabel,
                checkInAt: stay.checkInAt,
                expectedCheckOutAt: stay.expectedCheckOutAt,
                openTasks: openByStay.get(stay._id) ?? 0,
              }
            : null,
        };
      });
  },
});

export const create = mutation({
  args: { hotelId: v.id("hotels"), number: v.string(), floor: v.optional(v.string()) },
  returns: v.id("rooms"),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.hotelId, ["manager"]);
    const number = cleanText(args.number, "Room number", 10);
    if (await roomByNumber(ctx, args.hotelId, number)) {
      fail("DUPLICATE", `Room ${number} already exists`);
    }
    return await ctx.db.insert("rooms", {
      hotelId: args.hotelId,
      number,
      floor: cleanOptionalText(args.floor, "Floor", 10),
      token: randomToken(ROOM_TOKEN_BYTES),
      active: true,
    });
  },
});

/** Create rooms `from`..`to` (inclusive, max 100); existing numbers are skipped. */
export const createRange = mutation({
  args: {
    hotelId: v.id("hotels"),
    from: v.number(),
    to: v.number(),
    floor: v.optional(v.string()),
  },
  returns: v.object({ created: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.hotelId, ["manager"]);
    const from = checkInt(args.from, "From", 0, 99999);
    const to = checkInt(args.to, "To", 0, 99999);
    if (to < from) fail("INVALID", "`to` must be ≥ `from`");
    if (to - from + 1 > 100) fail("INVALID", "At most 100 rooms at once");
    const floor = cleanOptionalText(args.floor, "Floor", 10);
    let created = 0;
    let skipped = 0;
    for (let n = from; n <= to; n++) {
      const number = String(n);
      if (await roomByNumber(ctx, args.hotelId, number)) {
        skipped++;
        continue;
      }
      await ctx.db.insert("rooms", {
        hotelId: args.hotelId,
        number,
        floor,
        token: randomToken(ROOM_TOKEN_BYTES),
        active: true,
      });
      created++;
    }
    return { created, skipped };
  },
});

export const update = mutation({
  args: {
    roomId: v.id("rooms"),
    number: v.optional(v.string()),
    floor: v.optional(v.string()), // empty string clears
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await loadRoomAsManager(ctx, args.roomId);
    const patch: Partial<Doc<"rooms">> = {};
    if (args.number !== undefined) {
      const number = cleanText(args.number, "Room number", 10);
      if (number !== room.number) {
        if (await roomByNumber(ctx, room.hotelId, number)) {
          fail("DUPLICATE", `Room ${number} already exists`);
        }
        patch.number = number;
      }
    }
    if (args.floor !== undefined) patch.floor = cleanOptionalText(args.floor, "Floor", 10);
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch("rooms", room._id, patch);
    return null;
  },
});

/** Issue a new guest token; the old NFC/QR link stops working. */
export const rotateToken = mutation({
  args: { roomId: v.id("rooms") },
  returns: v.string(),
  handler: async (ctx, { roomId }) => {
    await loadRoomAsManager(ctx, roomId);
    const token = randomToken(ROOM_TOKEN_BYTES);
    await ctx.db.patch("rooms", roomId, { token });
    return token;
  },
});

export const remove = mutation({
  args: { roomId: v.id("rooms") },
  returns: v.null(),
  handler: async (ctx, { roomId }) => {
    const room = await loadRoomAsManager(ctx, roomId);
    const active = await ctx.db
      .query("stays")
      .withIndex("by_roomId_and_status", (q) => q.eq("roomId", roomId).eq("status", "active"))
      .first();
    if (active) fail("ROOM_OCCUPIED", "Check the guest out before removing the room");
    await ctx.db.delete("rooms", room._id);
    return null;
  },
});
