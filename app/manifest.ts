import type { MetadataRoute } from "next";

// Staff PWA. Icons live in /public (android-chrome-*, apple-touch-icon).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stumar Maspindzeli",
    short_name: "Stumar",
    description: "Guest requests, stays, catalog and team for your hotel.",
    id: "/",
    start_url: "/queue",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "en",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
