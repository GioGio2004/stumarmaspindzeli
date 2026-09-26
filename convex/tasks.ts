import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  canSeeDepartment,
  canWorkDepartment,
  checkInt,
  cleanOptionalText,
  cleanText,
  fail,
  getMember,
  memberOrSignedOut,
  requireDepartment,
  requireMember,
  requireRole,
  type Member,
} from "./lib/access";
import { recordStats } from "./lib/stats";
import {
  insertTask,
  makeEnricher,
  OPEN_STATUSES,
  scheduleEscalation,
  taskSummaryValidator,
  type OpenStatus,
} from "./lib/tasks";
import { taskPriorityValidator } from "./schema";

const BOARD_LIMIT = 100;
const DONE_LIMIT = 50;

// ---- helpers ------------------------------------------------------------------

/** Department ids the member may see on the board; null = all of the hotel. */
function visibleDepartments(membership: Doc<"memberships">): Id<"departments">[] | null {
  if (membership.role !== "staff") return null;
  return membership.departmentIds ?? [];
}

async function tasksByStatus(
  ctx: QueryCtx,
  hotelId: Id<"hotels">,
  departments: Id<"departments">[] | null,
  status: OpenStatus,
  limit: number,
): Promise<Doc<"tasks">[]> {
  if (departments === null) {
    return await ctx.db
      .query("tasks")
      .withIndex("by_hotelId_and_status_and_doneAt", (q) =>
        q.eq("hotelId", hotelId).eq("status", status),
      )
      .take(limit);
  }
  const out: Doc<"tasks">[] = [];
  for (const departmentId of departments) {
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_departmentId_and_status_and_doneAt", (q) =>
        q.eq("departmentId", departmentId).eq("status", status),
      )
      .take(limit);
    out.push(...rows.filter((t) => t.hotelId === hotelId));
  }
  return out;
}

async function doneSince(
  ctx: QueryCtx,
  hotelId: Id<"hotels">,
  departments: Id<"departments">[] | null,
  since: number,
): Promise<Doc<"tasks">[]> {
  if (departments === null) {
    return await ctx.db
      .query("tasks")
      .withIndex("by_hotelId_and_status_and_doneAt", (q) =>
        q.eq("hotelId", hotelId).eq("status", "done").gte("doneAt", since),
      )
      .order("desc")
      .take(DONE_LIMIT);
  }
  const out: Doc<"tasks">[] = [];
  for (const departmentId of departments) {
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_departmentId_and_status_and_doneAt", (q) =>
        q.eq("departmentId", departmentId).eq("status", "done").gte("doneAt", since),
      )
      .order("desc")
      .take(DONE_LIMIT);
    out.push(...rows.filter((t) => t.hotelId === hotelId));
  }
  return out;
}

const byPriorityThenOldest = (a: Doc<"tasks">, b: Doc<"tasks">) =>
  (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1) ||
  a._creationTime - b._creationTime;

async function loadTask(ctx: MutationCtx, taskId: Id<"tasks">) {
  const task = await ctx.db.get("tasks", taskId);
  if (task === null) fail("NOT_FOUND", "Task not found");
  const member = await requireMember(ctx, task.hotelId);
  return { task, ...member };
}

function isAssigneeOrManager(task: Doc<"tasks">, member: Member): boolean {
  return member.membership.role === "manager" || task.assigneeUserId === member.user._id;
}

async function hotelOf(ctx: MutationCtx, hotelId: Id<"hotels">) {
  const hotel = await ctx.db.get("hotels", hotelId);
  if (hotel === null) fail("NOT_FOUND", "Hotel not found");
  return hotel;
}

// ---- queries ------------------------------------------------------------------

