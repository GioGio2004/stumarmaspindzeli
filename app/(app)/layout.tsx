"use client";

import { RedirectToSignIn } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Dots } from "@/components/brand/glyphs";
import { HotelProvider, useHotel } from "@/components/hotel-context";
import { api } from "@/convex/_generated/api";

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
        <UserReady>
          <HotelProvider>
            <Gate>{children}</Gate>
          </HotelProvider>
        </UserReady>
      </Authenticated>
    </>
  );
}

/**
 * On a first sign-in the users row is created by <StoreUser /> a moment after
 * the session starts. Wait for it so no query runs for a user that isn't there.
 */
function UserReady({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.current);
  if (!me) return <Splash />;
  return <>{children}</>;
}

/** Seconds to wait for the Clerk profile sync before giving up on a pending invite. */
const SYNC_WAIT_MS = 8_000;

function Gate({ children }: { children: ReactNode }) {
  const { loading, memberships } = useHotel();
  const me = useQuery(api.users.current);
  const router = useRouter();
  // A brand-new user's invitation is accepted only after their verified email
  // arrives from Clerk. Until then "no hotels" may just mean "not yet".
  const syncing = me !== undefined && me !== null && me.profileSyncedAt === undefined;
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!syncing) return;
    const t = window.setTimeout(() => setGaveUp(true), SYNC_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [syncing]);
  const empty = !loading && memberships.length === 0 && (!syncing || gaveUp);

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
