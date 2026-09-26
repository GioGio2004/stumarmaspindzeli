import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { closeStay } from "./stays";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BATCH = 100;

/** Check out active stays whose expected checkout is more than 6h ago. */
export const autoCheckout = internalMutation({
  args: {},
  returns: v.object({ checkedOut: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const overdue = await ctx.db
      .query("stays")
      .withIndex("by_status_and_expectedCheckOutAt", (q) =>
        q.eq("status", "active").lt("expectedCheckOutAt", now - 6 * HOUR_MS),
      )
      .take(BATCH);
    for (const stay of overdue) await closeStay(ctx, stay, now);
    if (overdue.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.maintenance.autoCheckout, {});
    }
    return { checkedOut: overdue.length };
  },
});

/**
 * Daily retention: delete guestEvents older than 90 days and clear guest
 * notes on tasks of stays checked out more than 14 days ago. Batched; it
 * reschedules itself while there is more to do.
 */
export const retention = internalMutation({
  args: {},
  returns: v.object({ eventsDeleted: v.number(), staysPurged: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const events = await ctx.db
      .query("guestEvents")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", now - 90 * DAY_MS))
      .take(500);
    for (const e of events) await ctx.db.delete("guestEvents", e._id);

    const stays = await ctx.db
      .query("stays")
      .withIndex("by_status_and_purgedAt_and_checkedOutAt", (q) =>
        q
          .eq("status", "checked_out")
          .eq("purgedAt", undefined)
          .lt("checkedOutAt", now - 14 * DAY_MS),
      )
      .take(20);
    for (const stay of stays) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_stayId", (q) => q.eq("stayId", stay._id))
        .take(200);
      for (const t of tasks) {
        if (t.guestNote !== undefined) {
          await ctx.db.patch("tasks", t._id, { guestNote: undefined });
        }
      }
      await ctx.db.patch("stays", stay._id, { purgedAt: now });
    }

    if (events.length === 500 || stays.length === 20) {
      await ctx.scheduler.runAfter(0, internal.maintenance.retention, {});
    }
    return { eventsDeleted: events.length, staysPurged: stays.length };
  },
});
