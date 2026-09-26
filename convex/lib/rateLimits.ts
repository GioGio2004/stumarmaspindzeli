import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Guest service requests: ~20/hour per stay, bursts of up to 10.
  guestRequest: { kind: "token bucket", rate: 20, period: HOUR, capacity: 10 },
  // Guest analytics events (open app / view feature) per room.
  guestEvent: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
  // Guest rating / cancel actions per stay.
  guestAction: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
});
