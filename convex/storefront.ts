import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { cleanOptionalText, cleanText, fail, requireRole } from "./lib/access";
import { getSettings, seedStorefrontDefaults } from "./lib/storefrontDefaults";
import schema, {
  catalogSectionValidator,
  storefrontSettingsFields,
  tileFactValidator,
  tileHowItWorksValidator,
  tileSizeValidator,
  tileToneValidator,
  tileTypeValidator,
} from "./schema";

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const settingsValidator = v.object(storefrontSettingsFields);

type TileFields = Omit<Doc<"storefrontTiles">, "_id" | "_creationTime" | "hotelId" | "sortOrder">;

function cleanList(list: string[] | undefined, field: string, maxItems: number, maxLen: number) {
  if (list === undefined) return undefined;
  const out = list.map((s) => s.trim()).filter(Boolean);
  if (out.length > maxItems) fail("INVALID", `${field}: at most ${maxItems} entries`);
  for (const s of out) if (s.length > maxLen) fail("INVALID", `${field}: entry too long`);
  return out;
}

/** Validate and normalise a complete tile. */
function validateTile(t: TileFields): TileFields {
  const icon = t.icon.trim();
  if (!KEY_RE.test(icon)) fail("INVALID", "Icon must be a short lowercase key");
  let itemKey = t.itemKey?.trim();
  if (itemKey === "") itemKey = undefined;
  if (itemKey !== undefined && !KEY_RE.test(itemKey)) fail("INVALID", "Invalid item key");
  const facts = t.facts?.map((f) => ({
    value: cleanText(f.value, "Fact value", 16),
    label: cleanText(f.label, "Fact label", 40),
  }));
  if (facts && facts.length > 6) fail("INVALID", "At most 6 facts");
  const howItWorks = t.howItWorks?.map((h) => ({
    title: cleanText(h.title, "Step title", 80),
    body: cleanText(h.body, "Step text", 300, 0),
  }));
  if (howItWorks && howItWorks.length > 5) fail("INVALID", "At most 5 how-it-works steps");
  return {
    ...t,
    title: cleanText(t.title, "Title", 80),
    blurb: cleanText(t.blurb, "Blurb", 240, 0),
    icon,
    navLabel: cleanOptionalText(t.navLabel, "Nav label", 24),
    itemKey,
    slots: cleanList(t.slots, "Slots", 12, 20),
    options: cleanList(t.options, "Options", 6, 40),
    facts,
    hours: cleanOptionalText(t.hours, "Hours", 60),
    body: cleanOptionalText(t.body, "Body", 2000),
    howItWorks,
  };
}

async function hotelTiles(ctx: MutationCtx, hotelId: Id<"hotels">) {
  return await ctx.db
    .query("storefrontTiles")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .take(100);
}

async function loadTileAsManager(ctx: MutationCtx, tileId: Id<"storefrontTiles">) {
  const tile = await ctx.db.get("storefrontTiles", tileId);
  if (tile === null) fail("NOT_FOUND", "Tile not found");
  await requireRole(ctx, tile.hotelId, ["manager"]);
  return tile;
}

export const get = query({
  args: { hotelId: v.id("hotels") },
  returns: v.object({
    settings: settingsValidator,
    tiles: v.array(schema.doc("storefrontTiles")),
  }),
  handler: async (ctx, { hotelId }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    const { settings } = await getSettings(ctx, hotelId);
    const tiles = await ctx.db
      .query("storefrontTiles")
      .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
      .take(100);
    return { settings, tiles: tiles.sort((a, b) => a.sortOrder - b.sortOrder) };
  },
});

/** Partial update of the hero copy; an empty footerNote clears it. */
export const updateSettings = mutation({
  args: {
    hotelId: v.id("hotels"),
    heroEyebrow: v.optional(v.string()),
    heroTitle: v.optional(v.string()),
    heroHighlight: v.optional(v.string()),
    heroTitleEnd: v.optional(v.string()),
    heroSubtitle: v.optional(v.string()),
    footerNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { hotelId, ...a }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    const { doc, settings } = await getSettings(ctx, hotelId);
    const next = {
      heroEyebrow:
        a.heroEyebrow !== undefined ? cleanText(a.heroEyebrow, "Eyebrow", 80, 0) : settings.heroEyebrow,
      heroTitle: a.heroTitle !== undefined ? cleanText(a.heroTitle, "Title", 80, 0) : settings.heroTitle,
      heroHighlight:
        a.heroHighlight !== undefined
          ? cleanText(a.heroHighlight, "Highlight", 40, 0)
          : settings.heroHighlight,
      heroTitleEnd:
        a.heroTitleEnd !== undefined
          ? cleanText(a.heroTitleEnd, "Title end", 80, 0)
          : settings.heroTitleEnd,
      heroSubtitle:
        a.heroSubtitle !== undefined
          ? cleanText(a.heroSubtitle, "Subtitle", 300, 0)
          : settings.heroSubtitle,
      footerNote:
        a.footerNote !== undefined
          ? cleanOptionalText(a.footerNote, "Footer note", 300)
          : settings.footerNote,
    };
    if (doc) {
      await ctx.db.replace("storefronts", doc._id, { hotelId, ...next });
    } else {
      await ctx.db.insert("storefronts", { hotelId, ...next });
    }
    return null;
  },
});

