export type TaskStatus = "open" | "accepted" | "in_progress" | "done" | "cancelled";

export const statusMeta: Record<TaskStatus, { label: string; dot: string; pulse?: boolean }> = {
  open: { label: "New", dot: "bg-lime ring-2 ring-lime/40", pulse: true },
  accepted: { label: "Accepted", dot: "bg-slate-ink" },
  in_progress: { label: "In progress", dot: "bg-ink" },
  done: { label: "Done", dot: "bg-emerald-600" },
  cancelled: { label: "Cancelled", dot: "bg-black/25" },
};

export const boardColumns: { status: Exclude<TaskStatus, "cancelled">; title: string }[] = [
  { status: "open", title: "New" },
  { status: "accepted", title: "Accepted" },
  { status: "in_progress", title: "In progress" },
  { status: "done", title: "Done today" },
];

export type Role = "manager" | "reception" | "staff";

export const roleLabel: Record<Role, string> = {
  manager: "Manager",
  reception: "Front desk",
  staff: "Staff",
};
