import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { guestContext, stayNeedsKey } from "../lib/access";
import { rateLimiter } from "../lib/rateLimits";

/**
 * Exchange the stay PIN (told by reception) for the stay key the phone keeps.
 * Never throws for a wrong PIN, so every attempt is counted: 5 per 10 minutes
 * per room, which makes guessing a 4-digit PIN impractical.
 */
export const unlock = mutation({
  args: { token: v.string(), pin: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), key: v.union(v.string(), v.null()) }),
    v.object({ ok: v.literal(false), message: v.string() }),
  ),
  handler: async (ctx, { token, pin }) => {
    const g = await guestContext(ctx, token);
    if (g === null) return { ok: false as const, message: "This room link is not valid" };
    if (g.stay === null) return { ok: false as const, message: "Your room switches on at check-in" };
    if (!stayNeedsKey(g.hotel, g.stay)) return { ok: true as const, key: null };

    const limit = await rateLimiter.limit(ctx, "guestPin", { key: g.room._id });
    if (!limit.ok) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfter / 60_000));
      return { ok: false as const, message: `Too many tries. Try again in ${minutes} min or ask reception.` };
    }
    if (pin.trim() !== g.stay.guestPin) return { ok: false as const, message: "That PIN isn't right" };
    return { ok: true as const, key: g.stay.guestKey ?? null };
  },
});
