/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as departments from "../departments.js";
import type * as escalation from "../escalation.js";
import type * as guest_ai from "../guest/ai.js";
import type * as guest_catalog from "../guest/catalog.js";
import type * as guest_events from "../guest/events.js";
import type * as guest_pin from "../guest/pin.js";
import type * as guest_requests from "../guest/requests.js";
import type * as guest_session from "../guest/session.js";
import type * as guest_storefront from "../guest/storefront.js";
import type * as hotels from "../hotels.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_defaults from "../lib/defaults.js";
import type * as lib_guestPayload from "../lib/guestPayload.js";
import type * as lib_invitations from "../lib/invitations.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_storefrontDefaults from "../lib/storefrontDefaults.js";
import type * as lib_supervisor from "../lib/supervisor.js";
import type * as lib_tasks from "../lib/tasks.js";
import type * as maintenance from "../maintenance.js";
import type * as members from "../members.js";
import type * as platform from "../platform.js";
import type * as push from "../push.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as resortEvents from "../resortEvents.js";
import type * as rooms from "../rooms.js";
import type * as routines from "../routines.js";
import type * as seed from "../seed.js";
import type * as stats from "../stats.js";
import type * as stays from "../stays.js";
import type * as storefront from "../storefront.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  catalog: typeof catalog;
  crons: typeof crons;
  departments: typeof departments;
  escalation: typeof escalation;
  "guest/ai": typeof guest_ai;
  "guest/catalog": typeof guest_catalog;
  "guest/events": typeof guest_events;
  "guest/pin": typeof guest_pin;
  "guest/requests": typeof guest_requests;
  "guest/session": typeof guest_session;
  "guest/storefront": typeof guest_storefront;
  hotels: typeof hotels;
  http: typeof http;
  invitations: typeof invitations;
  "lib/access": typeof lib_access;
  "lib/defaults": typeof lib_defaults;
  "lib/guestPayload": typeof lib_guestPayload;
  "lib/invitations": typeof lib_invitations;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/stats": typeof lib_stats;
  "lib/storefrontDefaults": typeof lib_storefrontDefaults;
  "lib/supervisor": typeof lib_supervisor;
  "lib/tasks": typeof lib_tasks;
  maintenance: typeof maintenance;
  members: typeof members;
  platform: typeof platform;
  push: typeof push;
  pushSubscriptions: typeof pushSubscriptions;
  resortEvents: typeof resortEvents;
  rooms: typeof rooms;
  routines: typeof routines;
  seed: typeof seed;
  stats: typeof stats;
  stays: typeof stays;
  storefront: typeof storefront;
  tasks: typeof tasks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};
