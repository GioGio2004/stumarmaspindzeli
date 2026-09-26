import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { insertMissingItems, seedCatalogDefaults, type DefaultItem } from "./defaults";

export type StorefrontSettings = {
  heroEyebrow: string;
  heroTitle: string;
  heroHighlight: string;
  heroTitleEnd: string;
  heroSubtitle: string;
  footerNote?: string;
};

export const DEFAULT_SETTINGS: StorefrontSettings = {
  heroEyebrow: "Welcome to Gino Seaside!",
  heroTitle: "Everything for your stay,",
  heroHighlight: "one tap",
  heroTitleEnd: "away",
  heroSubtitle:
    "Ask for anything, book the water park and spa, or chat with the concierge in your language.",
};

export async function getSettings(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<"hotels">,
): Promise<{ doc: Doc<"storefronts"> | null; settings: StorefrontSettings }> {
  const doc = await ctx.db
    .query("storefronts")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .first();
  if (doc === null) return { doc, settings: { ...DEFAULT_SETTINGS } };
  return {
    doc,
    settings: {
      heroEyebrow: doc.heroEyebrow,
      heroTitle: doc.heroTitle,
      heroHighlight: doc.heroHighlight,
      heroTitleEnd: doc.heroTitleEnd,
      heroSubtitle: doc.heroSubtitle,
      footerNote: doc.footerNote,
    },
  };
}

type TileInput = Omit<Doc<"storefrontTiles">, "_id" | "_creationTime" | "hotelId" | "sortOrder">;

const base = { tone: "light" as const, size: "normal" as const, visible: true, inNav: false };

export const DEFAULT_TILES: TileInput[] = [
  {
    ...base,
    type: "requests",
    title: "Room requests",
    blurb: "Towels, pillows, cleaning. Tap once and the right team is on it.",
    icon: "towel",
    size: "wide",
    section: "housekeeping",
    inNav: true,
    navLabel: "Requests",
    howItWorks: [
      { title: "Tap what you need", body: "Pick an item and how many." },
      { title: "Only the right team sees it", body: "Your request goes straight to them." },
      { title: "Track it live", body: "See when someone is on the way." },
      { title: "Done in minutes", body: "Most requests arrive within a few minutes." },
    ],
  },
  {
    ...base,
    type: "ticket",
    title: "Water park",
    blurb: "GINO Paradise is a short walk from your room.",
    icon: "aquapark",
    itemKey: "waterpark-pass",
    hours: "12:00–22:00",
    facts: [
      { value: "9", label: "pools" },
      { value: "31 m", label: "tallest slide" },
      { value: "13 ha", label: "of park" },
      { value: "12", label: "places to eat" },
    ],
    inNav: true,
    navLabel: "Water park",
    howItWorks: [
      { title: "Choose how many passes", body: "One pass per guest, kids included." },
      { title: "We charge your room", body: "No need to pay at the gate." },
      { title: "Pick up your wristbands", body: "Reception has them ready for you." },
    ],
  },
  {
    ...base,
    type: "concierge",
    title: "Ask the concierge",
    blurb: "Any question, in your language, day or night.",
    icon: "info",
    tone: "dark",
    howItWorks: [
      { title: "Write your question", body: "In any language you like." },
      { title: "Reception picks it up", body: "A real person answers, not a bot." },
      { title: "Get an answer here", body: "Follow the reply on this page." },
    ],
  },
  {
    ...base,
    type: "menu",
    title: "In-room dining",
    blurb: "Georgian classics to your door.",
    icon: "dining",
    tone: "dark",
    section: "dining",
    inNav: true,
    navLabel: "Dining",
    howItWorks: [
      { title: "Build your order", body: "Add dishes and drinks." },
      { title: "The kitchen starts cooking", body: "Your order goes straight to the kitchen." },
      { title: "Delivered to your room", body: "Charged to your room bill." },
    ],
  },
  {
    ...base,
    type: "booking",
    title: "Wellness & spa",
    blurb: "Hammam, wine baths and massages.",
    icon: "spa",
    section: "spa",
    slots: ["13:00", "14:30", "16:00", "17:30", "19:00"],
    inNav: true,
    navLabel: "Spa",
    howItWorks: [
      { title: "Pick a treatment", body: "See what the spa offers today." },
      { title: "Choose a time", body: "Tap a free slot." },
      { title: "The spa confirms", body: "We call your room to confirm." },
    ],
  },
  {
    ...base,
    type: "events",
    title: "Today at Gino",
    blurb: "What's on around the resort.",
    icon: "clock",
    inNav: true,
    navLabel: "Today",
    howItWorks: [
      { title: "See today's schedule", body: "Shows, classes and music." },
      { title: "Find the place", body: "Each event shows where it happens." },
      { title: "Just show up", body: "No booking needed." },
    ],
  },
  {
    ...base,
    type: "stay",
    title: "Your stay",
    blurb: "Wi-Fi, check-out and contacts.",
    icon: "info",
    howItWorks: [
      { title: "Connect to Wi-Fi", body: "Network name and password in one tap." },
      { title: "Check your dates", body: "See your check-out time." },
      { title: "Call reception", body: "One tap to reach the front desk." },
    ],
  },
  {
    ...base,
    type: "links",
    title: "Gino hotels",
    blurb: "Three places to stay across Georgia.",
    icon: "link",
    size: "wide",
    section: "hotels",
    howItWorks: [
      { title: "Browse our hotels", body: "Seaside, wellness and history." },
      { title: "Open the website", body: "See rooms and prices." },
      { title: "Book your next stay", body: "Ask reception for returning-guest rates." },
    ],
  },
  {
    ...base,
    type: "checkout",
    title: "Late check-out",
    blurb: "Stay a little longer on your last day.",
    icon: "clock",
    itemKey: "late-checkout",
    options: ["13:00", "14:00", "16:00"],
    howItWorks: [
      { title: "Pick a time", body: "Choose how long you want to stay." },
      { title: "Reception checks", body: "We confirm the room is free." },
      { title: "Get a confirmation", body: "You will see the answer here." },
    ],
  },
];

