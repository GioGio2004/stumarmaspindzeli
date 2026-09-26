import { v } from "convex/values";
import { query } from "../_generated/server";
import { guestContext } from "../lib/access";

/** Everything the guest storefront needs for its header. Token = credential. */
export const get = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      hotel: v.object({
        name: v.string(),
        brandName: v.optional(v.string()),
        collection: v.optional(v.string()),
        phone: v.optional(v.string()),
        checkoutTime: v.optional(v.string()),
        guestLanguages: v.optional(v.array(v.string())),
      }),
      room: v.object({ number: v.string() }),
      stay: v.union(
        v.null(),
        v.object({
          checkInAt: v.number(),
          expectedCheckOutAt: v.number(),
          language: v.optional(v.string()),
        }),
      ),
      wifi: v.union(v.null(), v.object({ network: v.string(), password: v.string() })),
    }),
  ),
  handler: async (ctx, { token }) => {
    const g = await guestContext(ctx, token);
    if (g === null) return null;
    const { hotel, room, stay } = g;
    return {
      hotel: {
        name: hotel.name,
        brandName: hotel.brandName,
        collection: hotel.collection,
        phone: hotel.phone,
        checkoutTime: hotel.checkoutTime,
        guestLanguages: hotel.guestLanguages,
      },
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
