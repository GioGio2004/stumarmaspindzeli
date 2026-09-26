import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { cleanOptionalText, fail, requireDepartment, requireRole } from "./lib/access";
import { localParts } from "./lib/stats";
import { insertTask } from "./lib/tasks";
import { compareRoomNumbers } from "./rooms";
import schema, { routineScopeValidator } from "./schema";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_TASKS_PER_RUN = 100; // per transaction; larger runs continue in a new one
const MAX_ROOMS = 2000;

function cleanTime(time: string): string {
  const t = time.trim();
  if (!TIME_RE.test(t)) fail("INVALID", "Time must be HH:MM");
  return t;
}

function cleanDays(days: number[]): number[] {
  const out = [...new Set(days)].sort((a, b) => a - b);
  if (out.length === 0) fail("INVALID", "Pick at least one day");
  for (const d of out) {
    if (!Number.isInteger(d) || d < 0 || d > 6) fail("INVALID", "Days are 0 (Sun) to 6 (Sat)");
  }
  return out;
}

async function loadItem(ctx: MutationCtx, hotelId: Id<"hotels">, itemId: Id<"catalogItems">) {
  const item = await ctx.db.get("catalogItems", itemId);
  if (item === null || item.hotelId !== hotelId || item.archived) {
    fail("NOT_FOUND", "Playbook not found");
  }
  return item;
}

async function loadRoutineAsManager(ctx: MutationCtx, routineId: Id<"routines">) {
  const routine = await ctx.db.get("routines", routineId);
  if (routine === null) fail("NOT_FOUND", "Routine not found");
  await requireRole(ctx, routine.hotelId, ["manager"]);
  return routine;
}

export const list = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(
    schema.doc("routines").extend({ itemTitle: v.string(), departmentName: v.string() }),
  ),
  handler: async (ctx, { hotelId }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    const rows = await ctx.db
      .query("routines")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .take(200);
    const out = [];
    for (const r of rows) {
      const item = await ctx.db.get("catalogItems", r.itemId);
      const dept = await ctx.db.get("departments", r.departmentId);
      out.push({ ...r, itemTitle: item?.title ?? "—", departmentName: dept?.name ?? "—" });
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  },
});

export const create = mutation({
  args: {
    hotelId: v.id("hotels"),
    itemId: v.id("catalogItems"),
    departmentId: v.optional(v.id("departments")), // defaults to the item's department
    title: v.optional(v.string()),
    daysOfWeek: v.array(v.number()),
    time: v.string(),
    scope: routineScopeValidator,
    active: v.optional(v.boolean()),
  },
  returns: v.id("routines"),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.hotelId, ["manager"]);
    const hotel = await ctx.db.get("hotels", args.hotelId);
    if (hotel === null) fail("NOT_FOUND", "Hotel not found");
    const existing = await ctx.db
      .query("routines")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", args.hotelId))
      .take(200);
    if (existing.length >= 100) fail("LIMIT", "At most 100 routines");
    const item = await loadItem(ctx, args.hotelId, args.itemId);
    const departmentId = args.departmentId ?? item.departmentId;
    if (departmentId === undefined) fail("INVALID", "Choose a department");
    await requireDepartment(ctx, args.hotelId, departmentId);
    const time = cleanTime(args.time);
    const daysOfWeek = cleanDays(args.daysOfWeek);
    // If today's slot has already passed, start tomorrow instead of firing now.
    const now = localParts(Date.now(), hotel.timezone);
    const lastRunDay = daysOfWeek.includes(now.dow) && time <= now.hhmm ? now.day : undefined;
    return await ctx.db.insert("routines", {
      hotelId: args.hotelId,
      itemId: item._id,
      departmentId,
      title: cleanOptionalText(args.title, "Title", 120),
      daysOfWeek,
      time,
      scope: args.scope,
      active: args.active ?? true,
      lastRunDay,
    });
  },
});

