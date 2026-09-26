import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const MAX_PENDING_PER_EMAIL = 20;

/**
 * Add a membership from an invitation. Existing memberships are left alone:
 * role changes go through members.update, which protects the supervisor and
 * the last manager.
 */
export async function grantMembership(
  ctx: MutationCtx,
  hotelId: Id<"hotels">,
  userId: Id<"users">,
  role: Doc<"memberships">["role"],
  departmentIds: Id<"departments">[],
): Promise<"created" | "exists"> {
  const existing = await ctx.db
    .query("memberships")
    .withIndex("by_hotelId_and_userId", (q) => q.eq("hotelId", hotelId).eq("userId", userId))
    .unique();
  if (existing !== null) return "exists";
  await ctx.db.insert("memberships", {
    hotelId,
    userId,
    role,
    onShift: false,
    completedTaskCount: 0,
    departmentIds,
  });
  return "created";
}

/** Turn every pending invitation for this user's verified email into a membership. */
export async function acceptPendingInvitations(ctx: MutationCtx, user: Doc<"users">) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return;
  const pending = await ctx.db
    .query("invitations")
    .withIndex("by_email_and_status", (q) => q.eq("email", email).eq("status", "pending"))
    .take(MAX_PENDING_PER_EMAIL);
  for (const invitation of pending) {
    const hotel = await ctx.db.get("hotels", invitation.hotelId);
    if (hotel === null) continue;
    await grantMembership(ctx, invitation.hotelId, user._id, invitation.role, invitation.departmentIds);
    await ctx.db.patch("invitations", invitation._id, { status: "accepted", acceptedByUserId: user._id });
  }
}
