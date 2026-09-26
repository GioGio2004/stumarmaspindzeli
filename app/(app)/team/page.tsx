"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AnimatePresence, motion } from "motion/react";
import { Archive, Copy, Plus, RefreshCw, Timer, UserMinus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useActiveHotel } from "@/components/hotel-context";
import {
  ArrowButton,
  Avatar,
  Button,
  Card,
  Field,
  PageHeader,
  Pill,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  TextInput,
  useRun,
  useToast,
} from "@/components/kit";
import { Invitations } from "@/components/invitations";
import { RoleGate } from "@/components/role-gate";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { iconFor, iconKeys } from "@/lib/icons";
import { roleLabel, type Role } from "@/lib/status";
import { cn } from "@/lib/utils";

type Member = FunctionReturnType<typeof api.members.list>[number];
type Department = FunctionReturnType<typeof api.departments.list>[number];

export default function TeamPage() {
  return (
    <RoleGate allow={["manager"]}>
      <Team />
    </RoleGate>
  );
}

function Team() {
  const [tab, setTab] = useState<"members" | "departments">("members");
  return (
    <>
      <PageHeader
        eyebrow="Your people"
        title="Team"
        description="Put each person in the departments they work for. They only see requests for those teams."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "members", label: "Members" },
              { value: "departments", label: "Departments" },
            ]}
          />
        }
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {tab === "members" ? <Members /> : <Departments />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function InviteCard() {
  const { hotelId, hotel } = useActiveHotel();
  const regenerate = useMutation(api.hotels.regenerateJoinCode);
  const run = useRun();
  const toast = useToast();
  return (
    <Card tone="dark" className="flex flex-col justify-between gap-6">
      <div>
        <p className="text-[13px] text-white/60">Join code</p>
        <p className="mt-1 text-[15px]">People who already have an account can join with this code.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] text-lime">{hotel.joinCode}</span>
        <button
          type="button"
          aria-label="Copy join code"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(hotel.joinCode);
              toast("Code copied");
            } catch {
              toast("Copy blocked by the browser", "error");
            }
          }}
          className="grid size-12 place-items-center rounded-full bg-white/10 transition hover:bg-lime hover:text-black"
        >
          <Copy className="size-4" />
        </button>
        <button
          type="button"
          aria-label="New code"
          title="New code: the old one stops working"
          onClick={() => run(() => regenerate({ hotelId }), "New join code ready")}
          className="grid size-12 place-items-center rounded-full bg-white/10 transition hover:bg-lime hover:text-black"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>
    </Card>
  );
}

