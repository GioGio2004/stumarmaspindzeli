import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { guestContext } from "../lib/access";
import {
  guestEvents,
  guestEventValidator,
  guestItems,
  guestItemValidator,
  guestTiles,
  guestTileValidator,
} from "../lib/guestPayload";
import { getSettings } from "../lib/storefrontDefaults";
import { storefrontSettingsFields } from "../schema";

const payloadValidator = v.object({
  hotel: v.object({
    name: v.string(),
    brandName: v.optional(v.string()),
    collection: v.optional(v.string()),
    phone: v.optional(v.string()),
    checkoutTime: v.optional(v.string()),
    slug: v.string(),
    guestLanguages: v.optional(v.array(v.string())),
  }),
  settings: v.object(storefrontSettingsFields),
  tiles: v.array(guestTileValidator),
  items: v.array(guestItemValidator),
  events: v.array(guestEventValidator),
  room: v.union(v.object({ number: v.string() }), v.null()),
  stay: v.union(
    v.object({
      checkInAt: v.number(),
      expectedCheckOutAt: v.number(),
      language: v.optional(v.string()),
    }),
    v.null(),
  ),
  wifi: v.union(v.object({ network: v.string(), password: v.string() }), v.null()),
});

async function basePayload(ctx: QueryCtx, hotel: Doc<"hotels">) {
  const { settings } = await getSettings(ctx, hotel._id);
  return {
    hotel: {
      name: hotel.name,
      brandName: hotel.brandName,
      collection: hotel.collection,
      phone: hotel.phone,
      checkoutTime: hotel.checkoutTime,
      slug: hotel.slug,
      guestLanguages: hotel.guestLanguages,
    },
    settings,
    tiles: await guestTiles(ctx, hotel._id),
    items: await guestItems(ctx, hotel._id),
    events: await guestEvents(ctx, hotel._id),
  };
}

/** The whole guest app for a room link. Null for unknown / inactive rooms. */
export const byToken = query({
  args: { token: v.string() },
  returns: v.union(payloadValidator, v.null()),
  handler: async (ctx, { token }) => {
    const g = await guestContext(ctx, token);
    if (g === null) return null;
    const { hotel, room, stay } = g;
    return {
      ...(await basePayload(ctx, hotel)),
      room: { number: room.number },
      stay: stay
        ? {
            checkInAt: stay.checkInAt,
            expectedCheckOutAt: stay.expectedCheckOutAt,
            language: stay.language,
          }
        : null,
      wifi:
        stay && hotel.wifiName
          ? { network: hotel.wifiName, password: hotel.wifiPassword ?? "" }
          : null,
    };
  },
});

/** Public preview of a hotel's guest app (no room, stay or Wi-Fi). */
export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(payloadValidator, v.null()),
  handler: async (ctx, { slug }) => {
    if (slug.length === 0 || slug.length > 80) return null;
    const hotel = await ctx.db
      .query("hotels")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (hotel === null) return null;
    return { ...(await basePayload(ctx, hotel)), room: null, stay: null, wifi: null };
  },
});
