import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  checkInt,
  checkNumber,
  cleanOptionalText,
  cleanText,
  fail,
  requireDepartment,
  requireMember,
  requireRole,
} from "./lib/access";
import { seedCatalogDefaults } from "./lib/defaults";
import { MAX_STEPS } from "./lib/tasks";
import schema, { catalogKindValidator, catalogSectionValidator, SECTIONS } from "./schema";

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ICON_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function sortCatalog<T extends Pick<Doc<"catalogItems">, "section" | "sortOrder">>(
  items: T[],
): T[] {
  const rank = (s: string) => {
    const i = (SECTIONS as readonly string[]).indexOf(s);
    return i === -1 ? SECTIONS.length : i;
  };
  return items.sort((a, b) => rank(a.section) - rank(b.section) || a.sortOrder - b.sortOrder);
}

export async function catalogForHotel(ctx: QueryCtx, hotelId: Id<"hotels">) {
  // Archived items never count toward the cap.
  const rows = await ctx.db
    .query("catalogItems")
    .withIndex("by_hotelId_and_archived", (q) => q.eq("hotelId", hotelId).eq("archived", false))
    .take(500);
  return sortCatalog(rows);
}

async function loadItemAsManager(ctx: MutationCtx, itemId: Id<"catalogItems">) {
  const item = await ctx.db.get("catalogItems", itemId);
  if (item === null || item.archived) fail("NOT_FOUND", "Item not found");
  await requireRole(ctx, item.hotelId, ["manager"]);
  return item;
}

type ItemFields = Omit<Doc<"catalogItems">, "_id" | "_creationTime" | "hotelId" | "sortOrder" | "archived">;

/** Validate a complete item (after merging an update) and normalise strings. */
async function validateItem(
  ctx: MutationCtx,
  hotelId: Id<"hotels">,
  f: ItemFields,
  selfId: Id<"catalogItems"> | null,
): Promise<ItemFields> {
  const out: ItemFields = {
    ...f,
    title: cleanText(f.title, "Title", 120),
    guestTitle: cleanText(f.guestTitle, "Guest title", 120),
    guestDescription: cleanOptionalText(f.guestDescription, "Guest description", 600),
    steps: f.steps.map((s) => s.trim()).filter(Boolean),
  };
  if (out.steps.length > MAX_STEPS) fail("INVALID", `At most ${MAX_STEPS} steps`);
  for (const s of out.steps) if (s.length > 400) fail("INVALID", "A step is too long (max 400)");

  if (f.key !== undefined) {
    const key = f.key.trim().toLowerCase();
    if (!KEY_RE.test(key)) fail("INVALID", "Key must be a lowercase slug (a-z, 0-9, -)");
    const clash = await ctx.db
      .query("catalogItems")
      .withIndex("by_hotelId_and_key", (q) => q.eq("hotelId", hotelId).eq("key", key))
      .first();
    if (clash && clash._id !== selfId) fail("DUPLICATE", `Key "${key}" is already used`);
    out.key = key;
  }
  if (f.icon !== undefined) {
    const icon = f.icon.trim();
    if (!ICON_RE.test(icon)) fail("INVALID", "Icon must be a short lowercase key");
    out.icon = icon;
  }
  if (f.kind === "request" || f.kind === "offer" || f.kind === "internal") {
    if (f.departmentId === undefined) {
      fail("INVALID", "Requests, offers and internal playbooks need a department");
    }
  }
  if (f.departmentId !== undefined) await requireDepartment(ctx, hotelId, f.departmentId);
  if (f.kind === "link") {
    const url = f.url?.trim();
    if (!url || !/^https?:\/\/\S+$/.test(url) || url.length > 500) {
      fail("INVALID", "Links need a valid http(s) URL");
    }
    out.url = url;
  } else if (f.url !== undefined) {
    const url = f.url.trim();
    if (!/^https?:\/\/\S+$/.test(url) || url.length > 500) fail("INVALID", "Invalid URL");
    out.url = url;
  }
  if (f.price !== undefined) out.price = checkNumber(f.price, "Price", 0, 100000);
  if (f.maxQuantity !== undefined) out.maxQuantity = checkInt(f.maxQuantity, "Max quantity", 1, 99);
  if (f.estimatedMinutes !== undefined)
    out.estimatedMinutes = checkInt(f.estimatedMinutes, "Estimated minutes", 1, 1440);
  return out;
}

const itemListValidator = schema.doc("catalogItems").extend({
  departmentName: v.optional(v.string()),
});

export const list = query({
  args: { hotelId: v.id("hotels") },
  returns: v.array(itemListValidator),
  handler: async (ctx, { hotelId }) => {
    await requireMember(ctx, hotelId);
    const items = await catalogForHotel(ctx, hotelId);
    const names = new Map<Id<"departments">, string | undefined>();
    const out = [];
    for (const item of items) {
      let departmentName: string | undefined;
      if (item.departmentId) {
        if (!names.has(item.departmentId)) {
          names.set(item.departmentId, (await ctx.db.get("departments", item.departmentId))?.name);
        }
        departmentName = names.get(item.departmentId);
      }
      out.push({ ...item, departmentName });
    }
    return out;
  },
});