function Members() {
  const { hotelId } = useActiveHotel();
  const members = useQuery(api.members.list, { hotelId });
  const departments = useQuery(api.departments.list, { hotelId });
  const [editing, setEditing] = useState<Member | null>(null);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-[30px] bg-panel p-3 sm:p-4">
        {members === undefined ? (
          <Skeleton className="h-60" />
        ) : (
          <ul className="space-y-2">
            {members.map((member, i) => (
              <motion.li
                key={member.membershipId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <button
                  type="button"
                  onClick={() => setEditing(member)}
                  className="flex w-full flex-wrap items-center gap-3 rounded-[22px] bg-white px-4 py-3 text-left transition hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
                >
                  <span className="relative">
                    <Avatar name={member.name} imageUrl={member.imageUrl} size={42} />
                    <span className={cn("absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white", member.onShift ? "bg-lime" : "bg-black/20")} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{member.name}</p>
                    <p className="truncate text-[12px] text-black/45">{member.email ?? "No email"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={member.role === "manager" ? "ink" : member.role === "reception" ? "lime" : "stone"}>{roleLabel[member.role as Role]}</Pill>
                    {member.departmentIds.map((id) => {
                      const d = departments?.find((x) => x._id === id);
                      return d ? (
                        <Pill key={id} tone="outline">
                          {d.name}
                        </Pill>
                      ) : null;
                    })}
                    <span className="text-[12px] text-black/45">{member.completedTaskCount} done</span>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-3">
        <Invitations />
        <InviteCard />
      </div>
      <MemberSheet member={editing} departments={departments ?? []} onClose={() => setEditing(null)} />
    </div>
  );
}

function MemberSheet({ member, departments, onClose }: { member: Member | null; departments: Department[]; onClose: () => void }) {
  return (
    <Sheet open={member !== null} onClose={onClose} title={member?.name ?? "Member"} description={member?.email} width="max-w-lg">
      {member && <MemberForm key={member.membershipId} member={member} departments={departments} onDone={onClose} />}
    </Sheet>
  );
}

function MemberForm({ member, departments, onDone }: { member: Member; departments: Department[]; onDone: () => void }) {
  const update = useMutation(api.members.update);
  const remove = useMutation(api.members.remove);
  const run = useRun();
  const [role, setRole] = useState<Role>(member.role as Role);
  const [selected, setSelected] = useState<Id<"departments">[]>(member.departmentIds);

  const toggle = (id: Id<"departments">) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <div className="space-y-5 pb-2">
      <div>
        <span className="mb-1.5 block text-[13px] font-medium">Role</span>
        <Segmented
          value={role}
          onChange={setRole}
          options={(["staff", "reception", "manager"] as Role[]).map((r) => ({ value: r, label: roleLabel[r] }))}
        />
        <p className="mt-2 text-[12px] text-black/50">
          {role === "staff" && "Sees and works tasks for their departments only."}
          {role === "reception" && "Checks guests in and out, sees every request."}
          {role === "manager" && "Full access: catalog, team, rooms and settings."}
        </p>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium">Departments</span>
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => {
            const on = selected.includes(d._id);
            const Icon = iconFor(d.icon);
            return (
              <motion.button
                key={d._id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(d._id)}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] transition-colors",
                  on ? "bg-ink text-white" : "bg-panel text-black/70 hover:bg-panel-hover",
                )}
              >
                <Icon className={cn("size-4", on && "text-lime")} />
                {d.name}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="danger"
          size="lg"
          onClick={async () => {
            const ok = await run(() => remove({ membershipId: member.membershipId }), `${member.name} removed`);
            if (ok !== undefined) onDone();
          }}
        >
          <UserMinus className="size-4" />
        </Button>
        <ArrowButton
          className="flex-1"
          onClick={async () => {
            const ok = await run(
              () => update({ membershipId: member.membershipId, role, departmentIds: selected }),
              "Saved",
            );
            if (ok !== undefined) onDone();
          }}
        >
          Save
        </ArrowButton>
      </div>
    </div>
  );
}

function Departments() {
  const { hotelId } = useActiveHotel();
  const departments = useQuery(api.departments.list, { hotelId });
  const [editing, setEditing] = useState<Department | "new" | null>(null);

  return (
    <div className="rounded-[30px] bg-panel p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {departments === undefined && <Skeleton className="h-40" />}
        {departments?.map((d, i) => {
          const Icon = iconFor(d.icon);
          return (
            <motion.button
              key={d._id}
              type="button"
              layoutId={`dept-${d._id}`}
              onClick={() => setEditing(d)}
              style={{ borderRadius: 24 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, type: "spring", bounce: 0.14, duration: 0.5 }}
              whileHover={{ y: -3 }}
              className="flex min-h-[160px] flex-col bg-white p-5 text-left"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-full bg-panel">
                  <Icon className="size-[18px]" />
                </span>
                <Pill tone={d.openTaskCount > 0 ? "lime" : "stone"}>{d.openTaskCount} open</Pill>
              </div>
              <p className="mt-auto text-lg font-medium">{d.name}</p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-black/50">
                <Timer className="size-3.5" />
                Escalates after {d.escalationMinutes} min
              </p>
            </motion.button>
          );
        })}
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-black/10 text-[14px] font-medium text-black/55 transition hover:border-black/25 hover:text-black"
        >
          <Plus className="size-5" />
          New department
        </button>
      </div>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        layoutId={editing && editing !== "new" ? `dept-${editing._id}` : undefined}
        title={editing === "new" ? "New department" : "Edit department"}
        width="max-w-lg"
      >
        {editing !== null && (
          <DepartmentForm key={editing === "new" ? "new" : editing._id} department={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </div>
  );
}

function DepartmentForm({ department, onDone }: { department: Department | null; onDone: () => void }) {
  const { hotelId } = useActiveHotel();
  const create = useMutation(api.departments.create);
  const update = useMutation(api.departments.update);
  const archive = useMutation(api.departments.archive);
  const run = useRun();
  const [name, setName] = useState(department?.name ?? "");
  const [icon, setIcon] = useState(department?.icon ?? "housekeeping");
  const [minutes, setMinutes] = useState(String(department?.escalationMinutes ?? 15));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fields = { name: name.trim(), icon, escalationMinutes: Number(minutes) };
    const ok = department
      ? await run(() => update({ departmentId: department._id, ...fields }), "Department saved")
      : await run(() => create({ hotelId, ...fields }), "Department added");
    if (ok !== undefined) onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Housekeeping" />
      </Field>
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
      <Field label="Escalate after" hint="If nobody accepts a request in this time, managers are alerted.">
        <Select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
          {[5, 10, 15, 20, 30, 45, 60].map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-2">
        {department && (
          <Button
            variant="danger"
            size="lg"
            onClick={async () => {
              const ok = await run(() => archive({ departmentId: department._id }), "Department archived");
              if (ok !== undefined) onDone();
            }}
          >
            <Archive className="size-4" />
          </Button>
        )}
        <ArrowButton type="submit" className="flex-1" disabled={!name.trim()}>
          {department ? "Save" : "Add department"}
        </ArrowButton>
      </div>
    </form>
  );
}
