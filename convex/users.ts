import type { UserJSON } from "@clerk/backend";
import { ConvexError, v, type Validator } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { env, internalAction, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { acceptPendingInvitations } from "./lib/invitations";
import { ensureSupervisorMemberships, isSupervisor } from "./lib/supervisor";
import schema from "./schema";

// Email is the key for invitations, so it is only ever written from a source
// Clerk vouches for: the signed webhook payload, or Clerk's Backend API read
// with our secret key. Never from arguments the browser sends.

// ---- public --------------------------------------------------------------

/** The signed-in user's row, or null before the first sync. */
export const current = query({
  args: {},
  returns: v.union(schema.doc("users"), v.null()),
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

/** The signed-in user's row plus the platform-supervisor flag. */
export const me = query({
  args: {},
  returns: v.union(v.object({ user: schema.doc("users"), supervisor: v.boolean() }), v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return { user, supervisor: isSupervisor(user) };
  },
});

const MAX_NAME = 120;

function cleanName(value: string | undefined) {
  const s = value?.trim();
  return s ? s.slice(0, MAX_NAME) : undefined;
}

function cleanImageUrl(value: string | undefined) {
  if (!value || value.length > 1000) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Called by the client right after sign-in. Creates the row if needed with
 * display fields only, then asks Clerk for the verified email in the
 * background (which also accepts pending invitations).
 */
export const store = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()), // ignored: kept so older clients keep working
    imageUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not signed in" });

    const name = cleanName(args.name) ?? cleanName(identity.name) ?? cleanName(identity.nickname) ?? "Unnamed";
    const imageUrl = cleanImageUrl(args.imageUrl) ?? cleanImageUrl(identity.pictureUrl);

    let user = await userByExternalId(ctx, identity.subject);
    if (user === null) {
      const id = await ctx.db.insert("users", { externalId: identity.subject, name, imageUrl });
      user = (await ctx.db.get("users", id))!;
    } else if (user.name === "Unnamed" && name !== "Unnamed") {
      await ctx.db.patch("users", user._id, { name, imageUrl: imageUrl ?? user.imageUrl });
    }

    if (user.profileSyncedAt === undefined) {
      await ctx.scheduler.runAfter(0, internal.users.syncFromClerk, { externalId: user.externalId });
    }
    await ensureSupervisorMemberships(ctx, user);
    return user._id;
  },
});

// ---- internal: verified profile ---------------------------------------------

type ClerkEmail = { id: string; email_address: string; verification?: { status?: string } | null };

function verifiedPrimaryEmail(data: {
  email_addresses?: ClerkEmail[];
  primary_email_address_id?: string | null;
}): string | undefined {
  const primary = data.email_addresses?.find((e) => e.id === data.primary_email_address_id);
  if (!primary || primary.verification?.status !== "verified") return undefined;
  return primary.email_address.trim().toLowerCase();
}

/** Reads the user's verified primary email from Clerk's Backend API. */
export const syncFromClerk = internalAction({
  args: { externalId: v.string() },
  returns: v.null(),
  handler: async (ctx, { externalId }) => {
    let email: string | undefined;
    if (env.CLERK_SECRET_KEY) {
      try {
        const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(externalId)}`, {
          headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
        });
        if (response.ok) email = verifiedPrimaryEmail((await response.json()) as Parameters<typeof verifiedPrimaryEmail>[0]);
        else console.warn("Clerk user lookup failed", response.status);
      } catch (error) {
        console.warn("Clerk user lookup failed", error);
      }
    }
    await ctx.runMutation(internal.users.applyVerifiedEmail, { externalId, email });
    return null;
  },
});

export const applyVerifiedEmail = internalMutation({
  args: { externalId: v.string(), email: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { externalId, email }) => {
    const user = await userByExternalId(ctx, externalId);
    if (user === null) return null;
    await ctx.db.patch("users", user._id, { email: email ?? user.email, profileSyncedAt: Date.now() });
    const fresh = await ctx.db.get("users", user._id);
    if (fresh && email) await acceptPendingInvitations(ctx, fresh);
    return null;
  },
});

// ---- internal (called from the Clerk webhook in http.ts) -----------------

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> },
  returns: v.null(),
  handler: async (ctx, { data }) => {
    const email = verifiedPrimaryEmail(data);
    const attrs = {
      externalId: data.id,
      name:
        cleanName([data.first_name, data.last_name].filter(Boolean).join(" ")) ??
        cleanName(data.username ?? undefined) ??
        "Unnamed",
      email,
      imageUrl: cleanImageUrl(data.image_url),
      profileSyncedAt: Date.now(),
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
      if (email) await acceptPendingInvitations(ctx, user);
      await ensureSupervisorMemberships(ctx, user);
    }
    return null;
  },
});

/** A Clerk account was deleted: remove its access and hand back its work. */
export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkUserId }) => {
    const user = await userByExternalId(ctx, clerkUserId);
    if (user === null) {
      console.warn(`No user to delete for Clerk id ${clerkUserId}`);
      return null;
    }
    await removeUserData(ctx, user);
    await ctx.db.delete("users", user._id);
    return null;
  },
});

async function removeUserData(ctx: MutationCtx, user: Doc<"users">) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(200);
  for (const m of memberships) await ctx.db.delete("memberships", m._id);

  const subscriptions = await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(100);
  for (const s of subscriptions) await ctx.db.delete("pushSubscriptions", s._id);

  for (const status of ["accepted", "in_progress"] as const) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeUserId_and_status", (q) => q.eq("assigneeUserId", user._id).eq("status", status))
      .take(200);
    for (const t of tasks) {
      await ctx.db.patch("tasks", t._id, { status: "open", assigneeUserId: undefined, acceptedAt: undefined, startedAt: undefined });
    }
  }
}

// ---- helpers -------------------------------------------------------------

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  // Clerk's `subject` claim is the Clerk user id, the same id the webhook
  // stores in `externalId`.
  return await userByExternalId(ctx, identity.subject);
}

/** Throws when nobody is signed in or the user row does not exist yet. */
export async function requireUser(ctx: QueryCtx) {
  const user = await getCurrentUser(ctx);
  if (user === null) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not signed in" });
  return user;
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
}
