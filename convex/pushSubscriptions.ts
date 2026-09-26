import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./users";

/** Called by the staff PWA after `pushManager.subscribe()`. */
export const subscribe = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!args.endpoint.startsWith("https://") || args.endpoint.length > 1000) {
      throw new Error("Invalid push endpoint");
    }
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing) {
      // The same browser endpoint now belongs to whoever signed in on it.
      await ctx.db.patch("pushSubscriptions", existing._id, { ...args, userId: user._id });
    } else {
      await ctx.db.insert("pushSubscriptions", { ...args, userId: user._id });
    }
    return null;
  },
});

/** Remove this device's subscription. Only the owner may delete it. */
export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, { endpoint }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (existing === null) return null;
    if (existing.userId !== user._id) return null; // someone else's device: never delete
    await ctx.db.delete("pushSubscriptions", existing._id);
    return null;
  },
});

/** Does this browser have a stored subscription? (UI toggle state) */
export const isSubscribed = query({
  args: { endpoint: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { endpoint }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    return existing !== null && existing.userId === user._id;
  },
});

// ---- internal, used by push.ts -------------------------------------------

const subValidator = v.object({ endpoint: v.string(), p256dh: v.string(), auth: v.string() });

async function subsFor(ctx: QueryCtx, members: Doc<"memberships">[]) {
  const seen = new Set<Id<"users">>();
  const out: { endpoint: string; p256dh: string; auth: string }[] = [];
  for (const m of members) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", m.userId))
      .take(5);
    for (const s of subs) out.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
  }
  return out;
}

/**
 * Push targets + payload data for a task.
 * mode "task": on-shift members of the task's department (fallback: on-shift managers).
 * mode "escalation": on-shift managers and reception.
 */
export const targetsForTask = internalQuery({
  args: {
    taskId: v.id("tasks"),
    mode: v.union(v.literal("task"), v.literal("escalation")),
  },
  returns: v.union(
    v.object({
      title: v.string(),
      quantity: v.optional(v.number()),
      roomNumber: v.union(v.string(), v.null()),
      guestNote: v.optional(v.string()),
      status: v.string(),
      subs: v.array(subValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, { taskId, mode }) => {
    const task = await ctx.db.get("tasks", taskId);
    if (!task) return null;
    const room = task.roomId ? await ctx.db.get("rooms", task.roomId) : null;
    const onShift = await ctx.db
      .query("memberships")
      .withIndex("by_hotelId_and_onShift", (q) => q.eq("hotelId", task.hotelId).eq("onShift", true))
      .take(200);
    let targets: Doc<"memberships">[];
    if (mode === "task") {
      targets = onShift.filter((m) => (m.departmentIds ?? []).includes(task.departmentId));
      if (targets.length === 0) targets = onShift.filter((m) => m.role === "manager");
    } else {
      targets = onShift.filter((m) => m.role === "manager" || m.role === "reception");
    }
    return {
      title: task.title,
      quantity: task.quantity,
      roomNumber: room?.number ?? null,
      guestNote: task.guestNote,
      status: task.status,
      subs: await subsFor(ctx, targets),
    };
  },
});

export const removeByEndpoint = internalMutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, { endpoint }) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (existing) await ctx.db.delete("pushSubscriptions", existing._id);
    return null;
  },
});
