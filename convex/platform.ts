import { v } from "convex/values";
import { query } from "./_generated/server";
import { fail } from "./lib/access";
import { isSupervisor } from "./lib/supervisor";
import { roleValidator } from "./schema";
import schema from "./schema";
import { requireUser } from "./users";

// Supervisor-only overview of every hotel and every person on the platform.

/** The supervisor, or null when nobody is signed in (see memberOrSignedOut in lib/access). */
async function supervisorOrSignedOut(ctx: Parameters<typeof requireUser>[0]) {
  if ((await ctx.auth.getUserIdentity()) === null) return null;
  const user = await requireUser(ctx);
  if (!isSupervisor(user)) fail("FORBIDDEN", "Supervisor only");
  return user;
}

export const hotels = query({
  args: {},
  returns: v.array(
    v.object({
      hotel: schema.doc("hotels"),
      memberCount: v.number(),
      roomCount: v.number(),
      inHouse: v.number(),
    }),
  ),
  handler: async (ctx) => {
    if ((await supervisorOrSignedOut(ctx)) === null) return [];
    // Bounded so the whole query stays within Convex read limits.
    const hotels = await ctx.db.query("hotels").take(40);
    const out = [];
    for (const hotel of hotels) {
      const members = await ctx.db
        .query("memberships")
        .withIndex("by_hotelId", (q) => q.eq("hotelId", hotel._id))
        .take(200);
      const rooms = await ctx.db
        .query("rooms")
        .withIndex("by_hotelId", (q) => q.eq("hotelId", hotel._id))
        .take(300);
      const inHouse = await ctx.db
        .query("stays")
        .withIndex("by_hotelId_and_status", (q) => q.eq("hotelId", hotel._id).eq("status", "active"))
        .take(300);
      out.push({ hotel, memberCount: members.length, roomCount: rooms.length, inHouse: inHouse.length });
    }
    return out;
  },
});

export const users = query({
  args: {},
  returns: v.array(
    v.object({
      user: schema.doc("users"),
      supervisor: v.boolean(),
      memberships: v.array(v.object({ hotelId: v.id("hotels"), hotelName: v.string(), role: roleValidator })),
    }),
  ),
  handler: async (ctx) => {
    if ((await supervisorOrSignedOut(ctx)) === null) return [];
    const users = await ctx.db.query("users").take(300);
    const hotelNames = new Map<string, string>();
    const out = [];
    for (const user of users) {
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(50);
      const rows = [];
      for (const m of memberships) {
        if (!hotelNames.has(m.hotelId)) {
          const h = await ctx.db.get("hotels", m.hotelId);
          hotelNames.set(m.hotelId, h?.name ?? "Deleted hotel");
        }
        rows.push({ hotelId: m.hotelId, hotelName: hotelNames.get(m.hotelId)!, role: m.role });
      }
      out.push({ user, supervisor: isSupervisor(user), memberships: rows });
    }
    return out;
  },
});