export const board = query({
  args: {
    hotelId: v.id("hotels"),
    departmentId: v.optional(v.id("departments")),
    doneSince: v.number(),
  },
  returns: v.object({
    open: v.array(taskSummaryValidator),
    accepted: v.array(taskSummaryValidator),
    in_progress: v.array(taskSummaryValidator),
    done: v.array(taskSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const member = await memberOrSignedOut(ctx, args.hotelId);
    if (member === null) return { open: [], accepted: [], in_progress: [], done: [] };
    const { membership } = member;
    let departments = visibleDepartments(membership);
    if (args.departmentId !== undefined) {
      if (!canSeeDepartment(membership, args.departmentId)) {
        fail("FORBIDDEN", "Not your department");
      }
      departments = [args.departmentId];
    }
    const enrich = makeEnricher(ctx);
    const open = (await tasksByStatus(ctx, args.hotelId, departments, "open", BOARD_LIMIT))
      .sort(byPriorityThenOldest)
      .slice(0, BOARD_LIMIT);
    const accepted = (
      await tasksByStatus(ctx, args.hotelId, departments, "accepted", BOARD_LIMIT)
    )
      .sort(byPriorityThenOldest)
      .slice(0, BOARD_LIMIT);
    const inProgress = (
      await tasksByStatus(ctx, args.hotelId, departments, "in_progress", BOARD_LIMIT)
    )
      .sort(byPriorityThenOldest)
      .slice(0, BOARD_LIMIT);
    const done = (await doneSince(ctx, args.hotelId, departments, args.doneSince))
      .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
      .slice(0, DONE_LIMIT);
    return {
      open: await Promise.all(open.map(enrich)),
      accepted: await Promise.all(accepted.map(enrich)),
      in_progress: await Promise.all(inProgress.map(enrich)),
      done: await Promise.all(done.map(enrich)),
    };
  },
});

/** Not-done tasks in my departments plus tasks assigned to me, newest first. */
export const myQueue = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(taskSummaryValidator),
  handler: async (ctx, { hotelId }) => {
    const member = await memberOrSignedOut(ctx, hotelId);
    if (member === null) return [];
    const { user, membership } = member;
    const byId = new Map<Id<"tasks">, Doc<"tasks">>();
    const depts = membership.departmentIds ?? [];
    for (const status of OPEN_STATUSES) {
      for (const t of await tasksByStatus(ctx, hotelId, depts, status, BOARD_LIMIT)) {
        byId.set(t._id, t);
      }
    }
    for (const status of ["accepted", "in_progress"] as const) {
      const mine = await ctx.db
        .query("tasks")
        .withIndex("by_assigneeUserId_and_status", (q) =>
          q.eq("assigneeUserId", user._id).eq("status", status),
        )
        .take(BOARD_LIMIT);
      for (const t of mine) if (t.hotelId === hotelId) byId.set(t._id, t);
    }
    const enrich = makeEnricher(ctx);
    const rows = [...byId.values()]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, BOARD_LIMIT);
    return await Promise.all(rows.map(enrich));
  },
});

