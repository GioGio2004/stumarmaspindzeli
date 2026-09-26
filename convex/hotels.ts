import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  getMember,
  cleanOptionalText,
  cleanText,
  fail,
  randomJoinCode,
  requireRole,
  slugify,
} from "./lib/access";
import { ensureDefaultDepartments } from "./lib/defaults";
import { rateLimiter } from "./lib/rateLimits";
import { addSupervisorsToHotel, isSupervisor } from "./lib/supervisor";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "./lib/stats";
import schema, { roleValidator } from "./schema";
import { getCurrentUser, requireUser } from "./users";

const LANG_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkLanguage(lang: string): string {
  const s = lang.trim();
  if (!LANG_RE.test(s)) fail("INVALID", `Invalid language code "${lang}"`);
  return s;
}

/** Create a hotel; the creator becomes its first manager. */
export const create = mutation({
  args: { name: v.string(), defaultLanguage: v.optional(v.string()) },
  returns: v.id("hotels"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = await rateLimiter.limit(ctx, "createHotel", { key: user._id });
    if (!limit.ok) fail("RATE_LIMITED", "Too many hotels created. Try again later.");
    const name = cleanText(args.name, "Name", 80);
    const hotelId = await ctx.db.insert("hotels", {
      name,
      slug: slugify(name),
      ownerUserId: user._id,
      joinCode: randomJoinCode(),
      defaultLanguage: args.defaultLanguage ? checkLanguage(args.defaultLanguage) : "ka",
      timezone: DEFAULT_TIMEZONE,
      checkoutTime: "12:00",
    });
    const depts = await ensureDefaultDepartments(ctx, hotelId);
    await ctx.db.insert("memberships", {
      hotelId,
      userId: user._id,
      role: "manager",
      onShift: true,
      completedTaskCount: 0,
      departmentIds: Object.values(depts),
    });
    await addSupervisorsToHotel(ctx, hotelId);
    return hotelId;
  },
});

/** Hotels the signed-in user belongs to. */
export const mine = query({
  args: {},
  returns: v.array(
    v.object({
      hotel: schema.doc("hotels"),
      membershipId: v.id("memberships"),
      role: roleValidator,
      onShift: v.boolean(),
      departmentIds: v.array(v.id("departments")),
      supervisor: v.boolean(), // the caller is the platform supervisor
    }),
  ),
  handler: async (ctx) => {
    // A brand-new user has no row until users.store runs: that is "no hotels", not an error.
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    const supervisor = isSupervisor(user);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(supervisor ? 200 : 20);
    const out = [];
    for (const m of memberships) {
      const hotel = await ctx.db.get("hotels", m.hotelId);
      if (hotel) {
        out.push({
          hotel,
          membershipId: m._id,
          role: m.role,
          onShift: m.onShift,
          departmentIds: m.departmentIds ?? [],
          supervisor,
        });
      }
    }
    return out;
  },
});

export const get = query({
  args: { hotelId: v.id("hotels") },
  returns: v.union(schema.doc("hotels"), v.null()),
  handler: async (ctx, { hotelId }) => {
    if ((await getMember(ctx, hotelId)) === null) return null;
    return await ctx.db.get("hotels", hotelId);
  },
});

export const update = mutation({
  args: {
    hotelId: v.id("hotels"),
    name: v.optional(v.string()),
    brandName: v.optional(v.string()),
    collection: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    wifiName: v.optional(v.string()),
    wifiPassword: v.optional(v.string()),
    checkoutTime: v.optional(v.string()),
    defaultLanguage: v.optional(v.string()),
    guestLanguages: v.optional(v.array(v.string())),
    timezone: v.optional(v.string()),
    requireGuestPin: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { hotelId, ...a }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    const patch: Partial<Doc<"hotels">> = {};
    if (a.name !== undefined) patch.name = cleanText(a.name, "Name", 80);
    // Empty string clears an optional text field.
    if (a.brandName !== undefined) patch.brandName = cleanOptionalText(a.brandName, "Brand", 40);
    if (a.collection !== undefined)
      patch.collection = cleanOptionalText(a.collection, "Collection", 80);
    if (a.address !== undefined) patch.address = cleanOptionalText(a.address, "Address", 200);
    if (a.phone !== undefined) patch.phone = cleanOptionalText(a.phone, "Phone", 40);
    if (a.wifiName !== undefined) patch.wifiName = cleanOptionalText(a.wifiName, "Wi-Fi name", 64);
    if (a.wifiPassword !== undefined)
      patch.wifiPassword = cleanOptionalText(a.wifiPassword, "Wi-Fi password", 64);
    if (a.checkoutTime !== undefined) {
      const t = a.checkoutTime.trim();
      if (!TIME_RE.test(t)) fail("INVALID", "Checkout time must be HH:MM");
      patch.checkoutTime = t;
    }
    if (a.defaultLanguage !== undefined) patch.defaultLanguage = checkLanguage(a.defaultLanguage);
    if (a.guestLanguages !== undefined) {
      const langs = [...new Set(a.guestLanguages.map(checkLanguage))];
      if (langs.length > 8) fail("INVALID", "At most 8 guest languages");
      patch.guestLanguages = langs;
    }
    if (a.timezone !== undefined) {
      if (!isValidTimeZone(a.timezone)) fail("INVALID", "Unknown timezone");
      patch.timezone = a.timezone;
    }
    if (a.requireGuestPin !== undefined) patch.requireGuestPin = a.requireGuestPin;
    await ctx.db.patch("hotels", hotelId, patch);
    return null;
  },
});

/** Staff onboarding: enter the code the manager shares. Idempotent. */
export const join = mutation({
  args: { joinCode: v.string() },
  returns: v.id("hotels"),
  handler: async (ctx, { joinCode }) => {
    const user = await requireUser(ctx);
    const limit = await rateLimiter.limit(ctx, "joinHotel", { key: user._id });
    if (!limit.ok) fail("RATE_LIMITED", "Too many attempts. Try again later.");
    const code = joinCode.trim().toUpperCase();
    if (code.length === 0 || code.length > 12) fail("INVALID", "Invalid join code");
    const hotel = await ctx.db
      .query("hotels")
      .withIndex("by_joinCode", (q) => q.eq("joinCode", code))
      .unique();
    if (hotel === null) fail("NOT_FOUND", "Invalid join code");

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_hotelId_and_userId", (q) => q.eq("hotelId", hotel._id).eq("userId", user._id))
      .unique();
    if (existing === null) {
      await ctx.db.insert("memberships", {
        hotelId: hotel._id,
        userId: user._id,
        role: "staff",
        onShift: true,
        completedTaskCount: 0,
        departmentIds: [],
      });
    }
    return hotel._id;
  },
});

export const regenerateJoinCode = mutation({
  args: { hotelId: v.id("hotels") },
  returns: v.string(),
  handler: async (ctx, { hotelId }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    const joinCode = randomJoinCode();
    await ctx.db.patch("hotels", hotelId, { joinCode });
    return joinCode;
  },
});
