import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

// Typed deployment env vars. Set them with `npx convex env set NAME value`
// or in the Convex dashboard. Read them via `env` from "./_generated/server".
const app = defineApp({
  env: {
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
    CLERK_WEBHOOK_SECRET: v.string(),
    VAPID_PUBLIC_KEY: v.string(),
    VAPID_PRIVATE_KEY: v.string(),
    VAPID_SUBJECT: v.string(), // "mailto:you@example.com"
    GEMINI_API_KEY: v.optional(v.string()),
    // Comma-separated Clerk user ids with authority over every hotel.
    SUPERVISOR_CLERK_IDS: v.optional(v.string()),
    // Used to send and revoke Clerk invitations.
    CLERK_SECRET_KEY: v.optional(v.string()),
    // Where invitation emails send people to finish sign-up.
    ADMIN_APP_URL: v.optional(v.string()),
  },
});

app.use(rateLimiter);

export default app;
