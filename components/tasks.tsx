"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "motion/react";
import { AlertTriangle, Check, DoorOpen, Hand, Undo2, UserRound, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { clockTime, timeAgo, useNow } from "@/lib/format";
import { statusMeta, type TaskStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useActiveHotel } from "./hotel-context";
import { Avatar, Button, Pill, Select, Sheet, Skeleton, useRun } from "./kit";

export type BoardTask = FunctionReturnType<typeof api.tasks.board>["open"][number];

export function StatusDot({ status }: { status: TaskStatus }) {
  const meta = statusMeta[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-black/60">
      <span className={cn("size-2 rounded-full", meta.dot, meta.pulse && "animate-pulse")} />
      {meta.label}
    </span>
  );
}

/** Compact card used on the board and in the queue. Its layoutId lets it glide between columns. */
export function TaskCard({
  task,
  onOpen,
  compact,
}: {
  task: BoardTask;
  onOpen: (id: Id<"tasks">) => void;
  compact?: boolean;
}) {
  const now = useNow();
  const accept = useMutation(api.tasks.accept);
  const complete = useMutation(api.tasks.complete);
  const run = useRun();
  const status = task.status as TaskStatus;

  return (
    <motion.article
      layout
      layoutId={`task-${task._id}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
      className={cn(
        "group relative cursor-pointer rounded-[22px] bg-white p-4 ring-1 ring-transparent transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]",
        task.escalatedAt && status === "open" && "ring-red-300",
      )}
      onClick={() => onOpen(task._id)}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-12 min-w-12 shrink-0 place-items-center rounded-2xl px-2 text-[15px] font-semibold tabular-nums",
            status === "open" ? "bg-lime" : "bg-panel",
          )}
        >
          {task.roomNumber ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight">
            {task.title}
            {task.quantity && task.quantity > 1 && !task.title.startsWith("Order") ? ` ×${task.quantity}` : ""}
          </p>
          {(task.guestNote || task.detail) && (
            <p className="mt-0.5 line-clamp-2 text-[13px] text-black/55">{task.guestNote ?? task.detail}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill tone="stone">{task.departmentName}</Pill>
            {task.escalatedAt && status === "open" && (
              <Pill tone="danger">
                <AlertTriangle className="size-3" />
                Escalated
              </Pill>
            )}
            {task.priority === "high" && !task.escalatedAt && <Pill tone="ink">Urgent</Pill>}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-3">
          <span className="flex min-w-0 items-center gap-2 text-[12px] text-black/50">
            {task.assigneeName ? (
              <>
                <Avatar name={task.assigneeName} size={22} />
                <span className="truncate">{task.assigneeName}</span>
              </>
            ) : (
              <span>{timeAgo(task._creationTime, now)}</span>
            )}
          </span>
          {status === "open" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                run(() => accept({ taskId: task._id }), "Accepted");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-medium text-white transition hover:bg-black"
            >
              <Hand className="size-3.5 text-lime" />
              Accept
            </button>
          )}
          {(status === "accepted" || status === "in_progress") && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                run(() => complete({ taskId: task._id }), "Marked done");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-lime px-3 text-[12px] font-medium text-black transition hover:brightness-95"
            >
              <Check className="size-3.5" />
              Done
            </button>
          )}
          {status === "done" && task.doneAt && <span className="text-[12px] text-black/45">{clockTime(task.doneAt)}</span>}
        </div>
      )}
    </motion.article>
  );
}

/** Full task view: timeline, playbook steps and the actions this member may take. */
export function TaskSheet({ taskId, onClose }: { taskId: Id<"tasks"> | null; onClose: () => void }) {
  return (
    <Sheet open={taskId !== null} onClose={onClose} title="Task" width="max-w-xl">
      {taskId && <TaskDetail taskId={taskId} onDone={onClose} />}
    </Sheet>
  );
}

export function TaskDetail({ taskId, onDone }: { taskId: Id<"tasks">; onDone?: () => void }) {
  const { hotelId, role } = useActiveHotel();
  const task = useQuery(api.tasks.get, { taskId });
  const members = useQuery(api.members.list, role === "staff" ? "skip" : { hotelId });
  const accept = useMutation(api.tasks.accept);
  const release = useMutation(api.tasks.release);
  const toggleStep = useMutation(api.tasks.toggleStep);
  const complete = useMutation(api.tasks.complete);
  const cancel = useMutation(api.tasks.cancel);
  const assign = useMutation(api.tasks.assign);
  const run = useRun();
  const now = useNow();

  if (task === undefined) return <Skeleton className="h-64 bg-panel" />;
  if (task === null) return <p className="text-black/55">This task no longer exists.</p>;

  const status = task.status as TaskStatus;
  const active = status === "accepted" || status === "in_progress";
  const timeline = [
    { label: "Requested", at: task._creationTime },
    { label: "Accepted", at: task.acceptedAt },
    { label: "Started", at: task.startedAt },
    { label: "Done", at: task.doneAt },
  ];

  return (
    <div className="space-y-5 pb-2">
      <div className="flex items-start gap-4">
        <span className="grid h-16 min-w-16 place-items-center rounded-[20px] bg-lime px-3 text-2xl font-semibold tabular-nums">
          {task.roomNumber ?? <DoorOpen className="size-6" />}
        </span>
        <div className="min-w-0">
          <h3 className="text-xl font-medium leading-tight">
            {task.title}
            {task.quantity && task.quantity > 1 && !task.title.startsWith("Order") ? ` ×${task.quantity}` : ""}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusDot status={status} />
            <Pill tone="stone">{task.departmentName}</Pill>
            <span className="text-[12px] text-black/45">{timeAgo(task._creationTime, now)}</span>
          </div>
        </div>
      </div>

      {(task.guestNote || task.detail) && (
        <div className="rounded-[20px] bg-paper p-4 text-[14px]">
          {task.detail && <p>{task.detail}</p>}
          {task.guestNote && (
            <p className="mt-1 text-black/60">
              <span className="font-medium text-black">Guest note: </span>
              {task.guestNote}
            </p>
          )}
        </div>
      )}

      <ol className="grid grid-cols-4 gap-1.5">
        {timeline.map((step) => (
          <li key={step.label} className={cn("rounded-2xl px-2.5 py-2", step.at ? "bg-ink text-white" : "bg-panel text-black/45")}>
            <p className="text-[11px]">{step.label}</p>
            <p className="text-[13px] font-medium tabular-nums">{step.at ? clockTime(step.at) : "—"}</p>
          </li>
        ))}
      </ol>

      {task.steps.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-medium">Playbook</p>
          <ol className="space-y-1.5">
            {task.steps.map((step, index) => {
              const done = Boolean(step.doneAt);
              return (
                <li key={index}>
                  <button
                    type="button"
                    disabled={!active}
                    onClick={() => run(() => toggleStep({ taskId, index }))}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[18px] px-3.5 py-3 text-left transition",
                      done ? "bg-lime/35" : "bg-paper hover:bg-panel",
                      !active && "cursor-default",
                    )}
                  >
                    <motion.span
                      className={cn(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                        done ? "bg-ink text-lime" : "bg-white ring-1 ring-black/15",
                      )}
                      animate={done ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {done ? <Check className="size-3.5" /> : <span className="text-[11px] text-black/45">{index + 1}</span>}
                    </motion.span>
                    <span className={cn("text-[15px] leading-snug", done && "text-black/50 line-through")}>{step.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {role !== "staff" && members && status !== "done" && status !== "cancelled" && (
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
            <UserRound className="size-3.5" />
            Assigned to
          </span>
          <Select
            value={task.assigneeUserId ?? ""}
            onChange={(e) => {
              const userId = e.target.value as Id<"users">;
              if (userId) run(() => assign({ taskId, userId }), "Assigned");
            }}
          >
            <option value="">Nobody yet</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {status === "open" && (
          <Button variant="primary" size="lg" className="flex-1" onClick={() => run(() => accept({ taskId }), "Accepted")}>
            <Hand className="size-4 text-lime" />
            Accept task
          </Button>
        )}
        {active && (
          <>
            <Button
              variant="lime"
              size="lg"
              className="flex-1"
              onClick={async () => {
                const ok = await run(() => complete({ taskId }), "Marked done");
                if (ok !== undefined) onDone?.();
              }}
            >
              <Check className="size-4" />
              Mark done
            </Button>
            <Button variant="ghost" size="lg" onClick={() => run(() => release({ taskId }), "Released")}>
              <Undo2 className="size-4" />
              Release
            </Button>
          </>
        )}
        {role !== "staff" && status !== "done" && status !== "cancelled" && (
          <Button
            variant="danger"
            size="lg"
            onClick={async () => {
              const ok = await run(() => cancel({ taskId }), "Task cancelled");
              if (ok !== undefined) onDone?.();
            }}
          >
            <X className="size-4" />
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
