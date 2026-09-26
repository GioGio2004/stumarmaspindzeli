import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { fail, getMember, requireMember, requireRole } from "./lib/access";
import { isSupervisor } from "./lib/supervisor";
import { roleValidator } from "./schema";

const memberValidator = v.object({
  membershipId: v.id("memberships"),
  userId: v.id("users"),
  name: v.string(),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  role: roleValidator,
  onShift: v.boolean(),
  departmentIds: v.array(v.id("departments")),
  completedTaskCount: v.number(),
});

function toMember(m: Doc<"memberships">, user: Doc<"users">) {
  return {
    membershipId: m._id,
    userId: user._id,
    name: user.name,
    email: user.email,
    imageUrl: user.imageUrl,
    role: m.role,
    onShift: m.onShift,
    departmentIds: m.departmentIds ?? [],
    completedTaskCount: m.completedTaskCount,
  };
}

export const list = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(memberValidator),
  handler: async (ctx, { hotelId }) => {
    await requireRole(ctx, hotelId, ["manager", "reception"]);
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .take(200);
    const out = [];
    for (const m of rows) {
      const user = await ctx.db.get("users", m.userId);
      if (user) out.push(toMember(m, user));
    }
    return out;
  },
});

/** The caller's own membership in the hotel. */
export const me = query({
  args: { hotelId: v.id("hotels") },
  returns: v.union(memberValidator, v.null()),
  handler: async (ctx, { hotelId }) => {
    const member = await getMember(ctx, hotelId);
    return member === null ? null : toMember(member.membership, member.user);
  },
});

/** Other managers can't demote or remove the platform supervisor. */
async function assertNotSupervisor(ctx: MutationCtx, target: Doc<"memberships">) {
  const user = await ctx.db.get("users", target.userId);
  if (user !== null && isSupervisor(user)) fail("FORBIDDEN", "The supervisor's access can't be changed");
}

/** A hotel must keep one real manager besides the platform supervisor. */
async function assertNotLastManager(ctx: MutationCtx, target: Doc<"memberships">) {
  if (target.role !== "manager") return;
  const managers = await ctx.db
    .query("memberships")
    .withIndex("by_hotelId_and_role", (q) => q.eq("hotelId", target.hotelId).eq("role", "manager"))
    .take(50);
  let others = 0;
  for (const m of managers) {
    if (m._id === target._id) continue;
    const user = await ctx.db.get("users", m.userId);
    if (user !== null && !isSupervisor(user)) others++;
  }
  if (others === 0) fail("LAST_MANAGER", "A hotel needs at least one manager");
}

/** Hand the person's unfinished tasks in this hotel back to their teams. */
async function releaseTasks(ctx: MutationCtx, target: Doc<"memberships">) {
  for (const status of ["accepted", "in_progress"] as const) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeUserId_and_status", (q) => q.eq("assigneeUserId", target.userId).eq("status", status))
      .take(200);
    for (const t of tasks) {
      if (t.hotelId !== target.hotelId) continue;
      await ctx.db.patch("tasks", t._id, { status: "open", assigneeUserId: undefined, acceptedAt: undefined, startedAt: undefined });
    }
  }
}

async function cleanDepartmentIds(
  ctx: MutationCtx,
  hotelId: Id<"hotels">,
  ids: Id<"departments">[],
): Promise<Id<"departments">[]> {
  const unique = [...new Set(ids)];
  if (unique.length > 12) fail("INVALID", "At most 12 departments per member");
  for (const id of unique) {
    const d = await ctx.db.get("departments", id);
    if (d === null || d.hotelId !== hotelId) fail("NOT_FOUND", "Department not found");
  }
  return unique;
}

export const update = mutation({
  args: {
    membershipId: v.id("memberships"),
    role: v.optional(roleValidator),
    departmentIds: v.optional(v.array(v.id("departments"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get("memberships", args.membershipId);
    if (target === null) fail("NOT_FOUND", "Member not found");
    await requireRole(ctx, target.hotelId, ["manager"]);
    const patch: Partial<Doc<"memberships">> = {};
    if (args.role !== undefined && args.role !== target.role) {
      await assertNotSupervisor(ctx, target);
      await assertNotLastManager(ctx, target);
      patch.role = args.role;
    }
    if (args.departmentIds !== undefined) {
      patch.departmentIds = await cleanDepartmentIds(ctx, target.hotelId, args.departmentIds);
    }
    await ctx.db.patch("memberships", target._id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { membershipId: v.id("memberships") },
  returns: v.null(),
  handler: async (ctx, { membershipId }) => {
    const target = await ctx.db.get("memberships", membershipId);
    if (target === null) return null;
    await requireRole(ctx, target.hotelId, ["manager"]);
    await assertNotSupervisor(ctx, target);
    await assertNotLastManager(ctx, target);
    await releaseTasks(ctx, target);
    await ctx.db.delete("memberships", membershipId);
    return null;
  },
});

export const setOnShift = mutation({
  args: { hotelId: v.id("hotels"), onShift: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { hotelId, onShift }) => {
    const { membership } = await requireMember(ctx, hotelId);
    await ctx.db.patch("memberships", membership._id, { onShift });
    return null;
  },
});

// ---- internal ---------------------------------------------------------------

/** Throws unless the caller manages the hotel. Used by actions. */
export const assertManager = internalQuery({
  args: { hotelId: v.id("hotels") },
  returns: v.null(),
  handler: async (ctx, { hotelId }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    return null;
  },
});

/** Throws unless the caller is a member of the hotel. Used by actions. */
export const assertMember = internalQuery({
  args: { hotelId: v.id("hotels") },
  returns: v.null(),
  handler: async (ctx, { hotelId }) => {
    await requireMember(ctx, hotelId);
    return null;
  },
});
