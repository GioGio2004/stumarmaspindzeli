import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { fail, requireRole } from "./lib/access";
import {
  addDays,
  dailyStatsValidator,
  emptyStats,
  getDailyStats,
  isDayKey,
  statsValue,
} from "./lib/stats";
import { openTasksForHotel } from "./lib/tasks";

const avgMin = (totalMs: number, count: number) =>
  count > 0 ? Math.round((totalMs / count / 60000) * 10) / 10 : null;

export const overview = query({
  args: { hotelId: v.id("hotels"), day: v.string() },
  returns: v.object({
    inHouse: v.number(),
    roomsTotal: v.number(),
    openByStatus: v.object({ open: v.number(), accepted: v.number(), in_progress: v.number() }),
    escalatedOpen: v.number(),
    today: dailyStatsValidator,
    last7: v.array(
      v.object({
        day: v.string(),
        requests: v.number(),
        done: v.number(),
        avgResponseMin: v.union(v.number(), v.null()),
      }),
    ),
    departmentLoad: v.array(
      v.object({
        departmentId: v.id("departments"),
        name: v.string(),
        icon: v.string(),
        open: v.number(),
        avgResponseMin: v.union(v.number(), v.null()),
      }),
    ),
    topItems: v.array(v.object({ key: v.string(), title: v.string(), count: v.number() })),
  }),
  handler: async (ctx, { hotelId, day }) => {
    await requireRole(ctx, hotelId, ["manager", "reception"]);
    if (!isDayKey(day)) fail("INVALID", "day must be YYYY-MM-DD");

    const stays = await ctx.db
      .query("stays")
      .withIndex("by_hotelId_and_status", (q) => q.eq("hotelId", hotelId).eq("status", "active"))
      .take(500);
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .take(1000);

    const openTasks = await openTasksForHotel(ctx, hotelId, 500);
    const openByStatus = { open: 0, accepted: 0, in_progress: 0 };
    const openByDept = new Map<string, number>();
    let escalatedOpen = 0;
    for (const t of openTasks) {
      if (t.status === "open" || t.status === "accepted" || t.status === "in_progress") {
        openByStatus[t.status]++;
      }
      if (t.status === "open" && t.escalatedAt !== undefined) escalatedOpen++;
      openByDept.set(t.departmentId, (openByDept.get(t.departmentId) ?? 0) + 1);
    }

    const todayDoc = await getDailyStats(ctx, hotelId, day);
    const today = todayDoc ? statsValue(todayDoc) : emptyStats(day);

    const first = addDays(day, -6);
    const week = await ctx.db
      .query("dailyStats")
      .withIndex("by_hotelId_and_day", (q) =>
        q.eq("hotelId", hotelId).gte("day", first).lte("day", day),
      )
      .take(7);
    const byDay = new Map(week.map((d) => [d.day, d]));
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDays(day, -i);
      const d = byDay.get(key);
      last7.push({
        day: key,
        requests: d?.requests ?? 0,
        done: d?.done ?? 0,
        avgResponseMin: d ? avgMin(d.responseMsTotal, d.responseCount) : null,
      });
    }

    const departments = (
      await ctx.db
        .query("departments")
        .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
        .take(100)
    )
      .filter((d) => !d.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const departmentLoad = departments.map((d) => ({
      departmentId: d._id,
      name: d.name,
      icon: d.icon,
      open: openByDept.get(d._id) ?? 0,
      avgResponseMin: avgMin(
        today.responseMsByDepartment[d._id] ?? 0,
        today.responseCountByDepartment[d._id] ?? 0,
      ),
    }));

    const top = Object.entries(today.byItem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topItems = [];
    for (const [key, count] of top) {
      let title = key;
      if (key.startsWith("id:")) {
        const id = ctx.db.normalizeId("catalogItems", key.slice(3));
        const item = id ? await ctx.db.get("catalogItems", id) : null;
        if (item && item.hotelId === hotelId) title = item.title;
      } else {
        const item = await ctx.db
          .query("catalogItems")
          .withIndex("by_hotelId_and_key", (q) => q.eq("hotelId", hotelId).eq("key", key))
          .first();
        if (item) title = item.title;
      }
      topItems.push({ key, title, count });
    }

    return {
      inHouse: stays.length,
      roomsTotal: rooms.length,
      openByStatus,
      escalatedOpen,
      today,
      last7,
      departmentLoad,
      topItems,
    };
  },
});

const activityKind = v.union(
  v.literal("task_created"),
  v.literal("task_accepted"),
  v.literal("task_in_progress"),
  v.literal("task_done"),
  v.literal("task_cancelled"),
  v.literal("guest_open_app"),
  v.literal("guest_view_feature"),
  v.literal("guest_rate"),
);

/** Last 30 entries: recent tasks (at their latest state) and guest events. */
export const activity = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(
    v.object({
      kind: activityKind,
      text: v.string(),
      roomNumber: v.optional(v.string()),
      taskId: v.optional(v.id("tasks")),
      at: v.number(),
    }),
  ),
  handler: async (ctx, { hotelId }) => {
    await requireRole(ctx, hotelId, ["manager", "reception"]);
    const roomCache = new Map<Id<"rooms">, string | undefined>();
    const roomNumber = async (id: Id<"rooms"> | undefined) => {
      if (!id) return undefined;
      if (!roomCache.has(id)) roomCache.set(id, (await ctx.db.get("rooms", id))?.number);
      return roomCache.get(id);
    };

    type Entry = {
      kind:
        | "task_created"
        | "task_accepted"
        | "task_in_progress"
        | "task_done"
        | "task_cancelled"
        | "guest_open_app"
        | "guest_view_feature"
        | "guest_rate";
      text: string;
      roomNumber?: string;
      taskId?: Id<"tasks">;
      at: number;
    };
    const entries: Entry[] = [];

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .order("desc")
      .take(30);
    for (const t of tasks) {
      const text = t.quantity ? `${t.title} ×${t.quantity}` : t.title;
      const base = { text, roomNumber: await roomNumber(t.roomId), taskId: t._id };
      const kind: Entry["kind"] =
        t.status === "open"
          ? "task_created"
          : t.status === "accepted"
            ? "task_accepted"
            : t.status === "in_progress"
              ? "task_in_progress"
              : t.status === "done"
                ? "task_done"
                : "task_cancelled";
      const at =
        t.status === "done"
          ? (t.doneAt ?? t._creationTime)
          : t.status === "cancelled"
            ? (t.cancelledAt ?? t._creationTime)
            : t.status === "in_progress"
              ? (t.startedAt ?? t.acceptedAt ?? t._creationTime)
              : t.status === "accepted"
                ? (t.acceptedAt ?? t._creationTime)
                : t._creationTime;
      entries.push({ kind, at, ...base });
    }

    const events = await ctx.db
      .query("guestEvents")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .order("desc")
      .take(60);
    for (const e of events) {
      if (e.kind === "request") continue; // covered by the task entry
      entries.push({
        kind:
          e.kind === "open_app"
            ? "guest_open_app"
            : e.kind === "view_feature"
              ? "guest_view_feature"
              : "guest_rate",
        text: e.target ?? e.kind,
        roomNumber: await roomNumber(e.roomId),
        at: e._creationTime,
      });
    }

    return entries.sort((a, b) => b.at - a.at).slice(0, 30);
  },
});
