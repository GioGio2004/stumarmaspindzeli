@AGENTS.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Guest storefront (separate repo)

The guest-facing app lives in `../stumar-maspindzeli-storefront` and talks to
this repo's Convex deployment. It gets typed function references from a
generated `lib/convex/api.ts`, not from `convex/_generated`.

- After adding or changing any public Convex function, keep `npx convex dev`
  running and run `npm run api:sync`. It regenerates the storefront's API file.
- Internal functions never reach the storefront; guest functions must be
  public, token-checked, and carry `args` and `returns` validators.
- Room tag links use `NEXT_PUBLIC_STOREFRONT_URL` (see `.env.local`).
