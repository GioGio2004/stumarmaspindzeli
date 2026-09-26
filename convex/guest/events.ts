import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { guestContext } from "../lib/access";
import { rateLimiter } from "../lib/rateLimits";
import { recordStats, safeStatKey } from "../lib/stats";

/** Guest analytics. Silently ignores bad tokens and rate-limited calls. */
export const track = mutation({
  args: {
    token: v.string(),
    kind: v.union(v.literal("open_app"), v.literal("view_feature")),
    target: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { token, kind, target }) => {
    const g = await guestContext(ctx, token);
    if (g === null) return null;
    const cleanTarget = safeStatKey(target?.trim().slice(0, 40)) ?? undefined;
    if (kind === "view_feature" && cleanTarget === undefined) return null;
    const limit = await rateLimiter.limit(ctx, "guestEvent", { key: g.room._id });
    if (!limit.ok) return null;
    await ctx.db.insert("guestEvents", {
      hotelId: g.hotel._id,
      stayId: g.stay?._id,
      roomId: g.room._id,
      kind,
      target: cleanTarget,
    });
    await recordStats(
      ctx,
      g.hotel,
      Date.now(),
      kind === "open_app" ? { appOpens: 1 } : { feature: cleanTarget },
    );
    return null;
  },
});
