import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { cleanOptionalText, fail, guestContext, stayNeedsKey } from "../lib/access";
import { rateLimiter } from "../lib/rateLimits";
import { itemStatKey } from "../lib/stats";
import { insertTask, MAX_STEPS, openTaskCountForStay } from "../lib/tasks";
import { taskStatusValidator } from "../schema";

const MAX_OPEN_PER_STAY = 10;
const DEFAULT_MAX_QUANTITY = 9;

/**
 * Resolve the token to an active stay or throw a guest-readable error. When
 * the hotel uses PINs, the phone must also send the stay's key (see guest/pin).
 */
async function requireStay(ctx: MutationCtx, token: string, key: string | undefined) {
  const g = await guestContext(ctx, token);
  if (g === null) fail("INVALID_TOKEN", "This room link is not valid");
  if (g.stay === null) fail("NO_STAY", "Requests are available during your stay");
  if (stayNeedsKey(g.hotel, g.stay) && key !== g.stay.guestKey) {
    fail("PIN_REQUIRED", "Enter your room PIN from reception to continue");
  }
  return { hotel: g.hotel, room: g.room, stay: g.stay };
}

/**
 * Load a guest-requestable item of the hotel by id or key: visible, not
 * archived, kind request/offer, with a live department.
 */
async function requestableItem(
  ctx: MutationCtx,
  hotelId: Id<"hotels">,
  ref: { itemId?: Id<"catalogItems">; itemKey?: string },
): Promise<{ item: Doc<"catalogItems">; department: Doc<"departments"> }> {
  if ((ref.itemId === undefined) === (ref.itemKey === undefined)) {
    fail("INVALID", "Pass exactly one of itemId or itemKey");
  }
  let item: Doc<"catalogItems"> | null = null;
  if (ref.itemId !== undefined) {
    item = await ctx.db.get("catalogItems", ref.itemId);
  } else if (ref.itemKey !== undefined) {
    const key = ref.itemKey;
    item = await ctx.db
      .query("catalogItems")
      .withIndex("by_hotelId_and_key", (q) => q.eq("hotelId", hotelId).eq("key", key))
      .first();
  }
  if (
    item === null ||
    item.hotelId !== hotelId ||
    item.archived ||
    !item.visible ||
    (item.kind !== "request" && item.kind !== "offer") ||
    item.departmentId === undefined
  ) {
    fail("NOT_FOUND", "This service is not available");
  }
  const department = await ctx.db.get("departments", item.departmentId);
  if (department === null || department.hotelId !== hotelId || department.archived) {
    fail("NOT_FOUND", "This service is not available");
  }
  return { item, department };
}

function clampQuantity(item: Doc<"catalogItems">, requested: number | undefined): number {
  if (!item.allowQuantity) return 1;
  const max = item.maxQuantity ?? DEFAULT_MAX_QUANTITY;
  const q = requested ?? 1;
  return Number.isFinite(q) ? Math.min(Math.max(Math.round(q), 1), max) : 1;
}

/** Shared guards: max open requests per stay and the per-stay rate limit. */
async function guardStay(ctx: MutationCtx, stayId: Id<"stays">) {
  if ((await openTaskCountForStay(ctx, stayId)) >= MAX_OPEN_PER_STAY) {
    fail("TOO_MANY_OPEN", "You have many open requests. Please wait for them to finish.");
  }
  const limit = await rateLimiter.limit(ctx, "guestRequest", { key: stayId });
  if (!limit.ok) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many requests, please try again later",
      retryAfter: limit.retryAfter,
    });
  }
}

function formatGel(n: number): string {
  return `${Math.round(n * 100) / 100}₾`;
}

export const create = mutation({
  args: {
    token: v.string(),
    key: v.optional(v.string()),
    itemId: v.optional(v.id("catalogItems")), // preferred
    itemKey: v.optional(v.string()),
    quantity: v.optional(v.number()),
    note: v.optional(v.string()),
    detail: v.optional(v.string()), // e.g. "at 16:00" for bookings
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const { hotel, room, stay } = await requireStay(ctx, args.token, args.key);
    const { item, department } = await requestableItem(ctx, hotel._id, args);
    const quantity = item.allowQuantity ? clampQuantity(item, args.quantity) : undefined;
    const guestNote = item.allowNote ? cleanOptionalText(args.note, "Note", 300) : undefined;
    const detail = cleanOptionalText(args.detail, "Detail", 200);
    await guardStay(ctx, stay._id);

    const taskId = await insertTask(ctx, {
      hotel,
      department,
      item,
      room,
      stay,
      title: item.title,
      detail,
      quantity,
      guestNote,
      source: "guest",
      priority: "normal",
    });
    await ctx.db.insert("guestEvents", {
      hotelId: hotel._id,
      stayId: stay._id,
      roomId: room._id,
      kind: "request",
      target: item.key,
    });
    return taskId;
  },
});

/**
 * Multi-item order (e.g. in-room dining) as ONE task for the department of
 * the first line's item. All lines must be in the same catalog section.
 */
