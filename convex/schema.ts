import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ---- shared validators -------------------------------------------------

export const roleValidator = v.union(
  v.literal("manager"),
  v.literal("reception"),
  v.literal("staff"),
);

export const taskSourceValidator = v.union(
  v.literal("guest"),
  v.literal("staff"),
  v.literal("manager"),
);

export const taskStatusValidator = v.union(
  v.literal("open"), // created, nobody accepted it yet
  v.literal("accepted"), // a staff member took it
  v.literal("in_progress"), // first step ticked / started
  v.literal("done"),
  v.literal("cancelled"),
);

export const taskPriorityValidator = v.union(v.literal("normal"), v.literal("high"));

export const stayStatusValidator = v.union(v.literal("active"), v.literal("checked_out"));

export const catalogKindValidator = v.union(
  v.literal("request"),
  v.literal("offer"),
  v.literal("info"),
  v.literal("link"),
  v.literal("internal"), // staff-only playbook template, never shown to guests
);

export const SECTIONS = [
  "housekeeping",
  "dining",
  "spa",
  "aquapark",
  "stay",
  "hotels",
  "other",
] as const;

export const catalogSectionValidator = v.union(
  v.literal("housekeeping"),
  v.literal("dining"),
  v.literal("spa"),
  v.literal("aquapark"),
  v.literal("stay"),
  v.literal("hotels"),
  v.literal("other"),
);

export const guestEventKindValidator = v.union(
  v.literal("open_app"),
  v.literal("view_feature"),
  v.literal("request"),
  v.literal("rate"),
);

export const routineScopeValidator = v.union(
  v.literal("once"),
  v.literal("each_occupied_room"),
  v.literal("each_room"),
);

export const tileTypeValidator = v.union(
  v.literal("requests"),
  v.literal("menu"),
  v.literal("booking"),
  v.literal("ticket"),
  v.literal("concierge"),
  v.literal("events"),
  v.literal("stay"),
  v.literal("links"),
  v.literal("checkout"),
  v.literal("info"),
);

export const tileToneValidator = v.union(v.literal("light"), v.literal("dark"));
export const tileSizeValidator = v.union(v.literal("normal"), v.literal("wide"));
export const tileFactValidator = v.object({ value: v.string(), label: v.string() });
export const tileHowItWorksValidator = v.object({ title: v.string(), body: v.string() });

export const storefrontSettingsFields = {
  heroEyebrow: v.string(),
  heroTitle: v.string(),
  heroHighlight: v.string(),
  heroTitleEnd: v.string(),
  heroSubtitle: v.string(),
  footerNote: v.optional(v.string()),
};

/** Display fields of a storefront tile (everything except hotelId / sortOrder). */
export const tileFields = {
  type: tileTypeValidator,
  title: v.string(),
  blurb: v.string(),
  icon: v.string(),
  tone: tileToneValidator,
  size: tileSizeValidator,
  visible: v.boolean(),
  inNav: v.boolean(),
  navLabel: v.optional(v.string()),
  section: v.optional(catalogSectionValidator),
  itemKey: v.optional(v.string()),
  slots: v.optional(v.array(v.string())), // max 12
  options: v.optional(v.array(v.string())), // max 6
  facts: v.optional(v.array(tileFactValidator)), // max 6
  hours: v.optional(v.string()),
  body: v.optional(v.string()), // max 2000
  howItWorks: v.optional(v.array(tileHowItWorksValidator)), // max 5
};

export const taskStepValidator = v.object({
  text: v.string(),
  doneAt: v.optional(v.number()),
  doneByUserId: v.optional(v.id("users")),
});

// ---- schema ------------------------------------------------------------

