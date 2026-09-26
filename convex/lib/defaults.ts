import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type DeptKey = "housekeeping" | "maintenance" | "kitchen" | "spa" | "reception";

export const DEFAULT_DEPARTMENTS: {
  icon: DeptKey;
  name: string;
  escalationMinutes: number;
}[] = [
  { icon: "housekeeping", name: "Housekeeping", escalationMinutes: 10 },
  { icon: "maintenance", name: "Maintenance", escalationMinutes: 20 },
  { icon: "kitchen", name: "Kitchen", escalationMinutes: 15 },
  { icon: "spa", name: "Spa", escalationMinutes: 15 },
  { icon: "reception", name: "Reception", escalationMinutes: 10 },
];

async function hotelDepartments(ctx: MutationCtx, hotelId: Id<"hotels">) {
  return await ctx.db
    .query("departments")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .take(100);
}

/**
 * Make sure every default department exists (matched by icon key, then by
 * name). Returns the id per default key. Idempotent.
 */
export async function ensureDefaultDepartments(
  ctx: MutationCtx,
  hotelId: Id<"hotels">,
): Promise<Record<DeptKey, Id<"departments">>> {
  const existing = (await hotelDepartments(ctx, hotelId)).filter((d) => !d.archived);
  let nextSort = existing.reduce((m, d) => Math.max(m, d.sortOrder + 1), 0);
  const out = {} as Record<DeptKey, Id<"departments">>;
  for (const def of DEFAULT_DEPARTMENTS) {
    const match =
      existing.find((d) => d.icon === def.icon) ??
      existing.find((d) => d.name.toLowerCase() === def.name.toLowerCase());
    if (match) {
      out[def.icon] = match._id;
    } else {
      out[def.icon] = await ctx.db.insert("departments", {
        hotelId,
        name: def.name,
        icon: def.icon,
        escalationMinutes: def.escalationMinutes,
        sortOrder: nextSort++,
        archived: false,
      });
    }
  }
  return out;
}

export type DefaultItem = {
  key: string;
  department?: DeptKey; // omitted for links
  url?: string;
  visible?: boolean;
  kind: Doc<"catalogItems">["kind"];
  section: Doc<"catalogItems">["section"];
  title: string;
  guestTitle: string;
  guestDescription?: string;
  icon: string;
  price?: number;
  allowQuantity: boolean;
  maxQuantity?: number;
  allowNote: boolean;
  estimatedMinutes?: number;
  steps: string[];
};

