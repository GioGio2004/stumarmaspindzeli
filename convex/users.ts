import type { UserJSON } from "@clerk/backend";
import { v, type Validator } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { acceptPendingInvitations } from "./lib/invitations";
import { ensureSupervisorMemberships, isSupervisor } from "./lib/supervisor";
import schema from "./schema";

// ---- public --------------------------------------------------------------

/** The signed-in user's row, or null while Clerk has not synced them yet. */
export const current = query({
  args: {},
  returns: v.union(schema.doc("users"), v.null()),
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

/**
 * The signed-in user's row plus platform flags, or null before sync.
 * Platform-supervisor authority is not implemented, so `supervisor` is false.
 */
export const me = query({
  args: {},
  returns: v.union(v.object({ user: schema.doc("users"), supervisor: v.boolean() }), v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return { user, supervisor: isSupervisor(user) };
  },
});

/**
 * Called by the client right after sign-in. Creates the row from the JWT
 * claims if the Clerk webhook has not delivered yet (or is not configured),
 * so the app never depends on webhook timing. The webhook keeps it fresh.
 */
export const store = mutation({
  args: {
    // Profile fields from Clerk's client SDK; the default session JWT does
    // not carry name/email, so the client passes them explicitly.
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const name =
      args.name?.trim() ||
      identity.name ||
      identity.nickname ||
      args.email ||
      identity.email ||
      "Unnamed";
    const attrs = {
      name,
      email: args.email ?? identity.email,
      imageUrl: args.imageUrl ?? identity.pictureUrl,
    };

    const existing = await userByExternalId(ctx, identity.subject);
    let userId;
    if (existing !== null) {
      // Only fill gaps or fix the placeholder; the webhook stays authoritative.
      if (existing.name === "Unnamed" || !existing.email) {
        await ctx.db.patch("users", existing._id, attrs);
      }
      userId = existing._id;
    } else {
      userId = await ctx.db.insert("users", { externalId: identity.subject, ...attrs });
    }
    const user = await ctx.db.get("users", userId);
    if (user !== null) {
      await acceptPendingInvitations(ctx, user);
      await ensureSupervisorMemberships(ctx, user);
    }
    return userId;
  },
});

// ---- internal (called from the Clerk webhook in http.ts) -----------------

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> },
  returns: v.null(),
  handler: async (ctx, { data }) => {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    )?.email_address;

    const attrs = {
      externalId: data.id,
      name:
        [data.first_name, data.last_name].filter(Boolean).join(" ") ||
        data.username ||
        primaryEmail ||
        "Unnamed",
      email: primaryEmail,
      imageUrl: data.image_url,
    };

    const existing = await userByExternalId(ctx, data.id);
    let userId;
    if (existing === null) {
      userId = await ctx.db.insert("users", attrs);
    } else {
      await ctx.db.patch("users", existing._id, attrs);
      userId = existing._id;
    }
    const user = await ctx.db.get("users", userId);
    if (user !== null) {
      await acceptPendingInvitations(ctx, user);
      await ensureSupervisorMemberships(ctx, user);
    }
    return null;
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkUserId }) => {
    const user = await userByExternalId(ctx, clerkUserId);
    if (user === null) {
      console.warn(`No user to delete for Clerk id ${clerkUserId}`);
      return null;
    }
    await ctx.db.delete("users", user._id);
    return null;
  },
});

// ---- helpers -------------------------------------------------------------

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  // Clerk's `subject` claim is the Clerk user id, the same id the webhook
  // stores in `externalId`.
  return await userByExternalId(ctx, identity.subject);
}

/** Throws when nobody is signed in or the webhook has not synced them yet. */
export async function requireUser(ctx: QueryCtx) {
  const user = await getCurrentUser(ctx);
  if (user === null) throw new Error("Not authenticated");
  return user;
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
}
