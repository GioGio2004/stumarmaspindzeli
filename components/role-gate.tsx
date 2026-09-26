"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@/lib/status";
import { homeFor } from "./app-shell";
import { useHotel } from "./hotel-context";
import { buttonClass, EmptyState } from "./kit";

/** Hides a page from roles that shouldn't see it. The backend enforces the same rule. */
export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role } = useHotel();
  if (!role) return null;
  if (!allow.includes(role)) {
    return (
      <EmptyState
        title="This page isn't part of your role"
        body="Ask a manager if you need access."
        action={
          <Link href={homeFor(role)} className={buttonClass("primary")}>
            Go to my page
          </Link>
        }
      />
    );
  }
  return <>{children}</>;
}
