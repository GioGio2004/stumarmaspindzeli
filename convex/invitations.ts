import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { fail, memberOrSignedOut, requireRole } from "./lib/access";
import { grantMembership } from "./lib/invitations";
import { roleValidator } from "./schema";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const statusValidator = v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked"), v.literal("failed"));

async function cleanDepartments(ctx: MutationCtx, hotelId: Id<"hotels">, ids: Id<"departments">[]) {
  const unique = [...new Set(ids)];
  if (unique.length > 12) fail("INVALID", "At most 12 departments");
  for (const id of unique) {
    const d = await ctx.db.get("departments", id);
    if (d === null || d.hotelId !== hotelId) fail("NOT_FOUND", "Department not found");
  }
  return unique;
}

export const list = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(
    v.object({
      _id: v.id("invitations"),
      _creationTime: v.number(),
      email: v.string(),
      role: roleValidator,
      departmentIds: v.array(v.id("departments")),
      status: statusValidator,
      error: v.optional(v.string()),
      inviteUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { hotelId }) => {
    if ((await memberOrSignedOut(ctx, hotelId, ["manager"])) === null) return [];
    const rows = await ctx.db
      .query("invitations")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .order("desc")
      .take(100);
    return rows.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      email: r.email,
      role: r.role,
      departmentIds: r.departmentIds,
      status: r.status,
      error: r.error,
      inviteUrl: r.status === "pending" ? r.inviteUrl : undefined,
    }));
  },
});

/**
 * Invite someone by email with a role. Existing users get the membership right
 * away; everyone else gets a Clerk invitation email (sign-up is invite-only).
 */
export const create = mutation({
  args: {
    hotelId: v.id("hotels"),
    email: v.string(),
    role: roleValidator,
    departmentIds: v.array(v.id("departments")),
  },
  returns: v.id("invitations"),
  handler: async (ctx, args) => {
    const { user } = await requireRole(ctx, args.hotelId, ["manager"]);
    const email = args.email.trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 200) fail("INVALID", "Enter a valid email address");
    const departmentIds = await cleanDepartments(ctx, args.hotelId, args.departmentIds);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingUser !== null) {
      const result = await grantMembership(ctx, args.hotelId, existingUser._id, args.role, departmentIds);
      if (result === "exists") fail("ALREADY_MEMBER", "This person is already on the team. Change their role in Members.");
      return await ctx.db.insert("invitations", {
        hotelId: args.hotelId,
        email,
        role: args.role,
        departmentIds,
        status: "accepted",
        invitedByUserId: user._id,
        acceptedByUserId: existingUser._id,
      });
    }

    // Replace an older pending invite for the same hotel and email.
    const pending = await ctx.db
      .query("invitations")
      .withIndex("by_email_and_status", (q) => q.eq("email", email).eq("status", "pending"))
      .take(20);
    for (const old of pending) {
      if (old.hotelId === args.hotelId) await ctx.db.patch("invitations", old._id, { status: "revoked" });
    }

    const invitationId = await ctx.db.insert("invitations", {
      hotelId: args.hotelId,
      email,
      role: args.role,
      departmentIds,
      status: "pending",
      invitedByUserId: user._id,
    });
    await ctx.scheduler.runAfter(0, internal.invitations.sendToClerk, { invitationId });
    return invitationId;
  },
});

export const revoke = mutation({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    const invitation = await ctx.db.get("invitations", invitationId);
    if (invitation === null) fail("NOT_FOUND", "Invitation not found");
    await requireRole(ctx, invitation.hotelId, ["manager"]);
    if (invitation.status === "accepted") fail("INVALID", "Already accepted. Remove the member instead.");
    await ctx.db.patch("invitations", invitationId, { status: "revoked" });
    if (invitation.clerkInvitationId) {
      await ctx.scheduler.runAfter(0, internal.invitations.revokeInClerk, {
        clerkInvitationId: invitation.clerkInvitationId,
      });
    }
    return null;
  },
});

export const resend = mutation({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    const invitation = await ctx.db.get("invitations", invitationId);
    if (invitation === null) fail("NOT_FOUND", "Invitation not found");
    await requireRole(ctx, invitation.hotelId, ["manager"]);
    if (invitation.status !== "pending" && invitation.status !== "failed") {
      fail("INVALID", "Only pending or failed invitations can be sent again");
    }
    await ctx.db.patch("invitations", invitationId, { status: "pending", error: undefined });
    await ctx.scheduler.runAfter(0, internal.invitations.sendToClerk, { invitationId });
    return null;
  },
});

// ---- internal: talk to Clerk ------------------------------------------------

export const forSending = internalQuery({
  args: { invitationId: v.id("invitations") },
  returns: v.union(v.object({ email: v.string(), hotelId: v.id("hotels"), role: roleValidator, status: statusValidator }), v.null()),
  handler: async (ctx, { invitationId }) => {
    const inv = await ctx.db.get("invitations", invitationId);
    return inv ? { email: inv.email, hotelId: inv.hotelId, role: inv.role, status: inv.status } : null;
  },
});

export const recordResult = internalMutation({
  args: {
    invitationId: v.id("invitations"),
    clerkInvitationId: v.optional(v.string()),
    inviteUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { invitationId, clerkInvitationId, inviteUrl, error }) => {
    const inv = await ctx.db.get("invitations", invitationId);
    if (inv === null || inv.status !== "pending") return null;
    if (error) {
      await ctx.db.patch("invitations", invitationId, { status: "failed", error: error.slice(0, 200) });
    } else {
      await ctx.db.patch("invitations", invitationId, { clerkInvitationId, inviteUrl, error: undefined });
    }
    return null;
  },
});

export const sendToClerk = internalAction({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    const inv = await ctx.runQuery(internal.invitations.forSending, { invitationId });
    if (inv === null || inv.status !== "pending") return null;
    if (!env.CLERK_SECRET_KEY) {
      await ctx.runMutation(internal.invitations.recordResult, { invitationId, error: "Clerk key not configured" });
      return null;
    }
    const base = (env.ADMIN_APP_URL ?? "").replace(/\/+$/, "");
    const response = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email_address: inv.email,
        public_metadata: { hotelId: inv.hotelId, role: inv.role },
        redirect_url: base ? `${base}/sign-up` : undefined,
        notify: true,
        ignore_existing: true,
      }),
    });
    if (!response.ok) {
      let message = `Clerk error ${response.status}`;
      try {
        const body: unknown = await response.json();
        const first = (body as { errors?: { long_message?: string; message?: string }[] }).errors?.[0];
        if (first) message = first.long_message ?? first.message ?? message;
      } catch {
        // keep the status message
      }
      await ctx.runMutation(internal.invitations.recordResult, { invitationId, error: message });
      return null;
    }
    const body = (await response.json()) as { id?: unknown; url?: unknown };
    const id = typeof body.id === "string" ? body.id : undefined;
    const url = typeof body.url === "string" ? body.url : undefined;
    await ctx.runMutation(internal.invitations.recordResult, { invitationId, clerkInvitationId: id, inviteUrl: url });
    return null;
  },
});

export const revokeInClerk = internalAction({
  args: { clerkInvitationId: v.string() },
  returns: v.null(),
  handler: async (_ctx, { clerkInvitationId }) => {
    if (!env.CLERK_SECRET_KEY) return null;
    const response = await fetch(`https://api.clerk.com/v1/invitations/${encodeURIComponent(clerkInvitationId)}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
    if (!response.ok) console.warn("Clerk revoke failed", response.status);
    return null;
  },
});
