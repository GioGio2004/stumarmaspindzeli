"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useHotel, useActiveHotel } from "@/components/hotel-context";
import { EmptyState, PageHeader, Pill, Skeleton } from "@/components/kit";
import { PushToggle } from "@/components/PushToggle";
import { TaskCard } from "@/components/tasks";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

export default function QueuePage() {
  const { hotelId } = useActiveHotel();
  const { current } = useHotel();
  const { user } = useUser();
  const router = useRouter();
  const tasks = useQuery(api.tasks.myQueue, { hotelId });

  const mine = tasks?.filter((t) => t.assigneeUserId !== undefined && t.status !== "open") ?? [];
  const waiting = tasks?.filter((t) => t.status === "open") ?? [];

  return (
    <>
      <PageHeader
        eyebrow={user?.firstName ? `Hi, ${user.firstName}!` : "Hi!"}
        title="My queue"
        description="New tasks for your teams, and the ones you've taken."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {current && !current.onShift && (
            <motion.div
              className="flex items-center justify-between gap-3 rounded-[24px] bg-graphite px-5 py-4 text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[14px]">You&apos;re off shift. Turn your shift on to get new tasks.</p>
              <Pill tone="lime">Off shift</Pill>
            </motion.div>
          )}

          {tasks === undefined ? (
            <div className="space-y-3">
              <Skeleton className="h-28 bg-panel" />
              <Skeleton className="h-28 bg-panel" />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState title="Nothing waiting" body="When a guest asks for something your team handles, it shows up here instantly." />
          ) : (
            <LayoutGroup>
              <QueueSection title="In my hands" count={mine.length}>
                <AnimatePresence mode="popLayout">
                  {mine.map((task) => (
                    <TaskCard key={task._id} task={task} onOpen={(id) => router.push(`/queue/${id}`)} />
                  ))}
                </AnimatePresence>
              </QueueSection>
              <QueueSection title="Waiting for someone" count={waiting.length} highlight>
                <AnimatePresence mode="popLayout">
                  {waiting.map((task) => (
                    <TaskCard key={task._id} task={task} onOpen={(id) => router.push(`/queue/${id}`)} />
                  ))}
                </AnimatePresence>
              </QueueSection>
            </LayoutGroup>
          )}
        </div>

        <aside className="space-y-3">
          <PushToggle />
          <div className="rounded-[24px] bg-panel p-5">
            <p className="text-[13px] font-medium">How it works</p>
            <ol className="mt-3 space-y-2 text-[14px] text-black/65">
              <li>1. Accept a task so the team knows it&apos;s yours.</li>
              <li>2. Follow the playbook steps, ticking each one.</li>
              <li>3. Mark it done. The guest sees it live.</li>
            </ol>
            <Link href="/requests" className="mt-4 inline-block text-[13px] font-medium underline underline-offset-4">
              See the whole board
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

function QueueSection({
  title,
  count,
  highlight,
  children,
}: {
  title: string;
  count: number;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mb-4 rounded-[28px] bg-panel p-3">
      <div className="mb-3 flex items-center justify-between px-2 pt-1">
        <h2 className="text-[15px] font-medium">{title}</h2>
        <Pill tone={highlight ? "lime" : "white"}>{count}</Pill>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
