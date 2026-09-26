import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/** Scheduled at task creation; escalates if nobody accepted the task in time. */
export const checkTask = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null || task.status !== "open" || task.escalatedAt !== undefined) return null;
    await ctx.db.patch("tasks", taskId, { escalatedAt: Date.now(), priority: "high" });
    await ctx.scheduler.runAfter(0, internal.push.notifyEscalation, { taskId });
    return null;
  },
});