export const DEFAULT_EVENTS: { time: string; title: string; place: string }[] = [
  { time: "12:00", title: "Water park opens", place: "GINO Paradise" },
  { time: "14:00", title: "Aqua aerobics", place: "Wave pool" },
  { time: "17:30", title: "Kids animation", place: "Birthday center" },
  { time: "20:00", title: "Live music", place: "Lobby bar" },
];

const KITCHEN_STEPS = [
  "მიიღე შეკვეთა და გადაეცი სამზარეულოს.",
  "შეამოწმე, რომ კერძი მზადაა და სწორადაა გაფორმებული.",
  "მოამზადე ლანგარი, დანა-ჩანგალი და ხელსახოცი.",
  "მიიტანე ოთახში და გადაეცი სტუმარს; თანხა ჩაწერე ოთახის ანგარიშზე.",
];

const SPA_STEPS = [
  "წაიკითხე პროცედურა და სასურველი დრო.",
  "შეამოწმე თავისუფალი დრო სპა-ს კალენდარში.",
  "დაურეკე ოთახს და დაადასტურე ჯავშანი.",
  "ჩაწერე ჯავშანი და მოამზადე კაბინეტი.",
];

const dining = (
  key: string,
  title: string,
  guestTitle: string,
  price: number,
  guestDescription: string,
): DefaultItem => ({
  key,
  department: "kitchen",
  kind: "offer",
  section: "dining",
  title,
  guestTitle,
  guestDescription,
  icon: "dining",
  price,
  allowQuantity: true,
  maxQuantity: 9,
  allowNote: true,
  estimatedMinutes: 30,
  steps: KITCHEN_STEPS,
});

const spa = (
  key: string,
  title: string,
  guestTitle: string,
  minutes: number | undefined,
  guestDescription: string,
): DefaultItem => ({
  key,
  department: "spa",
  kind: "offer",
  section: "spa",
  title,
  guestTitle,
  guestDescription,
  icon: "spa",
  allowQuantity: false,
  allowNote: true,
  estimatedMinutes: minutes,
  steps: SPA_STEPS,
});

const link = (key: string, title: string, guestDescription: string, url: string): DefaultItem => ({
  key,
  kind: "link",
  section: "hotels",
  title,
  guestTitle: title,
  guestDescription,
  icon: "hotel",
  allowQuantity: false,
  allowNote: false,
  url,
  steps: [],
});