export const createTile = mutation({
  args: {
    hotelId: v.id("hotels"),
    type: tileTypeValidator,
    title: v.string(),
    blurb: v.string(),
    icon: v.string(),
    tone: v.optional(tileToneValidator), // default "light"
    size: v.optional(tileSizeValidator), // default "normal"
    visible: v.optional(v.boolean()), // default true
    inNav: v.optional(v.boolean()), // default false
    navLabel: v.optional(v.string()),
    section: v.optional(catalogSectionValidator),
    itemKey: v.optional(v.string()),
    slots: v.optional(v.array(v.string())),
    options: v.optional(v.array(v.string())),
    facts: v.optional(v.array(tileFactValidator)),
    hours: v.optional(v.string()),
    body: v.optional(v.string()),
    howItWorks: v.optional(v.array(tileHowItWorksValidator)),
  },
  returns: v.id("storefrontTiles"),
  handler: async (ctx, { hotelId, tone, size, visible, inNav, ...rest }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    const tiles = await hotelTiles(ctx, hotelId);
    if (tiles.length >= 40) fail("LIMIT", "At most 40 tiles");
    const clean = validateTile({
      ...rest,
      tone: tone ?? "light",
      size: size ?? "normal",
      visible: visible ?? true,
      inNav: inNav ?? false,
    });
    const sortOrder = tiles.reduce((m, t) => Math.max(m, t.sortOrder + 1), 0);
    return await ctx.db.insert("storefrontTiles", { hotelId, ...clean, sortOrder });
  },
});

/** Partial update. For optional fields, `null` clears the value. */
export const updateTile = mutation({
  args: {
    tileId: v.id("storefrontTiles"),
    type: v.optional(tileTypeValidator),
    title: v.optional(v.string()),
    blurb: v.optional(v.string()),
    icon: v.optional(v.string()),
    tone: v.optional(tileToneValidator),
    size: v.optional(tileSizeValidator),
    visible: v.optional(v.boolean()),
    inNav: v.optional(v.boolean()),
    navLabel: v.optional(v.union(v.string(), v.null())),
    section: v.optional(v.union(catalogSectionValidator, v.null())),
    itemKey: v.optional(v.union(v.string(), v.null())),
    slots: v.optional(v.union(v.array(v.string()), v.null())),
    options: v.optional(v.union(v.array(v.string()), v.null())),
    facts: v.optional(v.union(v.array(tileFactValidator), v.null())),
    hours: v.optional(v.union(v.string(), v.null())),
    body: v.optional(v.union(v.string(), v.null())),
    howItWorks: v.optional(v.union(v.array(tileHowItWorksValidator), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, { tileId, ...changes }) => {
    const tile = await loadTileAsManager(ctx, tileId);
    const { _id, _creationTime, hotelId, sortOrder, ...current } = tile;
    void _id;
    void _creationTime;
    const merged: Record<string, unknown> = { ...current };
    for (const [k, val] of Object.entries(changes)) {
      if (val === undefined) continue;
      merged[k] = val === null ? undefined : val;
    }
    const clean = validateTile(merged as TileFields);
    await ctx.db.replace("storefrontTiles", tileId, { hotelId, sortOrder, ...clean });
    return null;
  },
});

export const removeTile = mutation({
  args: { tileId: v.id("storefrontTiles") },
  returns: v.null(),
  handler: async (ctx, { tileId }) => {
    const tile = await ctx.db.get("storefrontTiles", tileId);
    if (tile === null) return null;
    await requireRole(ctx, tile.hotelId, ["manager"]);
    await ctx.db.delete("storefrontTiles", tileId);
    return null;
  },
});

/** Set sortOrder by position in `tileIds`. */
export const reorderTiles = mutation({
  args: { hotelId: v.id("hotels"), tileIds: v.array(v.id("storefrontTiles")) },
  returns: v.null(),
  handler: async (ctx, { hotelId, tileIds }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    if (tileIds.length > 100) fail("INVALID", "Too many tiles");
    for (let i = 0; i < tileIds.length; i++) {
      const tile = await ctx.db.get("storefrontTiles", tileIds[i]);
      if (tile === null || tile.hotelId !== hotelId) fail("NOT_FOUND", "Tile not found");
      if (tile.sortOrder !== i) await ctx.db.patch("storefrontTiles", tile._id, { sortOrder: i });
    }
    return null;
  },
});

/** Default hero copy, tiles, resort events and storefront catalog items. Idempotent. */
export const seedDefaults = mutation({
  args: { hotelId: v.id("hotels") },
  returns: v.object({
    settingsCreated: v.boolean(),
    tilesInserted: v.number(),
    eventsInserted: v.number(),
    itemsInserted: v.number(),
  }),
  handler: async (ctx, { hotelId }) => {
    await requireRole(ctx, hotelId, ["manager"]);
    return await seedStorefrontDefaults(ctx, hotelId);
  },
});
