import type { AuthConfig } from "convex/server";

// Clerk issues the JWT; Convex validates it against the Clerk JWKS.
// CLERK_JWT_ISSUER_DOMAIN is the Clerk Frontend API URL
// (dev: https://<slug>.clerk.accounts.dev) and lives in the Convex
// deployment env, not in .env.local.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