export const STOREFRONT_ITEMS: DefaultItem[] = [
  dining("khachapuri", "აჭარული ხაჭაპური", "Adjarian khachapuri", 24, "Cheese boat with butter and egg."),
  dining("khinkali", "ხინკალი, 5 ც.", "Khinkali, 5 pcs", 15, "Juicy Georgian dumplings."),
  dining("salad", "პომიდვრის სალათი ნიგვზით", "Tomato salad with walnuts", 16, "Fresh tomatoes, cucumbers and walnut dressing."),
  dining("lemonade", "ტარხუნის ლიმონათი", "Tarragon lemonade", 8, "The classic green Georgian lemonade."),
  dining("espresso", "ესპრესო", "Espresso", 6, "Freshly pulled, to your door."),
  spa("hot-stones", "ცხელი ქვებით თერაპია", "Hot stones therapy", 70, "Warm basalt stones melt away tension."),
  spa("hammam", "ჰამამი", "Hammam", 70, "Traditional steam bath with scrub and foam."),
  spa("swedish", "შვედური მასაჟი", "Swedish massage", 50, "Classic full-body massage."),
  spa("relax", "რელაქსაციური მასაჟი", "Relaxation massage", 60, "Slow, gentle massage to unwind."),
  spa("wine-bath", "ღვინის აბაზანა", "Wine bath", undefined, "A warm bath with Georgian grape extracts."),
  spa("milk-bath", "რძის აბაზანა", "Milk bath", undefined, "Soft, soothing milk bath."),
  link(
    "gino-seaside",
    "Gino Seaside Tbilisi",
    "5★ · 215 rooms on the Tbilisi Sea, steps from the water park",
    "https://ginoseaside.ginohotels.com/",
  ),
  link(
    "gino-mtskheta",
    "Gino Wellness Mtskheta",
    "Boutique wellness · 22 rooms, 15 km from Tbilisi",
    "https://ginohotels.com/",
  ),
  link(
    "gino-rabati",
    "Gino Wellness Rabati",
    "Boutique wellness · 37 rooms inside Rabati fortress, Akhaltsikhe",
    "https://ginohotels.com/",
  ),
];

/**
 * Seed the storefront: settings, the 9 default tiles and 4 resort events when
 * the hotel has none, and the missing catalog items (by key). Idempotent.
 */
export async function seedStorefrontDefaults(ctx: MutationCtx, hotelId: Id<"hotels">) {
  const { doc } = await getSettings(ctx, hotelId);
  const settingsCreated = doc === null;
  if (settingsCreated) await ctx.db.insert("storefronts", { hotelId, ...DEFAULT_SETTINGS });

  let tilesInserted = 0;
  const anyTile = await ctx.db
    .query("storefrontTiles")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .first();
  if (anyTile === null) {
    for (const [i, tile] of DEFAULT_TILES.entries()) {
      await ctx.db.insert("storefrontTiles", { hotelId, ...tile, sortOrder: i });
      tilesInserted++;
    }
  }

  let eventsInserted = 0;
  const anyEvent = await ctx.db
    .query("resortEvents")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .first();
  if (anyEvent === null) {
    for (const [i, e] of DEFAULT_EVENTS.entries()) {
      await ctx.db.insert("resortEvents", { hotelId, ...e, visible: true, sortOrder: i });
      eventsInserted++;
    }
  }

  const baseItems = await seedCatalogDefaults(ctx, hotelId);
  const inserted = await insertMissingItems(ctx, hotelId, STOREFRONT_ITEMS);

  // The per-dish / per-treatment items replace the old single catch-all items.
  const replaced: [string, string][] = [
    ["dinner-order", "dining"],
    ["spa-booking", "spa"],
  ];
  for (const [key, section] of replaced) {
    const newInSection = STOREFRONT_ITEMS.some(
      (i) => i.section === section && inserted.includes(i.key),
    );
    if (!newInSection) continue;
    const old = await ctx.db
      .query("catalogItems")
      .withIndex("by_hotelId_and_key", (q) => q.eq("hotelId", hotelId).eq("key", key))
      .first();
    if (old && old.visible) await ctx.db.patch("catalogItems", old._id, { visible: false });
  }

  return {
    settingsCreated,
    tilesInserted,
    eventsInserted,
    itemsInserted: baseItems + inserted.length,
  };
}
