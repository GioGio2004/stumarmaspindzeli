import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import type { Metadata, Viewport } from "next";
import { Caveat, Noto_Sans_Georgian, Red_Hat_Display } from "next/font/google";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { StoreUser } from "@/components/StoreUser";
import { ToastProvider } from "@/components/kit";
import { ScrollIndicator } from "@/components/scroll-indicator";
import { ThemeProvider } from "@/components/theme";
import "./globals.css";

const redHat = Red_Hat_Display({ variable: "--font-red-hat", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
// Red Hat Display has no Georgian glyphs; staff titles and playbooks are Georgian.
const georgian = Noto_Sans_Georgian({
  variable: "--font-noto-georgian",
  subsets: ["georgian"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Stumar Maspindzeli · Admin",
  description: "Guest requests, stays, catalog and team for your hotel.",
  applicationName: "Stumar Maspindzeli",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Stumar" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Clerk's widgets read the same CSS variables as the app, so they follow the theme.
const clerkAppearance = {
  baseTheme: shadcn,
  variables: {
    borderRadius: "1.1rem",
    fontFamily: "var(--font-red-hat), var(--font-noto-georgian), sans-serif",
  },
  elements: {
    cardBox: "shadow-none ring-1 ring-black/5 rounded-[28px]",
    formButtonPrimary: "rounded-full",
    userButtonPopoverCard: "rounded-[24px] ring-1 ring-black/5",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${redHat.variable} ${caveat.variable} ${georgian.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <ClerkProvider appearance={clerkAppearance}>
            <ConvexClientProvider>
              <StoreUser />
              <ToastProvider>{children}</ToastProvider>
              <ScrollIndicator />
            </ConvexClientProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