/** Partial update. `title: null` clears the custom title. */
export const update = mutation({
  args: {
    routineId: v.id("routines"),
    itemId: v.optional(v.id("catalogItems")),
    departmentId: v.optional(v.id("departments")),
    title: v.optional(v.union(v.string(), v.null())),
    daysOfWeek: v.optional(v.array(v.number())),
    time: v.optional(v.string()),
    scope: v.optional(routineScopeValidator),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const routine = await loadRoutineAsManager(ctx, args.routineId);
    const patch: Partial<Doc<"routines">> = {};
    if (args.itemId !== undefined) {
      const item = await loadItem(ctx, routine.hotelId, args.itemId);
      patch.itemId = item._id;
      if (args.departmentId === undefined && item.departmentId !== undefined) {
        patch.departmentId = item.departmentId;
      }
    }
    if (args.departmentId !== undefined) {
      await requireDepartment(ctx, routine.hotelId, args.departmentId);
      patch.departmentId = args.departmentId;
    }
    if (args.title !== undefined) {
      patch.title = args.title === null ? undefined : cleanOptionalText(args.title, "Title", 120);
    }
    if (args.daysOfWeek !== undefined) patch.daysOfWeek = cleanDays(args.daysOfWeek);
    if (args.time !== undefined) patch.time = cleanTime(args.time);
    if (args.scope !== undefined) patch.scope = args.scope;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch("routines", routine._id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { routineId: v.id("routines") },
  returns: v.null(),
  handler: async (ctx, { routineId }) => {
    const routine = await ctx.db.get("routines", routineId);
    if (routine === null) return null;
    await requireRole(ctx, routine.hotelId, ["manager"]);
    await ctx.db.delete("routines", routineId);
    return null;
  },
});

// ---- scheduled -------------------------------------------------------------

/** Every 10 minutes: schedule a run for each active routine that is due. */
export const tick = internalMutation({
  args: {},
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const tz = new Map<Id<"hotels">, string | undefined>();
    let scheduled = 0;
    // Stream every active routine (no silent cap).
    for await (const r of ctx.db.query("routines").withIndex("by_active", (q) => q.eq("active", true))) {
      if (!tz.has(r.hotelId)) tz.set(r.hotelId, (await ctx.db.get("hotels", r.hotelId))?.timezone);
      const local = localParts(now, tz.get(r.hotelId));
      if (!r.daysOfWeek.includes(local.dow)) continue;
      if (r.time > local.hhmm) continue;
      if (r.lastRunDay === local.day) continue;
      // One transaction per routine keeps each run within mutation limits.
      await ctx.scheduler.runAfter(0, internal.routines.runRoutine, {
        routineId: r._id,
        day: local.day,
      });
      scheduled++;
    }
    return { scheduled };
  },
});

/** Create the routine's tasks for `day`. Idempotent per day. */
export const runRoutine = internalMutation({
  // offset > 0 continues a large run in the next transaction.
  args: { routineId: v.id("routines"), day: v.string(), offset: v.optional(v.number()) },
  returns: v.object({ created: v.number() }),
  handler: async (ctx, { routineId, day, offset = 0 }) => {
    const routine = await ctx.db.get("routines", routineId);
    if (routine === null || !routine.active) return { created: 0 };
    if (offset === 0) {
      if (routine.lastRunDay === day) return { created: 0 };
      await ctx.db.patch("routines", routineId, { lastRunDay: day });
    }

    const hotel = await ctx.db.get("hotels", routine.hotelId);
    const item = await ctx.db.get("catalogItems", routine.itemId);
    const department = await ctx.db.get("departments", routine.departmentId);
    if (
      hotel === null ||
      item === null ||
      item.archived ||
      department === null ||
      department.archived ||
      department.hotelId !== hotel._id
    ) {
      return { created: 0 };
    }

    type Target = { room: Doc<"rooms"> | null; stay: Doc<"stays"> | null };
    let targets: Target[] = [];
    if (routine.scope === "once") {
      targets = [{ room: null, stay: null }];
    } else if (routine.scope === "each_occupied_room") {
      const stays = await ctx.db
        .query("stays")
        .withIndex("by_hotelId_and_status", (q) => q.eq("hotelId", hotel._id).eq("status", "active"))
        .take(MAX_ROOMS);
      for (const stay of stays) {
        const room = await ctx.db.get("rooms", stay.roomId);
        if (room && room.active) targets.push({ room, stay });
      }
    } else {
      const rooms = await ctx.db
        .query("rooms")
        .withIndex("by_hotelId", (q) => q.eq("hotelId", hotel._id))
        .take(MAX_ROOMS);
      for (const room of rooms.filter((r) => r.active)) {
        let stay: Doc<"stays"> | null = null;
        if (room.currentStayId) {
          const s = await ctx.db.get("stays", room.currentStayId);
          if (s && s.status === "active") stay = s;
        }
        targets.push({ room, stay });
      }
    }
    targets.sort((a, b) => compareRoomNumbers(a.room?.number ?? "", b.room?.number ?? ""));
    const batch = targets.slice(offset, offset + MAX_TASKS_PER_RUN);

    const title = routine.title ?? item.title;
    let created = 0;
    for (const { room, stay } of batch) {
      await insertTask(ctx, {
        hotel,
        department,
        item,
        room,
        stay,
        title,
        source: "manager",
        priority: "normal",
        // One push for the whole run, not one per room.
        notify: offset === 0 && created === 0,
        // Per-room runs don't page managers for every room.
        escalate: routine.scope === "once",
      });
      created++;
    }
    if (offset + MAX_TASKS_PER_RUN < targets.length) {
      await ctx.scheduler.runAfter(0, internal.routines.runRoutine, {
        routineId,
        day,
        offset: offset + MAX_TASKS_PER_RUN,
      });
    }
    return { created };
  },
});
