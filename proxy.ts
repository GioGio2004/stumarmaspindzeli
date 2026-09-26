import { clerkMiddleware } from "@clerk/nextjs/server";

// The landing page and sign-in stay public. Guests use the separate storefront app.
// Staff and manager areas require a Clerk session. Pages still gate their
// data with <Authenticated> + Convex auth; this is only the redirect.
const protectedPrefixes = [
  "/dashboard",
  "/requests",
  "/stays",
  "/queue",
  "/catalog",
  "/rooms",
  "/team",
  "/settings",
  "/onboarding",
  "/storefront",
  "/routines",
  "/platform",
];

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  if (protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
