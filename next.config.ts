import type { NextConfig } from "next";

const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL;

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The push service worker must never be served stale.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
  // Old URLs from the first version (bookmarks, printed QR codes, push notifications).
  async redirects() {
    return [
      { source: "/staff", destination: "/queue", permanent: false },
      { source: "/staff/tasks/:taskId", destination: "/queue/:taskId", permanent: false },
      { source: "/manage", destination: "/dashboard", permanent: false },
      { source: "/profile", destination: "/queue", permanent: false },
      ...(storefront ? [{ source: "/r/:token", destination: `${storefront}/r/:token`, permanent: false }] : []),
    ];
  },
};

export default nextConfig;
