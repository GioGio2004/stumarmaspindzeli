"use client";

import { RedirectToSignIn } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Dots } from "@/components/brand/glyphs";
import { HotelProvider, useHotel } from "@/components/hotel-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <Splash />
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
      <Authenticated>
        <HotelProvider>
          <Gate>{children}</Gate>
        </HotelProvider>
      </Authenticated>
    </>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { loading, memberships } = useHotel();
  const router = useRouter();
  const empty = !loading && memberships.length === 0;

  useEffect(() => {
    if (empty) router.replace("/onboarding");
  }, [empty, router]);

  if (loading || empty) return <Splash />;
  return <AppShell>{children}</AppShell>;
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Dots className="size-8 animate-pulse" />
    </div>
  );
}
