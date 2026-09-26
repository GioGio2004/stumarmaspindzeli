"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
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
  TextInput,
  Toggle,
  useRun,
} from "@/components/kit";
import { RoleGate } from "@/components/role-gate";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type Routine = FunctionReturnType<typeof api.routines.list>[number];
type Scope = "once" | "each_occupied_room" | "each_room";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SCOPE_LABEL: Record<Scope, string> = {
  once: "One task",
  each_occupied_room: "One per occupied room",
  each_room: "One per room",
};

function daysText(days: number[]) {
  if (days.length === 7) return "Every day";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  if (days.join() === "0,6") return "Weekends";
  return days.map((d) => DAYS[d]).join(", ");
}

export default function RoutinesPage() {
  return (
    <RoleGate allow={["manager"]}>
      <Routines />
    </RoleGate>
  );
}

function Routines() {
  const { hotelId } = useActiveHotel();
  const routines = useQuery(api.routines.list, { hotelId });
  const update = useMutation(api.routines.update);
  const run = useRun();
  const [editing, setEditing] = useState<Routine | "new" | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Same work, same steps"
        title="Routines"
        description="Repeating jobs, like morning room checks or pool tests, become tasks on schedule with the playbook attached."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            New routine
          </Button>
        }
      />

      {routines === undefined ? (
        <Skeleton className="h-60 bg-panel" />
      ) : routines.length === 0 ? (
        <EmptyState
          title="No routines yet"
          body={
            <>
              Write the steps once as a{" "}
              <Link href="/catalog" className="font-medium underline underline-offset-4">
                staff playbook
              </Link>{" "}
              in the catalog, then schedule it here.
            </>
          }
          action={<ArrowButton onClick={() => setEditing("new")}>Schedule a routine</ArrowButton>}
        />
      ) : (
        <div className="rounded-[30px] bg-panel p-3 sm:p-4">
          <ul className="grid gap-3 md:grid-cols-2">
            <AnimatePresence initial={false}>
              {routines.map((routine, i) => (
                <motion.li
                  key={routine._id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <button
                    type="button"
                    onClick={() => setEditing(routine)}
                    className={cn("flex w-full flex-col gap-4 rounded-[24px] bg-white p-5 text-left transition hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)]", !routine.active && "opacity-55")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-11 place-items-center rounded-full bg-panel">
                        <CalendarClock className="size-[18px]" />
                      </span>
                      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <Toggle
                          label={routine.active ? "Active" : "Paused"}
                          checked={routine.active}
                          onChange={(active) => run(() => update({ routineId: routine._id, active }), active ? "Routine active" : "Routine paused")}
                        />
                      </span>
                    </div>
                    <div>
                      <p className="text-[16px] font-medium">{routine.title ?? routine.itemTitle}</p>
                      <p className="mt-0.5 text-[13px] text-black/50">
                        {daysText(routine.daysOfWeek)} at {routine.time}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Pill tone="stone">{routine.departmentName}</Pill>
                      <Pill tone="outline">{SCOPE_LABEL[routine.scope as Scope]}</Pill>
                      {routine.lastRunDay && <Pill tone="lime">Last run {routine.lastRunDay}</Pill>}
                    </div>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New routine" : "Edit routine"} width="max-w-xl">
        {editing !== null && (
          <RoutineForm key={editing === "new" ? "new" : editing._id} routine={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </>
  );
}

function RoutineForm({ routine, onDone }: { routine: Routine | null; onDone: () => void }) {
  const { hotelId } = useActiveHotel();
  const items = useQuery(api.catalog.list, { hotelId });
  const departments = useQuery(api.departments.list, { hotelId });
  const create = useMutation(api.routines.create);
  const update = useMutation(api.routines.update);
  const remove = useMutation(api.routines.remove);
  const run = useRun();

  const templates = items?.filter((i) => i.kind === "internal" || i.steps.length > 0) ?? [];
  const [itemId, setItemId] = useState<string>(routine?.itemId ?? "");
  const [departmentId, setDepartmentId] = useState<string>(routine?.departmentId ?? "");
  const [title, setTitle] = useState(routine?.title ?? "");
  const [time, setTime] = useState(routine?.time ?? "09:00");
  const [days, setDays] = useState<number[]>(routine?.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]);
  const [scope, setScope] = useState<Scope>((routine?.scope as Scope) ?? "once");

  const chosenItem = templates.find((t) => t._id === itemId) ?? templates[0];
  const dept = departmentId || chosenItem?.departmentId || departments?.[0]?._id || "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosenItem || !dept) return;
    const fields = {
      itemId: chosenItem._id,
      departmentId: dept as Id<"departments">,
      title: title.trim() || undefined,
      time,
      daysOfWeek: [...days].sort(),
      scope,
    };
    const ok = routine
      ? await run(() => update({ routineId: routine._id, ...fields }), "Routine saved")
      : await run(() => create({ hotelId, ...fields, active: true }), "Routine scheduled");
    if (ok !== undefined) onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <Field label="Playbook" hint="Any catalog item with steps. Staff playbooks are made for this.">
        <Select value={chosenItem?._id ?? ""} onChange={(e) => setItemId(e.target.value)}>
          {templates.map((t) => (
            <option key={t._id} value={t._id}>
              {t.title} · {t.steps.length} steps
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Team">
          <Select value={dept} onChange={(e) => setDepartmentId(e.target.value)}>
            {departments?.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Task title" hint="Optional, defaults to the playbook name">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field label="Time">
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Days</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays((list) => (on ? list.filter((x) => x !== i) : [...list, i]))}
                  className={cn("h-10 min-w-12 rounded-full px-3 text-[13px] transition", on ? "bg-ink text-white" : "bg-panel text-black/60")}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium">Creates</span>
        <Segmented value={scope} onChange={setScope} options={(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => ({ value: s, label: SCOPE_LABEL[s] }))} />
      </div>
      <div className="flex gap-2">
        {routine && (
          <Button
            variant="danger"
            size="lg"
            onClick={async () => {
              const ok = await run(() => remove({ routineId: routine._id }), "Routine deleted");
              if (ok !== undefined) onDone();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <ArrowButton type="submit" className="flex-1" disabled={!chosenItem || days.length === 0}>
          {routine ? "Save routine" : "Schedule routine"}
        </ArrowButton>
      </div>
      {templates.length === 0 && items !== undefined && (
        <p className="text-[13px] text-black/50">
          No playbooks yet. Add a staff playbook in the{" "}
          <Link href="/catalog" className="underline underline-offset-4">
            catalog
          </Link>
          .
        </p>
      )}
    </form>
  );
}