export const get = query({
  // A string, not v.id, so an old or mistyped link returns null instead of throwing.
  args: { taskId: v.string() },
  returns: v.union(
    taskSummaryValidator.extend({
      stay: v.union(
        v.object({
          stayId: v.id("stays"),
          status: v.union(v.literal("active"), v.literal("checked_out")),
          guestLabel: v.optional(v.string()),
          language: v.optional(v.string()),
          expectedCheckOutAt: v.number(),
        }),
        v.null(),
      ),
      estimatedMinutes: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, { taskId: raw }) => {
    const taskId = ctx.db.normalizeId("tasks", raw);
    if (taskId === null) return null;
    const task = await ctx.db.get("tasks", taskId);
    if (task === null) return null;
    const member = await getMember(ctx, task.hotelId);
    if (member === null) return null;
    const { user, membership } = member;
    if (!canSeeDepartment(membership, task.departmentId) && task.assigneeUserId !== user._id) {
      return null;
    }
    const summary = await makeEnricher(ctx)(task);
    const stay = task.stayId ? await ctx.db.get("stays", task.stayId) : null;
    const item = task.itemId ? await ctx.db.get("catalogItems", task.itemId) : null;
    return {
      ...summary,
      stay: stay
        ? {
            stayId: stay._id,
            status: stay.status,
            guestLabel: stay.guestLabel,
            language: stay.language,
            expectedCheckOutAt: stay.expectedCheckOutAt,
          }
        : null,
      estimatedMinutes: item?.estimatedMinutes,
    };
  },
});

// ---- mutations ----------------------------------------------------------------

export const create = mutation({
  args: {
    hotelId: v.id("hotels"),
    // Optional when itemId is given: defaults to the item's department.
    departmentId: v.optional(v.id("departments")),
    // Optional when itemId is given: defaults to the item's staff title.
    title: v.optional(v.string()),
    detail: v.optional(v.string()),
    roomId: v.optional(v.id("rooms")),
    itemId: v.optional(v.id("catalogItems")),
    priority: v.optional(taskPriorityValidator),
    quantity: v.optional(v.number()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const { user, membership } = await requireMember(ctx, args.hotelId);
    const hotel = await hotelOf(ctx, args.hotelId);
    let item: Doc<"catalogItems"> | null = null;
    if (args.itemId !== undefined) {
      item = await ctx.db.get("catalogItems", args.itemId);
      if (item === null || item.hotelId !== args.hotelId || item.archived) {
        fail("NOT_FOUND", "Item not found");
      }
    }
    const departmentId = args.departmentId ?? item?.departmentId;
    if (departmentId === undefined) fail("INVALID", "Choose a department");
    const department = await requireDepartment(ctx, args.hotelId, departmentId);
    const title = args.title ?? item?.title;
    if (title === undefined) fail("INVALID", "Title is required");
    let room: Doc<"rooms"> | null = null;
    let stay: Doc<"stays"> | null = null;
    if (args.roomId !== undefined) {
      room = await ctx.db.get("rooms", args.roomId);
      if (room === null || room.hotelId !== args.hotelId) fail("NOT_FOUND", "Room not found");
      if (room.currentStayId) {
        const s = await ctx.db.get("stays", room.currentStayId);
        if (s && s.status === "active") stay = s;
      }
    }
    return await insertTask(ctx, {
      hotel,
      department,
      item,
      room,
      stay,
      title: cleanText(title, "Title", 120),
      detail: cleanOptionalText(args.detail, "Detail", 500),
      quantity: args.quantity !== undefined ? checkInt(args.quantity, "Quantity", 1, 99) : undefined,
      source: membership.role === "manager" ? "manager" : "staff",
      priority: args.priority ?? "normal",
      createdByUserId: user._id,
    });
  },
});

export const accept = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const { task, user, membership } = await loadTask(ctx, taskId);
    if (task.status !== "open") fail("CONFLICT", "Task was already taken");
    if (!canWorkDepartment(membership, task.departmentId)) {
      fail("FORBIDDEN", "Not your department");
    }
    const now = Date.now();
    await ctx.db.patch("tasks", taskId, {
      status: "accepted",
      assigneeUserId: user._id,
      acceptedAt: now,
      firstAcceptedAt: task.firstAcceptedAt ?? now,
    });
    if (task.firstAcceptedAt === undefined && task.source === "guest") {
      const hotel = await hotelOf(ctx, task.hotelId);
      await recordStats(ctx, hotel, now, {
        responseMs: now - task._creationTime,
        departmentId: task.departmentId,
      });
    }
    return null;
  },
});

export const start = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const { task, ...member } = await loadTask(ctx, taskId);
    if (!isAssigneeOrManager(task, member)) fail("FORBIDDEN", "Only the assignee can start");
    if (task.status === "in_progress") return null;
    if (task.status !== "accepted") fail("CONFLICT", "Accept the task first");
    await ctx.db.patch("tasks", taskId, { status: "in_progress", startedAt: Date.now() });
    return null;
  },
});

/** Tick / untick a playbook step. The first tick moves accepted -> in_progress. */
export const toggleStep = mutation({
  args: { taskId: v.id("tasks"), index: v.number() },
  returns: v.null(),
  handler: async (ctx, { taskId, index }) => {
    const { task, ...member } = await loadTask(ctx, taskId);
    if (!isAssigneeOrManager(task, member)) fail("FORBIDDEN", "Only the assignee can tick steps");
    if (task.status !== "accepted" && task.status !== "in_progress") {
      fail("CONFLICT", "Task is not in progress");
    }
    checkInt(index, "Step index", 0, task.steps.length - 1);
    const now = Date.now();
    const steps = task.steps.map((s, i) => {
      if (i !== index) return s;
      if (s.doneAt !== undefined) return { text: s.text };
      return { text: s.text, doneAt: now, doneByUserId: member.user._id };
    });
    const patch: Partial<Doc<"tasks">> = { steps };
    if (task.status === "accepted" && steps[index].doneAt !== undefined) {
      patch.status = "in_progress";
      patch.startedAt = now;
    }
    await ctx.db.patch("tasks", taskId, patch);
    return null;
  },
});

