import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import schema from "../schema";
import { itemStatKey, recordStats } from "./stats";

export const OPEN_STATUSES = ["open", "accepted", "in_progress"] as const;
export type OpenStatus = (typeof OPEN_STATUSES)[number];

export const MAX_STEPS = 20;

/** Task document plus the display fields every list needs. */
export const taskSummaryValidator = schema.doc("tasks").extend({
  roomNumber: v.optional(v.string()),
  departmentName: v.string(),
  assigneeName: v.optional(v.string()),
  itemKey: v.optional(v.string()),
});

export type TaskSummary = Infer<typeof taskSummaryValidator>;

/** Returns an enrich(task) function with per-call caches for joins. */
export function makeEnricher(ctx: QueryCtx | MutationCtx) {
  const rooms = new Map<Id<"rooms">, Doc<"rooms"> | null>();
  const depts = new Map<Id<"departments">, Doc<"departments"> | null>();
  const users = new Map<Id<"users">, Doc<"users"> | null>();
  const items = new Map<Id<"catalogItems">, Doc<"catalogItems"> | null>();

  async function cached<T extends "rooms" | "departments" | "users" | "catalogItems">(
    map: Map<Id<T>, Doc<T> | null>,
    table: T,
    id: Id<T>,
  ): Promise<Doc<T> | null> {
    if (map.has(id)) return map.get(id) ?? null;
    const doc = (await ctx.db.get(table, id)) as Doc<T> | null;
    map.set(id, doc);
    return doc;
  }

  return async function enrich(task: Doc<"tasks">): Promise<TaskSummary> {
    const room = task.roomId ? await cached(rooms, "rooms", task.roomId) : null;
    const dept = await cached(depts, "departments", task.departmentId);
    const assignee = task.assigneeUserId
      ? await cached(users, "users", task.assigneeUserId)
      : null;
    const item = task.itemId ? await cached(items, "catalogItems", task.itemId) : null;
    return {
      ...task,
      roomNumber: room?.number,
      departmentName: dept?.name ?? "—",
      assigneeName: assignee?.name,
      itemKey: item?.key,
    };
  };
}

export function stepsFromItem(item: Doc<"catalogItems"> | null) {
  if (!item) return [];
  return item.steps.slice(0, MAX_STEPS).map((text) => ({ text }));
}

/**
 * Insert a task, update dailyStats, and schedule the department push and the
 * escalation check. Callers have already validated access and inputs.
 */
export async function insertTask(
  ctx: MutationCtx,
  args: {
    hotel: Doc<"hotels">;
    department: Doc<"departments">;
    item: Doc<"catalogItems"> | null;
    room: Doc<"rooms"> | null;
    stay: Doc<"stays"> | null;
    title: string;
    detail?: string;
    quantity?: number;
    guestNote?: string;
    source: Doc<"tasks">["source"];
    priority: Doc<"tasks">["priority"];
    createdByUserId?: Id<"users">;
    /** Override the steps copied from the item (e.g. multi-item orders). */
    steps?: { text: string }[];
    /** Override the computed price (item price x quantity). */
    price?: number;
    /** Item keys counted in dailyStats.byItem (defaults to the item key). */
    statItemKeys?: string[];
    /** Send the department push (default true). */
    notify?: boolean;
  },
): Promise<Id<"tasks">> {
  const now = Date.now();
  const unitPrice = args.item?.price;
  const price =
    args.price !== undefined
      ? args.price
      : unitPrice !== undefined
        ? unitPrice * (args.quantity ?? 1)
        : undefined;
  const taskId = await ctx.db.insert("tasks", {
    hotelId: args.hotel._id,
    departmentId: args.department._id,
    itemId: args.item?._id,
    stayId: args.stay?._id,
    roomId: args.room?._id,
    title: args.title,
    detail: args.detail,
    quantity: args.quantity,
    guestNote: args.guestNote,
    source: args.source,
    status: "open",
    priority: args.priority,
    createdByUserId: args.createdByUserId,
    steps: (args.steps ?? stepsFromItem(args.item)).slice(0, MAX_STEPS),
    price,
  });

  const itemKeys = args.statItemKeys ?? (args.item ? [itemStatKey(args.item)] : []);
  await recordStats(ctx, args.hotel, now, {
    requests: 1,
    departmentId: args.department._id,
    itemKey: itemKeys[0],
  });
  // Extra items of a multi-item order only bump byItem.
  for (const key of itemKeys.slice(1)) {
    await recordStats(ctx, args.hotel, now, { itemOnly: key });
  }

  if (args.notify !== false) {
    await ctx.scheduler.runAfter(0, internal.push.notifyTask, { taskId });
  }
  await scheduleEscalation(ctx, taskId, args.department);
  return taskId;
}

export async function scheduleEscalation(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  department: Doc<"departments">,
) {
  const minutes = Math.min(Math.max(department.escalationMinutes, 1), 24 * 60);
  await ctx.scheduler.runAfter(minutes * 60 * 1000, internal.escalation.checkTask, { taskId });
}

/** Count not-done tasks of a stay (bounded: the newest 100 tasks). */
export async function openTaskCountForStay(
  ctx: QueryCtx | MutationCtx,
  stayId: Id<"stays">,
): Promise<number> {
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_stayId", (q) => q.eq("stayId", stayId))
    .order("desc")
    .take(100);
  return rows.filter((t) => (OPEN_STATUSES as readonly string[]).includes(t.status)).length;
}

/** Open (not done / cancelled) tasks of a hotel, up to `perStatus` per status. */
export async function openTasksForHotel(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<"hotels">,
  perStatus = 300,
): Promise<Doc<"tasks">[]> {
  const out: Doc<"tasks">[] = [];
  for (const status of OPEN_STATUSES) {
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_hotelId_and_status_and_doneAt", (q) =>
        q.eq("hotelId", hotelId).eq("status", status),
      )
      .take(perStatus);
    out.push(...rows);
  }
  return out;
}
