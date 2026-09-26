import type { NextConfig } from "next";

const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL;

const nextConfig: NextConfig = {
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
