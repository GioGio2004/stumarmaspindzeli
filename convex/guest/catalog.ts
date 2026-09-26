import { v } from "convex/values";
import { query } from "../_generated/server";
import { guestContext } from "../lib/access";
import { guestItems, guestItemValidator } from "../lib/guestPayload";

/**
 * Visible guest-facing catalog for the room's hotel (internal playbooks
 * excluded). Works without an active stay so the guest can browse.
 */
export const list = query({
  args: { token: v.string() },
  returns: v.array(guestItemValidator),
  handler: async (ctx, { token }) => {
    const g = await guestContext(ctx, token);
    if (g === null) return [];
    return await guestItems(ctx, g.hotel._id);
  },
});