const schema = defineSchema({
  // Mirror of Clerk users, kept in sync by the Clerk webhook (convex/http.ts).
  users: defineTable({
    externalId: v.string(), // Clerk user id
    name: v.string(),
    email: v.optional(v.string()), // verified by Clerk only; never taken from the client
    imageUrl: v.optional(v.string()),
    profileSyncedAt: v.optional(v.number()), // set once the verified email was read from Clerk
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"]),

  // Email invitations sent through Clerk (sign-up is invitation-only).
  // Accepted automatically when a user with that email signs in.
  invitations: defineTable({
    hotelId: v.id("hotels"),
    email: v.string(), // lowercase
    role: roleValidator,
    departmentIds: v.array(v.id("departments")), // max 12
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked"), v.literal("failed")),
    clerkInvitationId: v.optional(v.string()),
    inviteUrl: v.optional(v.string()), // Clerk's sign-up link, shareable outside email
    error: v.optional(v.string()),
    invitedByUserId: v.id("users"),
    acceptedByUserId: v.optional(v.id("users")),
  })
    .index("by_hotelId", ["hotelId"])
    .index("by_email_and_status", ["email", "status"]),

  // One hotel. Created by its first manager.
  hotels: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerUserId: v.id("users"),
    joinCode: v.string(), // staff enter this once to join the hotel
    defaultLanguage: v.string(), // BCP-47, e.g. "ka"
    address: v.optional(v.string()),
    wifiName: v.optional(v.string()),
    wifiPassword: v.optional(v.string()),
    phone: v.optional(v.string()),
    checkoutTime: v.optional(v.string()), // "12:00"
    timezone: v.optional(v.string()), // IANA, default "Asia/Tbilisi"
    guestLanguages: v.optional(v.array(v.string())), // max 8
    brandName: v.optional(v.string()),
    collection: v.optional(v.string()), // "Trademark Collection by Wyndham"
    requireGuestPin: v.optional(v.boolean()), // default off: when on, guests confirm with the stay PIN
  })
    .index("by_slug", ["slug"])
    .index("by_joinCode", ["joinCode"])
    .index("by_ownerUserId", ["ownerUserId"]),

  // Staff membership: which users work at which hotel, and in what role.
  memberships: defineTable({
    hotelId: v.id("hotels"),
    userId: v.id("users"),
    role: roleValidator,
    onShift: v.boolean(),
    completedTaskCount: v.number(),
    departmentIds: v.optional(v.array(v.id("departments"))), // max 12
  })
    .index("by_hotelId", ["hotelId"])
    .index("by_userId", ["userId"])
    .index("by_hotelId_and_userId", ["hotelId", "userId"])
    .index("by_hotelId_and_onShift", ["hotelId", "onShift"])
    .index("by_hotelId_and_role", ["hotelId", "role"]),

  departments: defineTable({
    hotelId: v.id("hotels"),
    name: v.string(),
    icon: v.string(), // key, e.g. "housekeeping"
    escalationMinutes: v.number(),
    sortOrder: v.number(),
    archived: v.boolean(),
  }).index("by_hotelId", ["hotelId"]),

  // Physical rooms. `token` is the unguessable id embedded in the NFC tag / QR.
  rooms: defineTable({
    hotelId: v.id("hotels"),
    number: v.string(), // "213"
    floor: v.optional(v.string()),
    token: v.string(),
    active: v.boolean(), // false = guest link disabled
    currentStayId: v.optional(v.id("stays")),
  })
    .index("by_hotelId", ["hotelId"])
    .index("by_token", ["token"])
    .index("by_hotelId_and_number", ["hotelId", "number"]),

  // A guest stay in a room. No personal documents, only a short label.
  stays: defineTable({
    hotelId: v.id("hotels"),
    roomId: v.id("rooms"),
    status: stayStatusValidator,
    guestLabel: v.optional(v.string()),
    language: v.optional(v.string()),
    adults: v.optional(v.number()),
    children: v.optional(v.number()),
    checkInAt: v.number(),
    expectedCheckOutAt: v.number(),
    checkedOutAt: v.optional(v.number()),
    pmsRef: v.optional(v.string()),
    note: v.optional(v.string()),
    purgedAt: v.optional(v.number()), // retention job cleared guest notes
    // Guests unlock requests with this 4-digit PIN (told by reception); the
    // unlock returns guestKey, a long random secret the phone then sends.
    guestPin: v.optional(v.string()),
    guestKey: v.optional(v.string()),
  })
    .index("by_roomId_and_status", ["roomId", "status"])
    .index("by_hotelId_and_status", ["hotelId", "status"])
    .index("by_status_and_expectedCheckOutAt", ["status", "expectedCheckOutAt"])
    .index("by_status_and_purgedAt_and_checkedOutAt", ["status", "purgedAt", "checkedOutAt"]),

  // What guests can request / book / read, plus the staff playbook.
  catalogItems: defineTable({
    hotelId: v.id("hotels"),
    key: v.optional(v.string()), // stable slug, unique per hotel
    kind: catalogKindValidator,
    section: catalogSectionValidator,
    title: v.string(), // staff-facing
    guestTitle: v.string(),
    guestDescription: v.optional(v.string()),
    icon: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")), // required for request/offer
    price: v.optional(v.number()), // GEL
    allowQuantity: v.boolean(),
    maxQuantity: v.optional(v.number()),
    allowNote: v.boolean(),
    steps: v.array(v.string()), // playbook for staff, max 20
    estimatedMinutes: v.optional(v.number()),
    url: v.optional(v.string()), // for kind "link"
    visible: v.boolean(),
    sortOrder: v.number(),
    archived: v.boolean(),
  })
    .index("by_hotelId", ["hotelId"])
    .index("by_hotelId_and_key", ["hotelId", "key"])
    .index("by_hotelId_and_archived", ["hotelId", "archived"]),

  // A live task in the queue. Steps are copied at creation.
  tasks: defineTable({
    hotelId: v.id("hotels"),
    departmentId: v.id("departments"),
    itemId: v.optional(v.id("catalogItems")),
    stayId: v.optional(v.id("stays")),
    roomId: v.optional(v.id("rooms")),
    title: v.string(),
    detail: v.optional(v.string()),
    quantity: v.optional(v.number()),
    guestNote: v.optional(v.string()),
    source: taskSourceValidator,
    status: taskStatusValidator,
    priority: taskPriorityValidator,
    createdByUserId: v.optional(v.id("users")),
    assigneeUserId: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
    firstAcceptedAt: v.optional(v.number()), // kept on release; response time is counted once
    startedAt: v.optional(v.number()),
    doneAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    escalatedAt: v.optional(v.number()),
    steps: v.array(taskStepValidator), // max 20
    rating: v.optional(v.number()), // 1-5
    price: v.optional(v.number()),
  })
    .index("by_hotelId", ["hotelId"])
    .index("by_hotelId_and_status_and_doneAt", ["hotelId", "status", "doneAt"])
    .index("by_departmentId_and_status_and_doneAt", ["departmentId", "status", "doneAt"])
    .index("by_assigneeUserId_and_status", ["assigneeUserId", "status"])
    .index("by_stayId", ["stayId"])
    .index("by_roomId", ["roomId"]),

  guestEvents: defineTable({
    hotelId: v.id("hotels"),
    stayId: v.optional(v.id("stays")),
    roomId: v.optional(v.id("rooms")),
    kind: guestEventKindValidator,
    target: v.optional(v.string()),
  })
    .index("by_hotelId", ["hotelId"])
    .index("by_stayId", ["stayId"]),

  // Per-hotel per-day counters, maintained by the mutations that change tasks.
  dailyStats: defineTable({
    hotelId: v.id("hotels"),
    day: v.string(), // "YYYY-MM-DD" in the hotel timezone
    requests: v.number(),
    done: v.number(),
    responseMsTotal: v.number(), // created -> accepted
    responseCount: v.number(),
    completionMsTotal: v.number(), // created -> done
    completionCount: v.number(),
    appOpens: v.number(),
    byDepartment: v.record(v.string(), v.number()), // requests per department id
    byItem: v.record(v.string(), v.number()), // requests per item key
    featureViews: v.record(v.string(), v.number()),
    responseMsByDepartment: v.record(v.string(), v.number()),
    responseCountByDepartment: v.record(v.string(), v.number()),
  }).index("by_hotelId_and_day", ["hotelId", "day"]),

  // Recurring manager-defined work ("every day at 10:00, check each occupied room").
  routines: defineTable({
    hotelId: v.id("hotels"),
    itemId: v.id("catalogItems"),
    departmentId: v.id("departments"),
    title: v.optional(v.string()),
    daysOfWeek: v.array(v.number()), // 0 = Sunday .. 6 = Saturday
    time: v.string(), // "HH:MM" hotel time
    scope: routineScopeValidator,
    active: v.boolean(),
    lastRunDay: v.optional(v.string()), // "YYYY-MM-DD" hotel time
  })
    .index("by_hotelId", ["hotelId"])
    .index("by_active", ["active"]),

  // Guest storefront hero copy (one per hotel).
  storefronts: defineTable({
    hotelId: v.id("hotels"),
    ...storefrontSettingsFields,
  }).index("by_hotelId", ["hotelId"]),

  // Guest storefront tiles, in display order.
  storefrontTiles: defineTable({
    hotelId: v.id("hotels"),
    ...tileFields,
    sortOrder: v.number(),
  }).index("by_hotelId", ["hotelId"]),

  // "Today at the resort" schedule shown to guests.
  resortEvents: defineTable({
    hotelId: v.id("hotels"),
    time: v.string(), // "HH:MM"
    title: v.string(),
    place: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())), // undefined = every day
    visible: v.boolean(),
    sortOrder: v.number(),
  }).index("by_hotelId", ["hotelId"]),

  // Web Push subscriptions for the staff PWA. One row per device.
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  // Who may use a guest AI chat. The thread and its messages live in the agent
  // component; the phone keeps `secret` and sends it with every call.
  aiChats: defineTable({
    hotelId: v.id("hotels"),
    threadId: v.string(),
    secret: v.string(),
    roomId: v.optional(v.id("rooms")), // set when opened from a room tag
    stayId: v.optional(v.id("stays")), // the stay at that time; a new stay starts a new chat
  }).index("by_threadId", ["threadId"]),
});

export default schema;
