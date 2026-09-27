import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Guest service requests: ~20/hour per stay, bursts of up to 10.
  guestRequest: { kind: "token bucket", rate: 20, period: HOUR, capacity: 10 },
  // Guest analytics events (open app / view feature) per room, and per hotel.
  guestEvent: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  guestEventHotel: { kind: "token bucket", rate: 300, period: MINUTE, capacity: 300 },
  // Stay PIN attempts per room: 5 tries per 10 minutes.
  guestPin: { kind: "fixed window", rate: 5, period: 10 * MINUTE },
  // Joining a hotel with a code, per user.
  joinHotel: { kind: "fixed window", rate: 10, period: HOUR },
  // Creating hotels, per user.
  createHotel: { kind: "fixed window", rate: 5, period: HOUR },
  // AI step drafting, per hotel.
  aiDraft: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  // Guest rating / cancel actions per stay.
  guestAction: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  // Guest AI concierge: messages per chat, all chats per hotel, and new chats per hotel.
  guestAi: { kind: "token bucket", rate: 40, period: HOUR, capacity: 12 },
  guestAiHotel: { kind: "token bucket", rate: 1200, period: HOUR, capacity: 120 },
  guestAiStart: { kind: "token bucket", rate: 300, period: HOUR, capacity: 60 },
});