export const DEFAULT_ITEMS: DefaultItem[] = [
  {
    key: "towels",
    department: "housekeeping",
    kind: "request",
    section: "housekeeping",
    title: "სუფთა პირსახოცების მიტანა",
    guestTitle: "Fresh towels",
    guestDescription: "We will bring clean bath towels to your room.",
    icon: "towels",
    allowQuantity: true,
    maxQuantity: 6,
    allowNote: true,
    estimatedMinutes: 10,
    steps: [
      "აიღე სუფთა პირსახოცები სარეცხის ოთახიდან (მოთხოვნილი რაოდენობა).",
      "შეამოწმე, რომ პირსახოცები სუფთა, მშრალი და დაუზიანებელია.",
      "დააკაკუნე ოთახის კარზე და თქვი: \"Housekeeping\".",
      "გადაეცი სტუმარს ან დაალაგე აბაზანაში; გამოყენებული წამოიღე.",
      "მონიშნე დავალება შესრულებულად.",
    ],
  },
  {
    key: "pool-towels",
    department: "housekeeping",
    kind: "request",
    section: "housekeeping",
    title: "აუზის პირსახოცების მიტანა",
    guestTitle: "Pool towels",
    guestDescription: "Large towels for the pool and aquapark.",
    icon: "pool-towels",
    allowQuantity: true,
    maxQuantity: 6,
    allowNote: true,
    estimatedMinutes: 10,
    steps: [
      "აიღე აუზის (ზოლიანი) პირსახოცები აუზის საწყობიდან.",
      "დაითვალე მოთხოვნილი რაოდენობა.",
      "მიიტანე ოთახში და გადაეცი სტუმარს.",
      "შეახსენე, რომ პირსახოცები აუზთან დატოვონ კალათაში.",
    ],
  },
  {
    key: "robe",
    department: "housekeeping",
    kind: "request",
    section: "housekeeping",
    title: "ხალათის მიტანა",
    guestTitle: "Bathrobe",
    guestDescription: "A soft bathrobe delivered to your room.",
    icon: "robe",
    allowQuantity: true,
    maxQuantity: 4,
    allowNote: true,
    estimatedMinutes: 10,
    steps: [
      "აიღე სუფთა ხალათი სართულის საწყობიდან (ზომა: M/L).",
      "შეამოწმე, რომ ხალათი სუფთაა და ქამარი ადგილზეა.",
      "მიიტანე ოთახში და გადაეცი სტუმარს.",
      "მონიშნე დავალება შესრულებულად.",
    ],
  },
  {
    key: "pillows",
    department: "housekeeping",
    kind: "request",
    section: "housekeeping",
    title: "დამატებითი ბალიშის მიტანა",
    guestTitle: "Extra pillows",
    icon: "pillows",
    allowQuantity: true,
    maxQuantity: 4,
    allowNote: true,
    estimatedMinutes: 10,
    steps: [
      "აიღე ბალიში და სუფთა ბალიშისპირი საწყობიდან.",
      "ჩაიცვი ბალიშისპირი ბალიშზე.",
      "მიიტანე ოთახში და გადაეცი სტუმარს.",
      "მონიშნე დავალება შესრულებულად.",
    ],
  },
  {
    key: "water",
    department: "housekeeping",
    kind: "request",
    section: "housekeeping",
    title: "სასმელი წყლის მიტანა",
    guestTitle: "Drinking water",
    icon: "water",
    allowQuantity: true,
    maxQuantity: 6,
    allowNote: false,
    estimatedMinutes: 10,
    steps: [
      "აიღე წყლის ბოთლები მინი-ბარის საწყობიდან.",
      "შეამოწმე ვარგისიანობის ვადა.",
      "მიიტანე ოთახში და გადაეცი სტუმარს.",
    ],
  },
  {
    key: "cleaning",
    department: "housekeeping",
    kind: "request",
    section: "housekeeping",
    title: "ოთახის დალაგება",
    guestTitle: "Room cleaning",
    guestDescription: "Tell us when it suits you in the note.",
    icon: "cleaning",
    allowQuantity: false,
    allowNote: true,
    estimatedMinutes: 30,
    steps: [
      "აიღე დასალაგებელი ურიკა და სუფთა თეთრეული.",
      "დააკაკუნე და დარწმუნდი, რომ სტუმარი თანახმაა.",
      "გაანიავე ოთახი, გამოიტანე ნაგავი და შეცვალე თეთრეული.",
      "გაწმინდე აბაზანა და შეავსე აქსესუარები.",
      "გაასუფთავე იატაკი მტვერსასრუტით.",
      "შეამოწმე ყველაფერი და დაკეტე კარი.",
    ],
  },
  {
    key: "repair",
    department: "maintenance",
    kind: "request",
    section: "housekeeping",
    title: "შეკეთება ოთახში",
    guestTitle: "Something needs fixing",
    guestDescription: "Describe the problem in the note.",
    icon: "repair",
    allowQuantity: false,
    allowNote: true,
    estimatedMinutes: 30,
    steps: [
      "წაიკითხე სტუმრის შენიშვნა და აიღე შესაბამისი ხელსაწყოები.",
      "დააკაკუნე და აუხსენი სტუმარს, რას გააკეთებ.",
      "დაადგინე და გამოასწორე პრობლემა.",
      "თუ შეკეთება ახლა შეუძლებელია, აცნობე მენეჯერს.",
      "დაასუფთავე სამუშაო ადგილი.",
    ],
  },
  {
    key: "dinner-order",
    department: "kitchen",
    kind: "offer",
    section: "dining",
    title: "ვახშმის შეკვეთა ოთახში",
    guestTitle: "Dinner in your room",
    guestDescription: "Tell us what you would like and when; we will confirm by phone.",
    icon: "dinner",
    allowQuantity: false,
    allowNote: true,
    estimatedMinutes: 45,
    steps: [
      "წაიკითხე შეკვეთა და დაურეკე ოთახს დასაზუსტებლად.",
      "გადაეცი შეკვეთა სამზარეულოს.",
      "მოამზადე ლანგარი, ჭურჭელი და ხელსახოცები.",
      "მიიტანე შეკვეთა ოთახში და დაადასტურე ანგარიში.",
    ],
  },
  {
    key: "spa-booking",
    department: "spa",
    kind: "offer",
    section: "spa",
    title: "სპა პროცედურის დაჯავშნა",
    guestTitle: "Book a spa treatment",
    guestDescription: "Tell us the treatment and preferred time; the spa will confirm.",
    icon: "spa",
    allowQuantity: false,
    allowNote: true,
    estimatedMinutes: 15,
    steps: [
      "წაიკითხე სასურველი პროცედურა და დრო.",
      "შეამოწმე თავისუფალი დრო სპა-ს კალენდარში.",
      "დაურეკე ოთახს და დაადასტურე ჯავშანი.",
      "ჩაწერე ჯავშანი კალენდარში.",
    ],
  },
  {
    key: "waterpark-pass",
    department: "reception",
    kind: "offer",
    section: "aquapark",
    title: "აკვაპარკის ბილეთი",
    guestTitle: "Aquapark day pass",
    guestDescription: "Full-day access to the aquapark. Charged to your room.",
    icon: "aquapark",
    price: 59,
    allowQuantity: true,
    maxQuantity: 8,
    allowNote: true,
    estimatedMinutes: 10,
    steps: [
      "შეამოწმე მოთხოვნილი ბილეთების რაოდენობა.",
      "დაბეჭდე ბილეთები / სამაჯურები.",
      "დაამატე თანხა ოთახის ანგარიშზე.",
      "გადაეცი ბილეთები სტუმარს ან მიიტანე ოთახში.",
    ],
  },
  {
    key: "late-checkout",
    department: "reception",
    kind: "request",
    section: "stay",
    title: "გვიანი გაწერის მოთხოვნა",
    guestTitle: "Late checkout",
    guestDescription: "Ask to stay longer on your last day; reception will confirm.",
    icon: "late-checkout",
    allowQuantity: false,
    allowNote: true,
    estimatedMinutes: 10,
    steps: [
      "შეამოწმე, არის თუ არა ოთახი დაჯავშნილი იმავე დღეს.",
      "შეათანხმე საათი და ფასი (საჭიროების შემთხვევაში).",
      "დაურეკე სტუმარს და დაადასტურე.",
      "შეცვალე გაწერის დრო სისტემაში.",
    ],
  },
];

