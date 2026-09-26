import type { Doc } from "../_generated/dataModel";
import { env, type MutationCtx } from "../_generated/server";

/**
 * The platform supervisor (the product owner) is configured by Clerk user id
 * in SUPERVISOR_CLERK_IDS. Supervisors hold a real manager membership in every
 * hotel, so all normal access checks apply unchanged.
 */
export function isSupervisor(user: Pick<Doc<"users">, "externalId">): boolean {
  const ids = (env.SUPERVISOR_CLERK_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(user.externalId);
}

const MAX_HOTELS = 200;

/** Give a supervisor a manager membership in every hotel they are missing from. */
export async function ensureSupervisorMemberships(ctx: MutationCtx, user: Doc<"users">) {
  if (!isSupervisor(user)) return;
  const hotels = await ctx.db.query("hotels").take(MAX_HOTELS);
  for (const hotel of hotels) {
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_hotelId_and_userId", (q) => q.eq("hotelId", hotel._id).eq("userId", user._id))
      .unique();
    if (existing === null) {
      await ctx.db.insert("memberships", {
        hotelId: hotel._id,
        userId: user._id,
        role: "manager",
        onShift: false,
        completedTaskCount: 0,
        departmentIds: [],
      });
    } else if (existing.role !== "manager") {
      await ctx.db.patch("memberships", existing._id, { role: "manager" });
    }
  }
}
