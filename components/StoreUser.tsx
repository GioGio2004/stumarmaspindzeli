"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

/**
 * Ensures a `users` row exists as soon as the Convex socket is authenticated.
 * Email is never sent from here: the backend reads the verified one from Clerk.
 */
export function StoreUser() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const store = useMutation(api.users.store);

  const userId = user?.id;
  const name = user?.fullName ?? user?.username ?? undefined;
  const imageUrl = user?.imageUrl;

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    store({ name, imageUrl }).catch((e) => console.error("users.store failed", e));
  }, [isAuthenticated, userId, name, imageUrl, store]);

  return null;
}
