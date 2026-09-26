"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

/** Ensures a `users` row exists as soon as the Convex socket is authenticated. */
export function StoreUser() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const store = useMutation(api.users.store);

  const name = user?.fullName ?? user?.username ?? undefined;
  const email = user?.primaryEmailAddress?.emailAddress;
  const imageUrl = user?.imageUrl;

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    store({ name: name ?? undefined, email, imageUrl }).catch((e) =>
      console.error("users.store failed", e),
    );
  }, [isAuthenticated, user, name, email, imageUrl, store]);

  return null;
}
