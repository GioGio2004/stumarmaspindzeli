import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { checkInt, checkNumber, cleanText, fail, requireMember, requireRole } from "./lib/access";
import { OPEN_STATUSES } from "./lib/tasks";
import schema from "./schema";

const ICON_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

function cleanIcon(icon: string): string {
  const s = icon.trim();
  if (!ICON_RE.test(s)) fail("INVALID", "Icon must be a short lowercase key");
  return s;
}

/** Non-archived departments, sorted, with a bounded open task count. */
export const list = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(schema.doc("departments").extend({ openTaskCount: v.number() })),
  handler: async (ctx, { hotelId }) => {
    await requireMember(ctx, hotelId);
    const rows = await ctx.db
      .query("departments")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .take(100);
    const active = rows.filter((d) => !d.archived).sort((a, b) => a.sortOrder - b.sortOrder);
    const out = [];
    for (const d of active) {
      let openTaskCount = 0;
      for (const status of OPEN_STATUSES) {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_departmentId_and_status_and_doneAt", (q) =>
            q.eq("departmentId", d._id).eq("status", status),
          )
          .take(100);
        openTaskCount += tasks.length;
      }
      out.push({ ...d, openTaskCount });
    }
    return out;
  },
});

export const create = mutation({
  args: {
    hotelId: v.id("hotels"),
    name: v.string(),
    icon: v.string(),
    escalationMinutes: v.number(),
  },
  returns: v.id("departments"),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.hotelId, ["manager"]);
    const existing = await ctx.db
      .query("departments")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", args.hotelId))
      .take(100);
    if (existing.filter((d) => !d.archived).length >= 30) fail("LIMIT", "At most 30 departments");
    const sortOrder = existing.reduce((m, d) => Math.max(m, d.sortOrder + 1), 0);
    return await ctx.db.insert("departments", {
      hotelId: args.hotelId,
      name: cleanText(args.name, "Name", 60),
      icon: cleanIcon(args.icon),
      escalationMinutes: checkInt(args.escalationMinutes, "Escalation minutes", 1, 1440),
      sortOrder,
      archived: false,
    });
  },
});

export const update = mutation({
  args: {
    departmentId: v.id("departments"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    escalationMinutes: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dept = await ctx.db.get("departments", args.departmentId);
    if (dept === null) fail("NOT_FOUND", "Department not found");
    await requireRole(ctx, dept.hotelId, ["manager"]);
    const patch: Partial<Doc<"departments">> = {};
    if (args.name !== undefined) patch.name = cleanText(args.name, "Name", 60);
    if (args.icon !== undefined) patch.icon = cleanIcon(args.icon);
    if (args.escalationMinutes !== undefined)
      patch.escalationMinutes = checkInt(args.escalationMinutes, "Escalation minutes", 1, 1440);
    if (args.sortOrder !== undefined)
      patch.sortOrder = checkNumber(args.sortOrder, "Sort order", -1e6, 1e6);
    await ctx.db.patch("departments", dept._id, patch);
    return null;
  },
});

export const archive = mutation({
  args: { departmentId: v.id("departments") },
  returns: v.null(),
  handler: async (ctx, { departmentId }) => {
    const dept = await ctx.db.get("departments", departmentId);
    if (dept === null) fail("NOT_FOUND", "Department not found");
    await requireRole(ctx, dept.hotelId, ["manager"]);
    await ctx.db.patch("departments", departmentId, { archived: true });
    return null;
  },
});