/** Insert the given catalog items that are missing (by key). Idempotent. */
export async function insertMissingItems(
  ctx: MutationCtx,
  hotelId: Id<"hotels">,
  items: DefaultItem[],
): Promise<string[]> {
  const depts = await ensureDefaultDepartments(ctx, hotelId);
  const existing = await ctx.db
    .query("catalogItems")
    .withIndex("by_hotelId", (q) => q.eq("hotelId", hotelId))
    .take(500);
  let nextSort = existing.reduce((m, i) => Math.max(m, i.sortOrder + 1), 0);
  const inserted: string[] = [];
  for (const item of items) {
    const found = await ctx.db
      .query("catalogItems")
      .withIndex("by_hotelId_and_key", (q) => q.eq("hotelId", hotelId).eq("key", item.key))
      .first();
    if (found) continue;
    const { department, visible, ...fields } = item;
    await ctx.db.insert("catalogItems", {
      hotelId,
      ...fields,
      departmentId: department ? depts[department] : undefined,
      visible: visible ?? true,
      sortOrder: nextSort++,
      archived: false,
    });
    inserted.push(item.key);
  }
  return inserted;
}

/** Insert the default catalog items that are missing (by key). Idempotent. */
export async function seedCatalogDefaults(
  ctx: MutationCtx,
  hotelId: Id<"hotels">,
): Promise<number> {
  return (await insertMissingItems(ctx, hotelId, DEFAULT_ITEMS)).length;
}
