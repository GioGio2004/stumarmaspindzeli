"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { ExternalLink, GripVertical, Monitor, Pencil, Plus, Smartphone, Sparkles, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useActiveHotel } from "@/components/hotel-context";
import {
  ArrowButton,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Pill,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  TextArea,
  TextInput,
  Toggle,
  buttonClass,
  useRun,
} from "@/components/kit";
import { RoleGate } from "@/components/role-gate";
import { api } from "@/convex/_generated/api";
import { IconByKey, iconFor, iconKeys } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Config = NonNullable<FunctionReturnType<typeof api.storefront.get>>;
type Tile = Config["tiles"][number];
type TileType = Tile["type"];

const TYPES: { value: TileType; label: string; hint: string }[] = [
  { value: "requests", label: "Room requests", hint: "Guests pick items from a catalog section; each goes to its team." },
  { value: "menu", label: "Menu / order", hint: "Priced items with quantities, sent as one order." },
  { value: "booking", label: "Booking", hint: "Pick one item and a time slot, like a spa treatment." },
  { value: "ticket", label: "Ticket", hint: "One featured offer with facts, like a day pass." },
  { value: "concierge", label: "Concierge chat", hint: "Ask anything in any language." },
  { value: "events", label: "Today's events", hint: "Your daily schedule." },
  { value: "stay", label: "Your stay", hint: "Wi-Fi, check-out time and contacts from Settings." },
  { value: "links", label: "Links", hint: "Link items from a section, like your other hotels." },
  { value: "checkout", label: "Late check-out", hint: "Time options, sent to reception." },
  { value: "info", label: "Info page", hint: "Any text you want guests to read." },
];

const typeLabel = (t: TileType) => TYPES.find((x) => x.value === t)?.label ?? t;

const SECTIONS = ["housekeeping", "dining", "spa", "aquapark", "stay", "hotels", "other"] as const;
type Section = (typeof SECTIONS)[number];

export default function StorefrontPage() {
  return (
    <RoleGate allow={["manager"]}>
      <Builder />
    </RoleGate>
  );
}

