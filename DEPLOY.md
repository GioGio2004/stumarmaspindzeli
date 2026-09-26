# Deploying to production

Production = Vercel (both apps) + Convex production deployment `first-dogfish-732`
+ Clerk **development** instance (for now). Push to `main` and Vercel deploys.

## 1. Admin (this repo) on Vercel

Import `GioGio2004/stumarmaspindzeli`. Framework: Next.js. `vercel.json` sets the
build command to `npx convex deploy --cmd 'npm run build'`, which pushes the
Convex functions to production and injects `NEXT_PUBLIC_CONVEX_URL` into the build.

Environment variables (Production):

| Name | Value |
| --- | --- |
| `CONVEX_DEPLOY_KEY` | Convex dashboard → first-dogfish-732 → Settings → Deploy keys → Generate production key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | same as `.env.local` (pk_test_…) |
| `CLERK_SECRET_KEY` | same as `.env.local` (sk_test_…) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same as `.env.local` |
| `NEXT_PUBLIC_STOREFRONT_URL` | the storefront's Vercel URL, e.g. `https://stumar-maspindzeli-storefront.vercel.app` |

## 2. Storefront on Vercel

Import `GioGio2004/stumar-maspindzeli-storefront`. Default build.

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | `https://first-dogfish-732.eu-west-1.convex.cloud` |
| `NEXT_PUBLIC_HOTEL_SLUG` | `gino-seaside` |
| `ADMIN_APP_URL` | the admin's Vercel URL (lets the admin preview embed the storefront) |

## 3. Convex production settings (once the URLs exist)

```bash
npx convex env set --prod ADMIN_APP_URL https://<admin>.vercel.app
```

Already set on production: `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_SECRET_KEY`,
`CLERK_WEBHOOK_SECRET`, `VAPID_*`, `SUPERVISOR_CLERK_IDS`.

## 4. First run

1. Sign in to the live admin with the supervisor account. Your user row is
   created and you get manager access to every hotel.
2. Seed the pilot hotel (idempotent):

   ```bash
   npx convex run --prod seed:gino '{"ownerExternalId":"user_3JnEYvkFw24xw0HTJn3VZNWLzXh"}'
   ```

3. Only if Convex functions changed since the last sync: regenerate the
   storefront API and push the storefront (dev and prod run the same code, so
   the file is identical either way):

   ```bash
   npm run api:sync -- --prod
   ```

4. Check the first deploy worked: open a room link from Rooms, check a guest in
   at Front desk and read the PIN off the stay, then send a request from a phone.

## Guest PIN

Each check-in gets a 4-digit stay PIN, shown to reception in the stay sheet at
Front desk (with a Reset button). The first time a phone opens the room tag it
asks for the PIN, then remembers a long random key for that stay. Without it a
guest can browse but not send requests or see the room's request history.
Check-out or Reset makes old phones ask again. Managers can switch the PIN off
in Settings → Guest stay.

## Clerk (development instance)

- Sign-up is invitation-only. Invitation emails come from `accounts.dev` and
  often land in spam; use the "copy invite link" button in Team meanwhile.
- Optional: add a webhook endpoint in Clerk → Webhooks with URL
  `https://first-dogfish-732.eu-west-1.convex.site/clerk-users-webhook`
  (events `user.*`) and put its signing secret in `CLERK_WEBHOOK_SECRET` on prod.
  Without it, users are still synced on every sign-in.
