import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { randomJoinCode, randomToken } from "./lib/access";
import { ensureDefaultDepartments, seedCatalogDefaults } from "./lib/defaults";
import { seedStorefrontDefaults } from "./lib/storefrontDefaults";

const GINO_SLUG = "gino-seaside";
const LEGACY_SLUG = "gino-seaside-tbilisi";

/**
 * Idempotent demo seed for the pilot hotel.
 *   npx convex run seed:gino '{"ownerExternalId":"user_..."}'
 */
export const gino = internalMutation({
  args: { ownerExternalId: v.string() },
  returns: v.object({
    hotelId: v.id("hotels"),
    roomsCreated: v.number(),
    itemsInserted: v.number(),
    tilesInserted: v.number(),
    eventsInserted: v.number(),
    demoRoomToken: v.string(),
    demoStayId: v.id("stays"),
  }),
  handler: async (ctx, { ownerExternalId }) => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", ownerExternalId))
      .unique();
    if (owner === null) throw new Error(`No user with externalId ${ownerExternalId}`);

    const hotelFields = {
      name: "Gino Seaside Tbilisi",
      brandName: "GINO",
      collection: "Trademark Collection by Wyndham",
      phone: "032 215 85 85",
      checkoutTime: "12:00",
      timezone: "Asia/Tbilisi",
      wifiName: "GINO-Seaside-Guest",
      wifiPassword: "tbilisisea",
      guestLanguages: ["en", "ka", "ru"],
    };
    let hotel =
      (await ctx.db
        .query("hotels")
        .withIndex("by_slug", (q) => q.eq("slug", GINO_SLUG))
        .first()) ??
      (await ctx.db
        .query("hotels")
        .withIndex("by_slug", (q) => q.eq("slug", LEGACY_SLUG))
        .first());
    if (hotel === null) {
      const id = await ctx.db.insert("hotels", {
        ...hotelFields,
        slug: GINO_SLUG,
        ownerUserId: owner._id,
        joinCode: randomJoinCode(),
        defaultLanguage: "ka",
      });
      hotel = (await ctx.db.get("hotels", id))!;
    } else {
      await ctx.db.patch("hotels", hotel._id, { ...hotelFields, slug: GINO_SLUG });
    }
    const hotelId = hotel._id;

    const depts = await ensureDefaultDepartments(ctx, hotelId);

    let roomsCreated = 0;
    const numbers: { number: string; floor: string }[] = [];
    for (let n = 101; n <= 112; n++) numbers.push({ number: String(n), floor: "1" });
    for (let n = 201; n <= 215; n++) numbers.push({ number: String(n), floor: "2" });
    for (const { number, floor } of numbers) {
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_hotelId_and_number", (q) => q.eq("hotelId", hotelId).eq("number", number))
        .first();
      if (existing) continue;
      await ctx.db.insert("rooms", {
        hotelId,
        number,
        floor,
        token: randomToken(16),
        active: true,
      });
      roomsCreated++;
    }

    const baseItems = await seedCatalogDefaults(ctx, hotelId);
    const storefront = await seedStorefrontDefaults(ctx, hotelId);
    const itemsInserted = baseItems + storefront.itemsInserted;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_hotelId_and_userId", (q) => q.eq("hotelId", hotelId).eq("userId", owner._id))
      .unique();
    const managerFields = {
      role: "manager" as const,
      onShift: true,
      departmentIds: Object.values(depts),
    };
    if (membership) {
      await ctx.db.patch("memberships", membership._id, managerFields);
    } else {
      await ctx.db.insert("memberships", {
        hotelId,
        userId: owner._id,
        completedTaskCount: 0,
        ...managerFields,
      });
    }

    const room214 = await ctx.db
      .query("rooms")
      .withIndex("by_hotelId_and_number", (q) => q.eq("hotelId", hotelId).eq("number", "214"))
      .first();
    if (room214 === null) throw new Error("Room 214 missing");
    if (!room214.active) await ctx.db.patch("rooms", room214._id, { active: true });
    let stay = await ctx.db
      .query("stays")
      .withIndex("by_roomId_and_status", (q) => q.eq("roomId", room214._id).eq("status", "active"))
      .first();
    if (stay === null) {
      const now = Date.now();
      const stayId = await ctx.db.insert("stays", {
        hotelId,
        roomId: room214._id,
        status: "active",
        guestLabel: "Demo guest",
        language: "en",
        adults: 2,
        checkInAt: now,
        expectedCheckOutAt: now + 3 * 24 * 60 * 60 * 1000,
      });
      stay = (await ctx.db.get("stays", stayId))!;
    }
    if (room214.currentStayId !== stay._id) {
      await ctx.db.patch("rooms", room214._id, { currentStayId: stay._id });
    }

    return {
      hotelId,
      roomsCreated,
      itemsInserted,
      tilesInserted: storefront.tilesInserted,
      eventsInserted: storefront.eventsInserted,
      demoRoomToken: room214.token,
      demoStayId: stay._id,
    };
  },
});