export const complete = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const { task, ...member } = await loadTask(ctx, taskId);
    if (task.status === "done") return null; // idempotent
    if (task.status === "cancelled") fail("CONFLICT", "Task was cancelled");
    const now = Date.now();
    const hotel = await hotelOf(ctx, task.hotelId);
    const patch: Partial<Doc<"tasks">> = { status: "done", doneAt: now };
    if (task.status === "open") {
      // Finishing an unclaimed task claims it for the caller.
      if (!canWorkDepartment(member.membership, task.departmentId)) {
        fail("FORBIDDEN", "Not your department");
      }
      patch.assigneeUserId = member.user._id;
      patch.acceptedAt = now;
      patch.firstAcceptedAt = task.firstAcceptedAt ?? now;
      if (task.firstAcceptedAt === undefined && task.source === "guest") {
        await recordStats(ctx, hotel, now, {
          responseMs: now - task._creationTime,
          departmentId: task.departmentId,
        });
      }
    } else if (!isAssigneeOrManager(task, member)) {
      fail("FORBIDDEN", "Only the assignee can complete");
    }
    await ctx.db.patch("tasks", taskId, patch);
    if (task.source === "guest") {
      await recordStats(ctx, hotel, now, { done: 1, completionMs: now - task._creationTime });
    }

    const assigneeId = patch.assigneeUserId ?? task.assigneeUserId;
    if (assigneeId) {
      const m = await ctx.db
        .query("memberships")
        .withIndex("by_hotelId_and_userId", (q) =>
          q.eq("hotelId", task.hotelId).eq("userId", assigneeId),
        )
        .unique();
      if (m) {
        await ctx.db.patch("memberships", m._id, { completedTaskCount: m.completedTaskCount + 1 });
      }
    }
    return null;
  },
});

/** Give the task back to the department queue. */
export const release = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const { task, ...member } = await loadTask(ctx, taskId);
    if (task.status === "open") return null;
    if (task.status !== "accepted" && task.status !== "in_progress") {
      fail("CONFLICT", "Task is already finished");
    }
    if (!isAssigneeOrManager(task, member)) fail("FORBIDDEN", "Only the assignee can release");
    await ctx.db.patch("tasks", taskId, {
      status: "open",
      assigneeUserId: undefined,
      acceptedAt: undefined,
      startedAt: undefined,
    });
    if (task.escalatedAt === undefined) {
      const dept = await ctx.db.get("departments", task.departmentId);
      if (dept) await scheduleEscalation(ctx, taskId, dept);
    }
    return null;
  },
});

export const cancel = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null) fail("NOT_FOUND", "Task not found");
    await requireRole(ctx, task.hotelId, ["manager", "reception"]);
    if (task.status === "cancelled") return null;
    if (task.status === "done") fail("CONFLICT", "Task is already done");
    await ctx.db.patch("tasks", taskId, { status: "cancelled", cancelledAt: Date.now() });
    return null;
  },
});

export const assign = mutation({
  args: { taskId: v.id("tasks"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { taskId, userId }) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null) fail("NOT_FOUND", "Task not found");
    await requireRole(ctx, task.hotelId, ["manager", "reception"]);
    if (task.status === "done" || task.status === "cancelled") {
      fail("CONFLICT", "Task is already finished");
    }
    const target = await ctx.db
      .query("memberships")
      .withIndex("by_hotelId_and_userId", (q) => q.eq("hotelId", task.hotelId).eq("userId", userId))
      .unique();
    if (target === null) fail("NOT_FOUND", "That person is not a member of this hotel");
    const now = Date.now();
    if (task.status === "open") {
      await ctx.db.patch("tasks", taskId, {
        status: "accepted",
        assigneeUserId: userId,
        acceptedAt: now,
        firstAcceptedAt: task.firstAcceptedAt ?? now,
      });
      if (task.firstAcceptedAt === undefined && task.source === "guest") {
        const hotel = await hotelOf(ctx, task.hotelId);
        await recordStats(ctx, hotel, now, {
          responseMs: now - task._creationTime,
          departmentId: task.departmentId,
        });
      }
    } else {
      await ctx.db.patch("tasks", taskId, { assigneeUserId: userId });
    }
    return null;
  },
});