function Builder() {
  const { hotelId, hotel } = useActiveHotel();
  const config = useQuery(api.storefront.get, { hotelId });
  const seed = useMutation(api.storefront.seedDefaults);
  const run = useRun();
  const [tab, setTab] = useState<"layout" | "hero" | "events">("layout");
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [previewKey, setPreviewKey] = useState(0);

  const base = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "";
  const previewUrl = `${base}/h/${hotel.slug}`;

  return (
    <>
      <PageHeader
        eyebrow="What guests see"
        title="Guest app"
        description="Every card, word and order on the guest app comes from here. Changes go live instantly."
        actions={
          <>
            <Button variant="ghost" onClick={() => run(() => seed({ hotelId }), "Missing defaults added")}>
              <Sparkles className="size-4" />
              Add defaults
            </Button>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
              <ExternalLink className="size-4" />
              Open live
            </a>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="min-w-0 space-y-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "layout", label: "Cards" },
              { value: "hero", label: "Welcome text" },
              { value: "events", label: "Today's events" },
            ]}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              {config === undefined ? (
                <Skeleton className="h-80 bg-panel" />
              ) : tab === "layout" ? (
                config.tiles.length === 0 ? (
                  <EmptyState
                    title="No cards yet"
                    body="Start from the Gino layout: requests, water park, concierge, dining, spa, events, stay, hotels and late check-out."
                    action={<ArrowButton onClick={() => run(() => seed({ hotelId }), "Layout loaded")}>Load the default layout</ArrowButton>}
                  />
                ) : (
                  <TileList tiles={config.tiles} />
                )
              ) : tab === "hero" ? (
                <HeroForm settings={config.settings} />
              ) : (
                <EventsEditor />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="xl:sticky xl:top-8 xl:self-start">
          <div className="rounded-[30px] bg-panel p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[13px] font-medium uppercase tracking-wider text-black/50">Live preview</p>
              <div className="flex gap-1">
                <button type="button" aria-label="Phone" onClick={() => setDevice("phone")} className={cn("grid size-9 place-items-center rounded-full", device === "phone" ? "bg-ink text-lime" : "bg-white")}>
                  <Smartphone className="size-4" />
                </button>
                <button type="button" aria-label="Desktop" onClick={() => setDevice("desktop")} className={cn("grid size-9 place-items-center rounded-full", device === "desktop" ? "bg-ink text-lime" : "bg-white")}>
                  <Monitor className="size-4" />
                </button>
                <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className="rounded-full bg-white px-3 text-[12px]">
                  Reload
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/5">
              {base ? (
                <div className={cn("relative mx-auto overflow-hidden", device === "phone" ? "h-[720px] w-full max-w-[390px]" : "h-[520px] w-full")}>
                  <iframe
                    key={previewKey}
                    title="Guest app preview"
                    src={previewUrl}
                    className={cn(
                      "absolute left-0 top-0 origin-top-left border-0",
                      device === "phone" ? "h-full w-full" : "h-[1040px] w-[200%] scale-50",
                    )}
                  />
                </div>
              ) : (
                <p className="p-6 text-[14px] text-black/55">Set NEXT_PUBLIC_STOREFRONT_URL to see the preview.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function TileList({ tiles }: { tiles: Tile[] }) {
  const { hotelId } = useActiveHotel();
  const reorder = useMutation(api.storefront.reorderTiles);
  const updateTile = useMutation(api.storefront.updateTile);
  const run = useRun();
  // Local order only while a drag is in flight; otherwise the live server list wins.
  const [draft, setDraft] = useState<Tile[] | null>(null);
  const [editing, setEditing] = useState<Tile | "new" | null>(null);
  const order = draft ?? tiles;

  const persist = async () => {
    if (!draft) return;
    const ids = draft.map((t) => t._id);
    if (ids.join() !== tiles.map((t) => t._id).join()) {
      await run(() => reorder({ hotelId, tileIds: ids }), "Order saved");
    }
    setDraft(null);
  };

  return (
    <div className="rounded-[30px] bg-panel p-3 sm:p-4">
      <Reorder.Group axis="y" values={order} onReorder={setDraft} className="space-y-2">
        {order.map((tile) => (
          <TileRow
            key={tile._id}
            tile={tile}
            onDrop={persist}
            onEdit={() => setEditing(tile)}
            onToggle={(visible) => run(() => updateTile({ tileId: tile._id, visible }), visible ? "Card shown" : "Card hidden")}
          />
        ))}
      </Reorder.Group>
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-black/10 text-[14px] font-medium text-black/55 transition hover:border-black/25 hover:text-black"
      >
        <Plus className="size-4" />
        Add a card
      </button>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New card" : "Edit card"}
        width="max-w-2xl"
      >
        {editing !== null && (
          <TileForm key={editing === "new" ? "new" : editing._id} tile={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </div>
  );
}

function TileRow({ tile, onDrop, onEdit, onToggle }: { tile: Tile; onDrop: () => void; onEdit: () => void; onToggle: (v: boolean) => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={tile}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className={cn("flex items-center gap-3 rounded-[22px] bg-white px-3 py-3", !tile.visible && "opacity-55")}
      whileDrag={{ scale: 1.02, boxShadow: "0 18px 40px rgba(0,0,0,0.12)" }}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-full text-black/40 hover:bg-panel active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", tile.tone === "dark" ? "bg-graphite text-white" : "bg-panel")}>
        <IconByKey name={tile.icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{tile.title}</p>
        <p className="truncate text-[12px] text-black/45">{tile.blurb}</p>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        <Pill tone="stone">{typeLabel(tile.type)}</Pill>
        {tile.size === "wide" && <Pill tone="outline">Wide</Pill>}
      </div>
      <Toggle label={tile.visible ? "Shown" : "Hidden"} checked={tile.visible} onChange={onToggle} />
      <button type="button" aria-label={`Edit ${tile.title}`} onClick={onEdit} className="grid size-9 shrink-0 place-items-center rounded-full bg-panel transition hover:bg-ink hover:text-white">
        <Pencil className="size-3.5" />
      </button>
    </Reorder.Item>
  );
}

function linesToList(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function TileForm({ tile, onDone }: { tile: Tile | null; onDone: () => void }) {
  const { hotelId } = useActiveHotel();
  const items = useQuery(api.catalog.list, { hotelId });
  const create = useMutation(api.storefront.createTile);
  const update = useMutation(api.storefront.updateTile);
  const remove = useMutation(api.storefront.removeTile);
  const run = useRun();

  const [type, setType] = useState<TileType>(tile?.type ?? "requests");
  const [title, setTitle] = useState(tile?.title ?? "");
  const [blurb, setBlurb] = useState(tile?.blurb ?? "");
  const [icon, setIcon] = useState(tile?.icon ?? "towel");
  const [tone, setTone] = useState<"light" | "dark">(tile?.tone ?? "light");
  const [size, setSize] = useState<"normal" | "wide">(tile?.size ?? "normal");
  const [visible, setVisible] = useState(tile?.visible ?? true);
  const [inNav, setInNav] = useState(tile?.inNav ?? false);
  const [navLabel, setNavLabel] = useState(tile?.navLabel ?? "");
  const [section, setSection] = useState(tile?.section ?? "housekeeping");
  const [itemKey, setItemKey] = useState(tile?.itemKey ?? "");
  const [slots, setSlots] = useState((tile?.slots ?? []).join("\n"));
  const [options, setOptions] = useState((tile?.options ?? []).join("\n"));
  const [facts, setFacts] = useState((tile?.facts ?? []).map((f) => `${f.value} | ${f.label}`).join("\n"));
  const [hours, setHours] = useState(tile?.hours ?? "");
  const [body, setBody] = useState(tile?.body ?? "");
  const [steps, setSteps] = useState((tile?.howItWorks ?? []).map((s) => `${s.title} | ${s.body}`).join("\n"));

  const usesSection = ["requests", "menu", "booking", "links"].includes(type);
  const usesItem = type === "ticket" || type === "checkout";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fields = {
      type,
      title: title.trim(),
      blurb: blurb.trim(),
      icon,
      tone,
      size,
      visible,
      inNav,
      navLabel: navLabel.trim() || undefined,
      section: usesSection ? section : undefined,
      itemKey: usesItem && itemKey ? itemKey : undefined,
      slots: type === "booking" ? linesToList(slots) : undefined,
      options: type === "checkout" ? linesToList(options) : undefined,
      facts:
        type === "ticket"
          ? linesToList(facts).map((line) => {
              const [value, ...rest] = line.split("|");
              return { value: value.trim(), label: rest.join("|").trim() };
            })
          : undefined,
      hours: type === "ticket" ? hours.trim() || undefined : undefined,
      body: type === "info" ? body.trim() || undefined : undefined,
      howItWorks: linesToList(steps).map((line) => {
        const [t, ...rest] = line.split("|");
        return { title: t.trim(), body: rest.join("|").trim() };
      }),
    };
    const ok = tile
      ? await run(() => update({ tileId: tile._id, ...fields }), "Card saved")
      : await run(() => create({ hotelId, ...fields }), "Card added");
    if (ok !== undefined) onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-5 pb-2">
      <Field label="Card type" hint={TYPES.find((t) => t.value === type)?.hint}>
        <Select value={type} onChange={(e) => setType(e.target.value as TileType)}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={40} />
        </Field>
        <Field label="Short text">
          <TextInput value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={90} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={tone} onChange={setTone} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        <Segmented value={size} onChange={setSize} options={[{ value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }]} />
        <label className="ml-auto flex items-center gap-2 text-[14px]">
          Shown
          <Toggle label="Shown" checked={visible} onChange={setVisible} />
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-[13px] font-medium">Icon</span>
        <div className="flex flex-wrap gap-1.5">
          {iconKeys.map((k) => {
            const Icon = iconFor(k);
            return (
              <button
                key={k}
                type="button"
                aria-label={k}
                aria-pressed={icon === k}
                onClick={() => setIcon(k)}
                className={cn("grid size-10 place-items-center rounded-full transition", icon === k ? "bg-ink text-lime" : "bg-panel hover:bg-panel-hover")}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      {usesSection && (
        <Field label="Catalog section" hint="The card shows the visible catalog items of this section.">
          <Select value={section} onChange={(e) => setSection(e.target.value as Section)}>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {usesItem && (
        <Field label="Catalog item" hint="The request that is sent when the guest confirms.">
          <Select value={itemKey} onChange={(e) => setItemKey(e.target.value)}>
            <option value="">Choose an item</option>
            {items
              ?.filter((i) => i.key && (i.kind === "offer" || i.kind === "request"))
              .map((i) => (
                <option key={i._id} value={i.key}>
                  {i.guestTitle}
                </option>
              ))}
          </Select>
        </Field>
      )}
      {type === "booking" && (
        <Field label="Time slots" hint="One per line">
          <TextArea value={slots} onChange={(e) => setSlots(e.target.value)} placeholder={"13:00\n14:30\n16:00"} />
        </Field>
      )}
      {type === "checkout" && (
        <Field label="Check-out options" hint="One per line">
          <TextArea value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"13:00\n14:00\n16:00"} />
        </Field>
      )}
      {type === "ticket" && (
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Facts" hint="One per line: value | label">
            <TextArea value={facts} onChange={(e) => setFacts(e.target.value)} placeholder={"9 | pools\n31 m | tallest slide"} />
          </Field>
          <Field label="Opening hours">
            <TextInput value={hours} onChange={(e) => setHours(e.target.value)} placeholder="12:00–22:00" />
          </Field>
        </div>
      )}
      {type === "info" && (
        <Field label="Page text">
          <TextArea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} className="min-h-40" />
        </Field>
      )}

      <Field label="How it works" hint="Shown as the animated explainer. One step per line: title | text (max 5)">
        <TextArea value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={"Tap what you need | No calls, no waiting.\nOnly the right team sees it | Housekeeping gets it instantly."} />
      </Field>

      <div className="grid gap-4 rounded-[20px] bg-paper p-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <label className="flex items-center gap-2 text-[14px]">
          <Toggle label="In top menu" checked={inNav} onChange={setInNav} />
          In the top menu
        </label>
        {inNav && <TextInput value={navLabel} onChange={(e) => setNavLabel(e.target.value)} placeholder="Menu label" maxLength={16} className="h-10" />}
      </div>

      <div className="flex gap-2">
        {tile && (
          <Button
            variant="danger"
            size="lg"
            onClick={async () => {
              const ok = await run(() => remove({ tileId: tile._id }), "Card removed");
              if (ok !== undefined) onDone();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <ArrowButton type="submit" className="flex-1" disabled={!title.trim()}>
          {tile ? "Save card" : "Add card"}
        </ArrowButton>
      </div>
    </form>
  );
}

function HeroForm({ settings }: { settings: Config["settings"] }) {
  const { hotelId } = useActiveHotel();
  const save = useMutation(api.storefront.updateSettings);
  const run = useRun();
  const [heroEyebrow, setEyebrow] = useState(settings.heroEyebrow);
  const [heroTitle, setTitle] = useState(settings.heroTitle);
  const [heroHighlight, setHighlight] = useState(settings.heroHighlight);
  const [heroTitleEnd, setEnd] = useState(settings.heroTitleEnd);
  const [heroSubtitle, setSubtitle] = useState(settings.heroSubtitle);
  const [footerNote, setFooter] = useState(settings.footerNote ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => save({ hotelId, heroEyebrow, heroTitle, heroHighlight, heroTitleEnd, heroSubtitle, footerNote: footerNote || undefined }),
          "Welcome text saved",
        );
      }}
      className="space-y-4 rounded-[30px] bg-panel p-3 sm:p-4"
    >
      <Card className="space-y-4">
        <p className="rounded-[20px] bg-paper p-5">
          <span className="block font-script text-2xl text-black/60">{heroEyebrow}</span>
          <span className="block text-3xl font-medium leading-tight tracking-tight">
            {heroTitle} <span className="rounded-full px-2 ring-2 ring-lime-soft">{heroHighlight}</span> {heroTitleEnd}
          </span>
        </p>
        <Field label="Handwritten greeting">
          <TextInput value={heroEyebrow} onChange={(e) => setEyebrow(e.target.value)} maxLength={60} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Headline">
            <TextInput value={heroTitle} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Circled words">
            <TextInput value={heroHighlight} onChange={(e) => setHighlight(e.target.value)} maxLength={24} />
          </Field>
          <Field label="Headline end">
            <TextInput value={heroTitleEnd} onChange={(e) => setEnd(e.target.value)} maxLength={40} />
          </Field>
        </div>
        <Field label="Subtitle">
          <TextArea value={heroSubtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={200} className="min-h-20" />
        </Field>
        <Field label="Footer note" hint="Optional">
          <TextInput value={footerNote} onChange={(e) => setFooter(e.target.value)} maxLength={120} />
        </Field>
      </Card>
      <ArrowButton type="submit">Save welcome text</ArrowButton>
    </form>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function EventsEditor() {
  const { hotelId } = useActiveHotel();
  const events = useQuery(api.resortEvents.list, { hotelId });
  const create = useMutation(api.resortEvents.create);
  const update = useMutation(api.resortEvents.update);
  const remove = useMutation(api.resortEvents.remove);
  const run = useRun();
  const [time, setTime] = useState("18:00");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [days, setDays] = useState<number[]>([]);

  return (
    <div className="space-y-4 rounded-[30px] bg-panel p-3 sm:p-4">
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {events?.map((event) => (
            <motion.li
              key={event._id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={cn("flex items-center gap-3 rounded-[22px] bg-white px-4 py-3", !event.visible && "opacity-55")}
            >
              <span className="w-14 text-lg font-medium tabular-nums">{event.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{event.title}</p>
                <p className="truncate text-[12px] text-black/45">
                  {event.place ?? ""}
                  {event.daysOfWeek && event.daysOfWeek.length > 0 && event.daysOfWeek.length < 7
                    ? ` · ${event.daysOfWeek.map((d) => DAYS[d]).join(", ")}`
                    : " · every day"}
                </p>
              </div>
              <Toggle label="Shown" checked={event.visible} onChange={(visible) => run(() => update({ eventId: event._id, visible }))} />
              <button
                type="button"
                aria-label={`Delete ${event.title}`}
                onClick={() => run(() => remove({ eventId: event._id }), "Event removed")}
                className="grid size-9 place-items-center rounded-full text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        {events?.length === 0 && <p className="py-6 text-center text-[14px] text-black/45">No events yet.</p>}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(
            () =>
              create({
                hotelId,
                time,
                title: title.trim(),
                place: place.trim() || undefined,
                daysOfWeek: days.length ? days : undefined,
                visible: true,
              }),
            "Event added",
          );
          if (ok !== undefined) {
            setTitle("");
            setPlace("");
          }
        }}
        className="space-y-3 rounded-[24px] bg-white p-4"
      >
        <p className="text-[14px] font-medium">Add an event</p>
        <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Live music" required maxLength={60} />
          <TextInput value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lobby bar" maxLength={60} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {DAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDays((list) => (on ? list.filter((x) => x !== i) : [...list, i]))}
                className={cn("h-9 rounded-full px-3 text-[13px] transition", on ? "bg-ink text-white" : "bg-panel text-black/60")}
              >
                {d}
              </button>
            );
          })}
          <span className="ml-1 text-[12px] text-black/45">{days.length ? "" : "Every day"}</span>
        </div>
        <Button type="submit" disabled={!title.trim()}>
          <Plus className="size-4" />
          Add event
        </Button>
      </form>
    </div>
  );
}

