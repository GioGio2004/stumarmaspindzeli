"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { TaskDetail } from "@/components/tasks";
import type { Id } from "@/convex/_generated/dataModel";

export default function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/queue" className="mb-4 inline-flex items-center gap-2 rounded-full bg-panel px-4 py-2 text-[14px] transition hover:bg-panel-hover">
        <ArrowLeft className="size-4" />
        My queue
      </Link>
      <div className="rounded-[30px] bg-white p-5 ring-1 ring-black/5 sm:p-7">
        <TaskDetail taskId={taskId as Id<"tasks">} onDone={() => router.push("/queue")} />
      </div>
    </div>
  );
}
