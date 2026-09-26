import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentUser, requireUser } from "../users";

type Ctx = QueryCtx | MutationCtx;

export type Role = Doc<"memberships">["role"];

export type Member = {
  user: Doc<"users">;
  membership: Doc<"memberships">;
};

/** Throw a structured error the client can read via `error.data`. */
export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

/** The caller's membership in the hotel, or null (for queries that should not throw). */
export async function getMember(ctx: Ctx, hotelId: Id<"hotels">): Promise<Member | null> {
  const user = await getCurrentUser(ctx);
  if (user === null) return null;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_hotelId_and_userId", (q) => q.eq("hotelId", hotelId).eq("userId", user._id))
    .unique();
  return membership === null ? null : { user, membership };
}

/** Signed-in user who belongs to the hotel (any role). */
export async function requireMember(ctx: Ctx, hotelId: Id<"hotels">): Promise<Member> {
  const user = await requireUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_hotelId_and_userId", (q) => q.eq("hotelId", hotelId).eq("userId", user._id))
    .unique();
  if (membership === null) fail("FORBIDDEN", "Not a member of this hotel");
  return { user, membership };
}

/** Signed-in member whose role is one of `roles`. */
export async function requireRole(
  ctx: Ctx,
  hotelId: Id<"hotels">,
  roles: readonly Role[],
): Promise<Member> {
  const member = await requireMember(ctx, hotelId);
  if (!roles.includes(member.membership.role)) {
    fail("FORBIDDEN", `Only ${roles.join(" / ")} can do this`);
  }
  return member;
}

/**
 * requireMember / requireRole for queries, except that nobody signed in gives
 * null instead of an error. Signing out (or a session ending) re-runs every
 * open query without a login a moment before the page unmounts; the query then
 * answers with an empty result instead of logging UNAUTHENTICATED. Signed-in
 * callers get exactly the same checks.
 */
export async function memberOrSignedOut(
  ctx: QueryCtx,
  hotelId: Id<"hotels">,
  roles?: readonly Role[],
): Promise<Member | null> {
  if ((await ctx.auth.getUserIdentity()) === null) return null;
  return roles === undefined ? await requireMember(ctx, hotelId) : await requireRole(ctx, hotelId, roles);
}

/** Can this member accept / work tasks of the department? Managers always can. */
export function canWorkDepartment(
  membership: Doc<"memberships">,
  departmentId: Id<"departments">,
): boolean {
  if (membership.role === "manager") return true;
  return (membership.departmentIds ?? []).includes(departmentId);
}

/** Can this member see tasks of the department? Staff only see their own departments. */
export function canSeeDepartment(
  membership: Doc<"memberships">,
  departmentId: Id<"departments">,
): boolean {
  if (membership.role !== "staff") return true;
  return (membership.departmentIds ?? []).includes(departmentId);
}

/**
 * Resolve a room token (the guest credential) to its hotel, room and active
 * stay. Returns null for unknown or inactive rooms.
 */
export async function guestContext(
  ctx: Ctx,
  token: string,
): Promise<{ hotel: Doc<"hotels">; room: Doc<"rooms">; stay: Doc<"stays"> | null } | null> {
  if (token.length < 8 || token.length > 64) return null;
  const room = await ctx.db
    .query("rooms")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (room === null || !room.active) return null;
  const hotel = await ctx.db.get("hotels", room.hotelId);
  if (hotel === null) return null;
  let stay: Doc<"stays"> | null = null;
  if (room.currentStayId !== undefined) {
    const s = await ctx.db.get("stays", room.currentStayId);
    if (s !== null && s.status === "active" && s.roomId === room._id) stay = s;
  }
  return { hotel, room, stay };
}

/** A new stay PIN (4 digits) and the long key the guest's phone receives after unlocking. */
export function newStayCredentials(): { guestPin: string; guestKey: string } {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return { guestPin: String(buf[0] % 10000).padStart(4, "0"), guestKey: randomToken(24) };
}

/** Does this stay require the guest's key for requests? (Hotel setting, default on.) */
export function stayNeedsKey(hotel: Doc<"hotels">, stay: Doc<"stays">): boolean {
  return hotel.requireGuestPin !== false && stay.guestKey !== undefined;
}

/** URL-safe random token, used for room NFC/QR links. */
export function randomToken(bytes = 12): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 6-char join code without look-alike characters. */
export function randomJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  let code = "";
  for (const b of buf) code += alphabet[b % alphabet.length];
  return code;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "hotel"}-${randomToken(3).toLowerCase()}`;
}

// ---- small validation helpers --------------------------------------------

/** Trim and length-check a required string. */
export function cleanText(value: string, field: string, max: number, min = 1): string {
  const s = value.trim();
  if (s.length < min) fail("INVALID", `${field} is required`);
  if (s.length > max) fail("INVALID", `${field} must be at most ${max} characters`);
  return s;
}

/** Trim an optional string; empty becomes undefined. */
export function cleanOptionalText(
  value: string | undefined,
  field: string,
  max: number,
): string | undefined {
  if (value === undefined) return undefined;
  const s = value.trim();
  if (s.length === 0) return undefined;
  if (s.length > max) fail("INVALID", `${field} must be at most ${max} characters`);
  return s;
}

/** Integer within [min, max]; rejects NaN / Infinity / fractions. */
export function checkInt(value: number, field: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail("INVALID", `${field} must be a whole number between ${min} and ${max}`);
  }
  return value;
}

/** Finite number within [min, max]. */
export function checkNumber(value: number, field: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    fail("INVALID", `${field} must be between ${min} and ${max}`);
  }
  return value;
}

export function checkTimestamp(value: number, field: string): number {
  // 2020-01-01 .. 2100-01-01
  return checkNumber(value, field, 1577836800000, 4102444800000);
}

/** Load a department and verify it belongs to the hotel and is not archived. */
export async function requireDepartment(
  ctx: Ctx,
  hotelId: Id<"hotels">,
  departmentId: Id<"departments">,
): Promise<Doc<"departments">> {
  const dept = await ctx.db.get("departments", departmentId);
  if (dept === null || dept.hotelId !== hotelId || dept.archived) {
    fail("NOT_FOUND", "Department not found");
  }
  return dept;
}
