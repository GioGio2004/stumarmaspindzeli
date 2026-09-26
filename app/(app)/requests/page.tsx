"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, LayoutGroup } from "motion/react";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useActiveHotel } from "@/components/hotel-context";
import {
  ArrowButton,
  Button,
  Field,
  PageHeader,
  Pill,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  TextArea,
  TextInput,
  useRun,
} from "@/components/kit";
import { TaskCard, TaskSheet } from "@/components/tasks";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { startOfHotelDay, useNow } from "@/lib/format";
import { boardColumns } from "@/lib/status";
import { cn } from "@/lib/utils";

export default function RequestsPage() {
  const { hotelId, role } = useActiveHotel();
  const now = useNow(60_000);
  const [department, setDepartment] = useState<string>("all");
  const [openTask, setOpenTask] = useState<Id<"tasks"> | null>(null);
  const [creating, setCreating] = useState(false);

  const departments = useQuery(api.departments.list, { hotelId });
  const board = useQuery(api.tasks.board, {
    hotelId,
    departmentId: department === "all" ? undefined : (department as Id<"departments">),
    doneSince: startOfHotelDay(now),
  });

  return (
    <>
      <PageHeader
        eyebrow="Live board"
        title="Requests"
        description={
          role === "staff"
            ? "Tasks for your departments. Accept one and it moves to you."
            : "Every guest and staff request, routed to the team that handles it."
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New task
          </Button>
        }
      />

      {departments && departments.length > 1 && (
        <div className="mb-4">
          <Segmented
            size="sm"
            value={department}
            onChange={setDepartment}
            options={[
              { value: "all", label: "All teams" },
              ...departments.map((d) => ({
                value: d._id as string,
                label: (
                  <>
                    {d.name}
                    {d.openTaskCount > 0 && (
                      <span className="rounded-full bg-lime px-1.5 text-[11px] text-black">{d.openTaskCount}</span>
                    )}
                  </>
                ),
              })),
            ]}
          />
        </div>
      )}

      <LayoutGroup>
        <div className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-4 xl:overflow-visible">
          {boardColumns.map((column) => {
            const tasks = board?.[column.status];
            return (
              <section
                key={column.status}
                className="flex w-[84vw] shrink-0 snap-start flex-col rounded-[28px] bg-panel p-3 sm:w-[340px] xl:w-auto"
              >
                <div className="mb-3 flex items-center justify-between px-2 pt-1">
                  <h2 className="text-[15px] font-medium">{column.title}</h2>
                  <Pill tone={column.status === "open" && tasks?.length ? "lime" : "white"}>{tasks?.length ?? 0}</Pill>
                </div>
                <div className={cn("flex min-h-40 flex-col gap-2.5", column.status === "done" && "opacity-80")}>
                  {tasks === undefined ? (
                    <>
                      <Skeleton className="h-28" />
                      <Skeleton className="h-28" />
                    </>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {tasks.map((task) => (
                        <TaskCard key={task._id} task={task} onOpen={setOpenTask} />
                      ))}
                    </AnimatePresence>
                  )}
                  {tasks?.length === 0 && (
                    <p className="rounded-[22px] border border-dashed border-black/10 px-4 py-8 text-center text-[13px] text-black/40">
                      {column.status === "open" ? "All caught up" : "Nothing here"}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </LayoutGroup>

      <TaskSheet taskId={openTask} onClose={() => setOpenTask(null)} />
      <NewTaskSheet open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function NewTaskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hotelId } = useActiveHotel();
  const departments = useQuery(api.departments.list, { hotelId });
  const rooms = useQuery(api.rooms.list, { hotelId });
  const create = useMutation(api.tasks.create);
  const run = useRun();
  const [departmentId, setDepartmentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState<"normal" | "high">("normal");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const dept = departmentId || departments?.[0]?._id;
    if (!dept) return;
    const ok = await run(
      () =>
        create({
          hotelId,
          departmentId: dept as Id<"departments">,
          title: title.trim(),
          detail: detail.trim() || undefined,
          roomId: roomId ? (roomId as Id<"rooms">) : undefined,
          priority,
        }),
      "Task created",
    );
    if (ok) {
      setTitle("");
      setDetail("");
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="New task" description="Send work to a team, with or without a room.">
      <form onSubmit={submit} className="space-y-4 pb-2">
        <Field label="What needs doing">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Replace the bathroom bulb" required maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Team">
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              {departments?.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Room">
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">No room</option>
              {rooms?.map((r) => (
                <option key={r._id} value={r._id}>
                  Room {r.number}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Details" hint="Optional">
          <TextArea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} />
        </Field>
        <Segmented
          value={priority}
          onChange={setPriority}
          options={[
            { value: "normal", label: "Normal" },
            { value: "high", label: "Urgent" },
          ]}
        />
        <ArrowButton type="submit" className="w-full" disabled={!title.trim()}>
          Create task
        </ArrowButton>
      </form>
    </Sheet>
  );
}
