"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useActiveHotel } from "@/components/hotel-context";
import {
  ArrowButton,
  Button,
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
  useRun,
  useToast,
} from "@/components/kit";
import { RoleGate } from "@/components/role-gate";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { iconFor, iconKeys } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Item = FunctionReturnType<typeof api.catalog.list>[number];
type Kind = "request" | "offer" | "info" | "link" | "internal";
type Section = "housekeeping" | "dining" | "spa" | "aquapark" | "stay" | "hotels" | "other";

const SECTIONS = [
  { value: "all", label: "All" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "dining", label: "Dining" },
  { value: "spa", label: "Spa" },
  { value: "aquapark", label: "Water park" },
  { value: "stay", label: "Stay" },
  { value: "hotels", label: "Hotels" },
  { value: "other", label: "Other" },
];

const KIND_LABEL: Record<Kind, string> = {
  request: "Request",
  offer: "Offer",
  info: "Info",
  link: "Link",
  internal: "Staff playbook",
};

export default function CatalogPage() {
  return (
    <RoleGate allow={["manager"]}>
      <Catalog />
    </RoleGate>
  );
}

function Catalog() {
  const { hotelId } = useActiveHotel();
  const items = useQuery(api.catalog.list, { hotelId });
  const seed = useMutation(api.catalog.seedDefaults);
  const setVisible = useMutation(api.catalog.setVisible);
  const run = useRun();
  const [section, setSection] = useState("all");
  const [editing, setEditing] = useState<Item | "new" | null>(null);

  const shown = items?.filter((i) => section === "all" || i.section === section) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="What guests can ask for"
        title="Catalog"
        description="Each request carries its team and a playbook, so the right person gets it with clear steps."
        actions={
          <>
            {items && items.length > 0 && (
              <Button variant="ghost" onClick={() => run(() => seed({ hotelId }), "Missing defaults added")}>
                <Sparkles className="size-4" />
                Add defaults
              </Button>
            )}
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              New item
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <Segmented size="sm" value={section} onChange={setSection} options={SECTIONS} />
      </div>

      {items === undefined ? (
        <Skeleton className="h-80 bg-panel" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Your catalog is empty"
          body="Start from a ready set: towels, cleaning, repairs, dinner, spa, water park passes and late check-out."
          action={
            <ArrowButton onClick={() => run(() => seed({ hotelId }), "Default catalog loaded")}>Load the default catalog</ArrowButton>
          }
        />
      ) : (
        <div className="rounded-[30px] bg-panel p-3 sm:p-4">
          <motion.div layout className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {shown.map((item, i) => {
                const Icon = iconFor(item.icon);
                return (
                  <motion.button
                    key={item._id}
                    type="button"
                    layout
                    layoutId={`item-${item._id}`}
                    onClick={() => setEditing(item)}
                    style={{ borderRadius: 24 }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", bounce: 0.14, duration: 0.5, delay: Math.min(i * 0.03, 0.3) }}
                    whileHover={{ y: -3 }}
                    className={cn("flex min-h-[176px] flex-col bg-white p-5 text-left", !item.visible && "opacity-60")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-11 place-items-center rounded-full bg-panel">
                        <Icon className="size-[18px]" />
                      </span>
                      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <Toggle
                          label={item.visible ? "Visible to guests" : "Hidden from guests"}
                          checked={item.visible}
                          onChange={(visible) =>
                            run(() => setVisible({ itemId: item._id, visible }), visible ? "Shown to guests" : "Hidden from guests")
                          }
                        />
                      </span>
                    </div>
                    <p className="mt-4 text-[16px] font-medium leading-tight">{item.guestTitle}</p>
                    <p className="mt-0.5 text-[13px] text-black/50">{item.title}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                      <Pill tone={item.kind === "offer" ? "lime" : "stone"}>{KIND_LABEL[item.kind as Kind]}</Pill>
                      {item.departmentName && <Pill tone="outline">{item.departmentName}</Pill>}
                      {item.price !== undefined && <Pill tone="ink">{item.price}₾</Pill>}
                      {item.steps.length > 0 && <Pill tone="stone">{item.steps.length} steps</Pill>}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
          {shown.length === 0 && <p className="py-10 text-center text-[14px] text-black/45">Nothing in this section yet.</p>}
        </div>
      )}

      <ItemSheet item={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function ItemSheet({ item, onClose }: { item: Item | "new" | null; onClose: () => void }) {
  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      layoutId={item && item !== "new" ? `item-${item._id}` : undefined}
      title={item === "new" ? "New catalog item" : "Edit item"}
      width="max-w-3xl"
    >
      {item !== null && <ItemForm key={item === "new" ? "new" : item._id} item={item === "new" ? null : item} onDone={onClose} />}
    </Sheet>
  );
}

function ItemForm({ item, onDone }: { item: Item | null; onDone: () => void }) {
  const { hotelId } = useActiveHotel();
  const departments = useQuery(api.departments.list, { hotelId });
  const create = useMutation(api.catalog.create);
  const update = useMutation(api.catalog.update);
  const remove = useMutation(api.catalog.remove);
  const draftSteps = useAction(api.ai.draftSteps);
  const run = useRun();
  const toast = useToast();

  const [kind, setKind] = useState<Kind>((item?.kind as Kind) ?? "request");
  const [section, setSection] = useState<string>(item?.section ?? "housekeeping");
  const [guestTitle, setGuestTitle] = useState(item?.guestTitle ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [guestDescription, setGuestDescription] = useState(item?.guestDescription ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "towel");
  const [departmentId, setDepartmentId] = useState<string>(item?.departmentId ?? "");
  const [price, setPrice] = useState(item?.price?.toString() ?? "");
  const [allowQuantity, setAllowQuantity] = useState(item?.allowQuantity ?? false);
  const [maxQuantity, setMaxQuantity] = useState(item?.maxQuantity?.toString() ?? "");
  const [allowNote, setAllowNote] = useState(item?.allowNote ?? true);
  const [estimatedMinutes, setEstimatedMinutes] = useState(item?.estimatedMinutes?.toString() ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [visible, setVisible] = useState(item?.visible ?? true);
  const [key, setKey] = useState(item?.key ?? "");
  const [steps, setSteps] = useState<string[]>(item?.steps ?? []);
  const [rough, setRough] = useState("");
  const [drafting, setDrafting] = useState(false);

  const needsDepartment = kind === "request" || kind === "offer" || kind === "internal";
  const guestFacing = kind !== "internal";
  const dept = departmentId || (needsDepartment ? departments?.[0]?._id ?? "" : "");

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fields = {
      key: key.trim() || undefined,
      kind,
      section: section as Section,
      title: title.trim() || guestTitle.trim(),
      guestTitle: guestTitle.trim(),
      guestDescription: guestDescription.trim() || undefined,
      icon,
      departmentId: needsDepartment && dept ? (dept as Id<"departments">) : undefined,
      price: num(price),
      allowQuantity,
      maxQuantity: allowQuantity ? num(maxQuantity) : undefined,
      allowNote,
      steps: steps.map((s) => s.trim()).filter(Boolean),
      estimatedMinutes: num(estimatedMinutes),
      url: kind === "link" ? url.trim() || undefined : undefined,
      visible,
    };
    // On edit, null clears an optional field; undefined would leave it unchanged.
    const clearable = {
      key: fields.key ?? null,
      guestDescription: fields.guestDescription ?? null,
      departmentId: fields.departmentId ?? null,
      price: fields.price ?? null,
      maxQuantity: fields.maxQuantity ?? null,
      estimatedMinutes: fields.estimatedMinutes ?? null,
      url: fields.url ?? null,
    };
    const ok = item
      ? await run(() => update({ itemId: item._id, ...fields, ...clearable }), "Item saved")
      : await run(() => create({ hotelId, ...fields }), "Item added");
    if (ok !== undefined) onDone();
  };

  const draft = async () => {
    setDrafting(true);
    const result = await run(() => draftSteps({ hotelId, title: title || guestTitle, roughText: rough }));
    setDrafting(false);
    if (result && result.length > 0) setSteps(result);
    else if (result) toast("AI drafting needs a Gemini key in the Convex settings", "error");
  };

  const move = (index: number, delta: number) =>
    setSteps((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <form onSubmit={submit} className="space-y-5 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
        />
        {guestFacing && (
          <label className="ml-auto flex items-center gap-2 text-[14px]">
            Visible to guests
            <Toggle label="Visible to guests" checked={visible} onChange={setVisible} />
          </label>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={guestFacing ? "Guest sees" : "Name"} hint={guestFacing ? "English, shown in the guest app" : "For your team only"}>
          <TextInput value={guestTitle} onChange={(e) => setGuestTitle(e.target.value)} required maxLength={80} placeholder="Fresh towels" />
        </Field>
        <Field label="Staff sees" hint="Georgian is best for your team">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="სუფთა პირსახოცები" />
        </Field>
      </div>
      <Field label="Description for guests" hint="Optional">
        <TextArea value={guestDescription} onChange={(e) => setGuestDescription(e.target.value)} maxLength={300} className="min-h-20" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Section">
          <Select value={section} onChange={(e) => setSection(e.target.value)}>
            {SECTIONS.filter((s) => s.value !== "all").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        {needsDepartment && (
          <Field label="Team">
            <Select value={dept} onChange={(e) => setDepartmentId(e.target.value)}>
              {departments?.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Price (₾)" hint="Leave empty if free">
          <TextInput type="number" min={0} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>

      <div>
        <span className="mb-1.5 block text-[13px] font-medium">Icon</span>
        <div className="flex flex-wrap gap-1.5">
          {iconKeys.map((k) => {
            const Icon = iconFor(k);
            const on = icon === k;
            return (
              <button
                key={k}
                type="button"
                aria-label={k}
                aria-pressed={on}
                onClick={() => setIcon(k)}
                className={cn("grid size-10 place-items-center rounded-full transition", on ? "bg-ink text-lime" : "bg-panel hover:bg-panel-hover")}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      {kind === "link" && (
        <Field label="Link">
          <TextInput type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </Field>
      )}

      {needsDepartment && guestFacing && (
        <div className="grid gap-3 rounded-[22px] bg-paper p-4 sm:grid-cols-3">
          <label className="flex items-center justify-between gap-2 text-[14px]">
            Guest picks a quantity
            <Toggle label="Quantity" checked={allowQuantity} onChange={setAllowQuantity} />
          </label>
          <label className="flex items-center justify-between gap-2 text-[14px]">
            Guest can add a note
            <Toggle label="Note" checked={allowNote} onChange={setAllowNote} />
          </label>
          <div className="flex gap-2">
            {allowQuantity && (
              <TextInput type="number" min={1} max={20} value={maxQuantity} onChange={(e) => setMaxQuantity(e.target.value)} placeholder="Max" className="h-10" />
            )}
            <TextInput type="number" min={1} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} placeholder="Minutes" className="h-10" />
          </div>
        </div>
      )}

      {needsDepartment && (
        <div className="rounded-[24px] bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-medium">Playbook for staff</p>
            <Button size="sm" variant="white" onClick={() => setSteps((s) => [...s, ""])} disabled={steps.length >= 20}>
              <Plus className="size-3.5" />
              Step
            </Button>
          </div>
          <ol className="space-y-2">
            <AnimatePresence initial={false}>
              {steps.map((step, index) => (
                <motion.li
                  key={index}
                  layout
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[12px] font-medium">{index + 1}</span>
                  <TextInput
                    value={step}
                    onChange={(e) => setSteps((list) => list.map((s, i) => (i === index ? e.target.value : s)))}
                    className="h-10 bg-white"
                    maxLength={240}
                  />
                  <div className="flex shrink-0">
                    <button type="button" aria-label="Move up" onClick={() => move(index, -1)} className="grid size-8 place-items-center rounded-full hover:bg-white">
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button type="button" aria-label="Move down" onClick={() => move(index, 1)} className="grid size-8 place-items-center rounded-full hover:bg-white">
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove step"
                      onClick={() => setSteps((list) => list.filter((_, i) => i !== index))}
                      className="grid size-8 place-items-center rounded-full text-red-600 hover:bg-white"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          <div className="mt-3 flex gap-2">
            <TextInput
              value={rough}
              onChange={(e) => setRough(e.target.value)}
              placeholder="Or describe it roughly: towels are in the basement, white dresser, top shelf…"
              className="h-10 bg-white"
            />
            <Button size="sm" variant="primary" className="h-10" disabled={!rough.trim() || drafting} onClick={draft}>
              <Wand2 className="size-3.5 text-lime" />
              {drafting ? "Writing…" : "Draft with AI"}
            </Button>
          </div>
        </div>
      )}

      <details className="rounded-[20px] bg-paper px-4 py-3 text-[14px]">
        <summary className="cursor-pointer font-medium">Advanced</summary>
        <div className="mt-3">
          <Field label="Key" hint="Stable id the guest app uses (e.g. towels). Leave empty for custom items.">
            <TextInput value={key} onChange={(e) => setKey(e.target.value)} maxLength={40} className="font-mono" />
          </Field>
        </div>
      </details>

      <div className="flex gap-2">
        {item && (
          <Button
            variant="danger"
            size="lg"
            onClick={async () => {
              const ok = await run(() => remove({ itemId: item._id }), "Item removed");
              if (ok !== undefined) onDone();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <ArrowButton type="submit" className="flex-1" disabled={!guestTitle.trim()}>
          {item ? "Save changes" : "Add to catalog"}
        </ArrowButton>
      </div>
    </form>
  );
}
