# სტუმარ-მასპინძელი / Stumar Maspindzeli

Guest requests that arrive with their own instructions. A guest taps the NFC
stand (or scans the QR) in the room, picks a request, and the on-shift staff
get a push notification whose task opens with the manager's step-by-step
playbook. Built for SmartStay 3.0 (Telavi, 26–27 Sep 2026), challenge 4:
staff onboarding and housekeeping coordination.

## Stack

- Next.js 16 (App Router, Turbopack), Tailwind 4, shadcn/ui (base-nova preset)
- Clerk — auth for managers and staff only; guests never sign in
- Convex — database, realtime queries, backend functions, file storage
- Web Push (VAPID) — staff PWA notifications
- Gemini (`@google/genai`) — drafts playbook steps from rough notes

## Routes

| Path | Who | What |
|---|---|---|
| `/` | anyone | landing, sign in / sign up |
| `/r/<token>` | guest | room page from the NFC/QR link, quick requests, live status |
| `/staff` | signed-in member | on-shift toggle, push toggle, live task queue |
| `/staff/tasks/<id>` | signed-in member | task with playbook checklist |
| `/manage` | manager | metrics, join code, rooms, team, templates + steps |
| `/profile` | signed-in member | account, hotels + shift toggles, push toggle |

## UI

Dark-only glassmorphic theme. Tokens and `glass*` utilities in
`app/globals.css`; `components/Glass.tsx` (Glass, GlassTitle, Pill) and
`components/AppShell.tsx` (top bar + mobile bottom tabs) are the building
blocks. Animations are tw-animate-css classes plus a few CSS keyframes.

## Data model (`convex/schema.ts`)

`users` (Clerk mirror) → `hotels` → `memberships` (role, onShift) →
`rooms` (unguessable `token`) · `locations` (item → where, photo) ·
`taskTemplates` → `templateSteps` · `tasks` → `taskSteps` (snapshot per task) ·
`pushSubscriptions`.

## Local setup

```bash
npm install
npx convex dev        # terminal 1, keeps functions in sync
npm run dev           # terminal 2
```

`.env.local` needs (Clerk CLI + Convex CLI write most of these):

```
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/staff
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/staff
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

Convex deployment env (`npx convex env set NAME value`):

```
CLERK_JWT_ISSUER_DOMAIN   Clerk Frontend API URL, e.g. https://xxx.clerk.accounts.dev
CLERK_WEBHOOK_SECRET      from the Clerk webhook endpoint (whsec_...)
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT   npx web-push generate-vapid-keys
GEMINI_API_KEY            optional; ai.draftSteps returns [] without it
```

## One-time manual steps

1. **Clerk → Convex JWT**: Clerk Dashboard → Integrations → Convex → enable
   (adds `aud: convex`). Already done for the dev instance.
2. **Clerk webhook** (keeps `users` in sync; the app also self-stores users on
   first sign-in, so this is not blocking): Clerk Dashboard → Webhooks → Add
   endpoint → URL `<NEXT_PUBLIC_CONVEX_SITE_URL>/clerk-users-webhook`,
   events `user.created`, `user.updated`, `user.deleted` → copy the signing
   secret → `npx convex env set CLERK_WEBHOOK_SECRET whsec_...`.
3. **Gemini key**: Google AI Studio → `npx convex env set GEMINI_API_KEY ...`.
4. **Push on iPhone** works only after "Add to Home Screen"; Android Chrome
   works from the browser. Production needs HTTPS (Vercel).

## Demo loop

1. Manager: `/manage` → create hotel → add room → add template with steps.
2. Staff: sign up → `/staff` → enter join code → turn on push → "ცვლაზე ვარ".
3. Guest: open `/r/<token>` (the link shown next to the room) → tap a request.
4. Staff phone buzzes → open task → tick steps → guest sees "Done".