export const createOrder = mutation({
  args: {
    token: v.string(),
    key: v.optional(v.string()),
    lines: v.array(
      v.object({
        itemId: v.optional(v.id("catalogItems")), // preferred
        itemKey: v.optional(v.string()),
        quantity: v.number(),
      }),
    ),
    note: v.optional(v.string()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const { hotel, room, stay } = await requireStay(ctx, args.token, args.key);
    if (args.lines.length < 1 || args.lines.length > 20) {
      fail("INVALID", "An order has 1 to 20 lines");
    }
    // Merge duplicate items, keep first-seen order.
    const merged = new Map<Id<"catalogItems">, { item: Doc<"catalogItems">; quantity: number }>();
    let department: Doc<"departments"> | null = null;
    let section: string | null = null;
    for (const line of args.lines) {
      const r = await requestableItem(ctx, hotel._id, line);
      if (department === null) {
        department = r.department;
        section = r.item.section;
      } else if (r.item.section !== section) {
        fail("INVALID", "All items of an order must come from the same section");
      }
      const prev = merged.get(r.item._id);
      const quantity = clampQuantity(r.item, (prev?.quantity ?? 0) + line.quantity);
      merged.set(r.item._id, { item: r.item, quantity });
    }
    if (department === null) fail("INVALID", "Empty order");
    const lines = [...merged.values()];
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const priced = lines.filter((l) => l.item.price !== undefined);
    const total = priced.reduce((sum, l) => sum + (l.item.price ?? 0) * l.quantity, 0);
    const list = lines.map((l) => `${l.item.guestTitle} ×${l.quantity}`).join(", ");
    const detail = priced.length > 0 ? `${list} · total ${formatGel(total)}` : list;
    const steps = lines[0].item.steps.slice(0, MAX_STEPS).map((text) => ({ text }));
    await guardStay(ctx, stay._id);

    const taskId = await insertTask(ctx, {
      hotel,
      department,
      item: null,
      room,
      stay,
      title: `Order: ${count} ${count === 1 ? "item" : "items"}`,
      detail: detail.slice(0, 1000),
      quantity: count,
      guestNote: cleanOptionalText(args.note, "Note", 300),
      source: "guest",
      priority: "normal",
      steps,
      price: priced.length > 0 ? total : undefined,
      statItemKeys: lines.map((l) => itemStatKey(l.item)),
    });
    await ctx.db.insert("guestEvents", {
      hotelId: hotel._id,
      stayId: stay._id,
      roomId: room._id,
      kind: "request",
      target: "order",
    });
    return taskId;
  },
});

/** The current stay's requests, newest first. Empty without an active stay. */
export const list = query({
  args: { token: v.string(), key: v.optional(v.string()) },
  returns: v.array(
    v.object({
      id: v.id("tasks"),
      title: v.string(),
      detail: v.optional(v.string()),
      quantity: v.optional(v.number()),
      status: taskStatusValidator,
      departmentName: v.string(),
      createdAt: v.number(),
      acceptedAt: v.optional(v.number()),
      doneAt: v.optional(v.number()),
      rating: v.optional(v.number()),
      price: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, { token, key }) => {
    const g = await guestContext(ctx, token);
    if (g === null || g.stay === null) return [];
    if (stayNeedsKey(g.hotel, g.stay) && key !== g.stay.guestKey) return [];
    const stayId = g.stay._id;
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_stayId", (q) => q.eq("stayId", stayId))
      .order("desc")
      .take(30);
    const out = [];
    for (const t of tasks) {
      const item = t.itemId ? await ctx.db.get("catalogItems", t.itemId) : null;
      const dept = await ctx.db.get("departments", t.departmentId);
      out.push({
        id: t._id,
        title: item?.guestTitle ?? t.title,
        detail: t.detail,
        quantity: t.quantity,
        status: t.status,
        departmentName: dept?.name ?? "",
        createdAt: t._creationTime,
        acceptedAt: t.acceptedAt,
        doneAt: t.doneAt,
        rating: t.rating,
        price: t.price,
      });
    }
    return out;
  },
});

export const rate = mutation({
  args: { token: v.string(), key: v.optional(v.string()), taskId: v.id("tasks"), rating: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { hotel, room, stay } = await requireStay(ctx, args.token, args.key);
    if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
      fail("INVALID", "Rating must be 1-5");
    }
    const task = await ctx.db.get("tasks", args.taskId);
    if (task === null || task.stayId !== stay._id) fail("NOT_FOUND", "Request not found");
    if (task.status !== "done") fail("CONFLICT", "You can rate a request once it is done");
    if (task.rating === args.rating) return null; // idempotent retry
    const limit = await rateLimiter.limit(ctx, "guestAction", { key: stay._id });
    if (!limit.ok) fail("RATE_LIMITED", "Too many actions, please try again later");
    await ctx.db.patch("tasks", task._id, { rating: args.rating });
    await ctx.db.insert("guestEvents", {
      hotelId: hotel._id,
      stayId: stay._id,
      roomId: room._id,
      kind: "rate",
      target: String(args.rating),
    });
    return null;
  },
});

export const cancel = mutation({
  args: { token: v.string(), key: v.optional(v.string()), taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { stay } = await requireStay(ctx, args.token, args.key);
    const limit = await rateLimiter.limit(ctx, "guestAction", { key: stay._id });
    if (!limit.ok) fail("RATE_LIMITED", "Too many actions, please try again later");
    const task = await ctx.db.get("tasks", args.taskId);
    if (task === null || task.stayId !== stay._id) fail("NOT_FOUND", "Request not found");
    if (task.status === "cancelled") return null; // idempotent
    if (task.status !== "open") fail("CONFLICT", "Staff already accepted this request");
    await ctx.db.patch("tasks", task._id, { status: "cancelled", cancelledAt: Date.now() });
    return null;
  },
});
