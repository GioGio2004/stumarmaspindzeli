import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { catalogKindValidator, catalogSectionValidator, SECTIONS, tileFields } from "../schema";

/** A catalog item as the guest app sees it. Internal playbooks are never included. */
export const guestItemValidator = v.object({
  id: v.id("catalogItems"),
  key: v.optional(v.string()),
  kind: catalogKindValidator,
  section: catalogSectionValidator,
  title: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  price: v.optional(v.number()),
  allowQuantity: v.boolean(),
  maxQuantity: v.optional(v.number()),
  allowNote: v.boolean(),
  url: v.optional(v.string()),
  minutes: v.optional(v.number()),
  departmentName: v.optional(v.string()),
});

const rank = (s: string) => {
  const i = (SECTIONS as readonly string[]).indexOf(s);
  return i === -1 ? SECTIONS.length : i;
};

/** Visible, non-archived, guest-facing items of a hotel, sorted by section then order. */
export async function guestItems(ctx: QueryCtx, hotelId: Id<"hotels">) {
  const rows = await ctx.db
    .query("catalogItems")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .take(300);
  const items = rows
    .filter((i) => i.visible && !i.archived && i.kind !== "internal")
    .sort((a, b) => rank(a.section) - rank(b.section) || a.sortOrder - b.sortOrder);
  const names = new Map<Id<"departments">, string | undefined>();
  const out = [];
  for (const i of items) {
    let departmentName: string | undefined;
    if (i.departmentId) {
      if (!names.has(i.departmentId)) {
        const d = await ctx.db.get("departments", i.departmentId);
        names.set(i.departmentId, d && !d.archived ? d.name : undefined);
      }
      departmentName = names.get(i.departmentId);
    }
    out.push({
      id: i._id,
      key: i.key,
      kind: i.kind,
      section: i.section,
      title: i.guestTitle,
      description: i.guestDescription,
      icon: i.icon,
      price: i.price,
      allowQuantity: i.allowQuantity,
      maxQuantity: i.allowQuantity ? (i.maxQuantity ?? 9) : undefined,
      allowNote: i.allowNote,
      url: i.url,
      minutes: i.estimatedMinutes,
      departmentName,
    });
  }
  return out;
}

const { visible: _visible, ...tileDisplayFields } = tileFields;
void _visible;

/** A storefront tile as the guest app sees it (visible tiles only). */
export const guestTileValidator = v.object({ id: v.id("storefrontTiles"), ...tileDisplayFields });

export async function guestTiles(ctx: QueryCtx, hotelId: Id<"hotels">) {
  const rows = await ctx.db
    .query("storefrontTiles")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .take(100);
  return rows
    .filter((t) => t.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t: Doc<"storefrontTiles">) => {
      const { _id, _creationTime, hotelId: _h, sortOrder: _s, visible: _v, ...display } = t;
      void _creationTime;
      void _h;
      void _s;
      void _v;
      return { id: _id, ...display };
    });
}

export const guestEventValidator = v.object({
  id: v.id("resortEvents"),
  time: v.string(),
  title: v.string(),
  place: v.optional(v.string()),
  daysOfWeek: v.optional(v.array(v.number())),
});

export async function guestEvents(ctx: QueryCtx, hotelId: Id<"hotels">) {
  const rows = await ctx.db
    .query("resortEvents")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .take(100);
  return rows
    .filter((e) => e.visible)
    .sort((a, b) => a.time.localeCompare(b.time) || a.sortOrder - b.sortOrder)
    .map((e) => ({
      id: e._id,
      time: e.time,
      title: e.title,
      place: e.place,
      daysOfWeek: e.daysOfWeek,
    }));
}