export const create = mutation({
  args: {
    hotelId: v.id("hotels"),
    key: v.optional(v.string()),
    kind: catalogKindValidator,
    section: catalogSectionValidator,
    title: v.string(),
    guestTitle: v.string(),
    guestDescription: v.optional(v.string()),
    icon: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    price: v.optional(v.number()),
    allowQuantity: v.boolean(),
    maxQuantity: v.optional(v.number()),
    allowNote: v.boolean(),
    steps: v.array(v.string()),
    estimatedMinutes: v.optional(v.number()),
    url: v.optional(v.string()),
    visible: v.optional(v.boolean()),
  },
  returns: v.id("catalogItems"),
  handler: async (ctx, { hotelId, visible, ...fields }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    const existing = await ctx.db
      .query("catalogItems")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .take(300);
    if (existing.filter((i) => !i.archived).length >= 200) fail("LIMIT", "At most 200 items");
    const clean = await validateItem(ctx, hotelId, { ...fields, visible: visible ?? true }, null);
    const sortOrder = existing
      .filter((i) => i.section === clean.section)
      .reduce((m, i) => Math.max(m, i.sortOrder + 1), 0);
    return await ctx.db.insert("catalogItems", {
      hotelId,
      ...clean,
      sortOrder,
      archived: false,
    });
  },
});

/**
 * Partial update. For optional fields, `null` clears the value and an omitted
 * field is left unchanged.
 */
export const update = mutation({
  args: {
    itemId: v.id("catalogItems"),
    key: v.optional(v.union(v.string(), v.null())),
    kind: v.optional(catalogKindValidator),
    section: v.optional(catalogSectionValidator),
    title: v.optional(v.string()),
    guestTitle: v.optional(v.string()),
    guestDescription: v.optional(v.union(v.string(), v.null())),
    icon: v.optional(v.union(v.string(), v.null())),
    departmentId: v.optional(v.union(v.id("departments"), v.null())),
    price: v.optional(v.union(v.number(), v.null())),
    allowQuantity: v.optional(v.boolean()),
    maxQuantity: v.optional(v.union(v.number(), v.null())),
    allowNote: v.optional(v.boolean()),
    steps: v.optional(v.array(v.string())),
    estimatedMinutes: v.optional(v.union(v.number(), v.null())),
    url: v.optional(v.union(v.string(), v.null())),
    visible: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, ...changes }) => {
    const item = await loadItemAsManager(ctx, itemId);
    const { _id, _creationTime, hotelId, sortOrder, archived, ...current } = item;
    void _id;
    void _creationTime;
    void sortOrder;
    void archived;
    const merged: Record<string, unknown> = { ...current };
    for (const [k, val] of Object.entries(changes)) {
      if (val === undefined) continue;
      merged[k] = val === null ? undefined : val;
    }
    const clean = await validateItem(ctx, hotelId, merged as ItemFields, itemId);
    // replace() so cleared optional fields are really removed.
    await ctx.db.replace("catalogItems", itemId, {
      ...clean,
      hotelId,
      sortOrder: item.sortOrder,
      archived: item.archived,
    });
    return null;
  },
});

export const setVisible = mutation({
  args: { itemId: v.id("catalogItems"), visible: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { itemId, visible }) => {
    await loadItemAsManager(ctx, itemId);
    await ctx.db.patch("catalogItems", itemId, { visible });
    return null;
  },
});

/** Archive (soft delete). Existing tasks keep their copy of the steps. */
export const remove = mutation({
  args: { itemId: v.id("catalogItems") },
  returns: v.null(),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("catalogItems", itemId);
    if (item === null || item.archived) return null;
    await requireRole(ctx, item.hotelId, ["manager"]);
    // Free the key so it can be reused by a new item.
    await ctx.db.replace("catalogItems", itemId, {
      ...stripSystem(item),
      key: undefined,
      archived: true,
      visible: false,
    });
    return null;
  },
});

function stripSystem(item: Doc<"catalogItems">) {
  const { _id, _creationTime, ...rest } = item;
  void _id;
  void _creationTime;
  return rest;
}

/** Set sortOrder by position in `itemIds`. */
export const reorder = mutation({
  args: { hotelId: v.id("hotels"), itemIds: v.array(v.id("catalogItems")) },
  returns: v.null(),
  handler: async (ctx, { hotelId, itemIds }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    if (itemIds.length > 300) fail("INVALID", "Too many items");
    for (let i = 0; i < itemIds.length; i++) {
      const item = await ctx.db.get("catalogItems", itemIds[i]);
      if (item === null || item.hotelId !== hotelId) fail("NOT_FOUND", "Item not found");
      if (item.sortOrder !== i) await ctx.db.patch("catalogItems", item._id, { sortOrder: i });
    }
    return null;
  },
});

/** Insert the default Gino catalog items that are missing (by key). */
export const seedDefaults = mutation({
  args: { hotelId: v.id("hotels") },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { hotelId }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    const inserted = await seedCatalogDefaults(ctx, hotelId);
    return { inserted };
  },
});
