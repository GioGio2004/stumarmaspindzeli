"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { Link2, MailPlus, RotateCw, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { roleLabel, type Role } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useActiveHotel } from "./hotel-context";
import { ArrowButton, Card, Pill, Segmented, TextInput, useRun, useToast } from "./kit";

const STATUS_TONE = { pending: "lime", accepted: "success", revoked: "stone", failed: "danger" } as const;

/** Email invitations: Clerk sends the email, the membership appears when they sign up. */
export function Invitations() {
  const { hotelId } = useActiveHotel();
  const invitations = useQuery(api.invitations.list, { hotelId });
  const departments = useQuery(api.departments.list, { hotelId });
  const create = useMutation(api.invitations.create);
  const revoke = useMutation(api.invitations.revoke);
  const resend = useMutation(api.invitations.resend);
  const run = useRun();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [selected, setSelected] = useState<Id<"departments">[]>([]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(
      () => create({ hotelId, email: email.trim().toLowerCase(), role, departmentIds: selected }),
      `Invitation sent to ${email.trim()}`,
    );
    if (ok !== undefined) {
      setEmail("");
      setSelected([]);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-4">
        <div>
          <p className="text-[15px] font-medium">Invite by email</p>
          <p className="text-[13px] text-black/50">Only invited people can create an account. Emails can land in spam, so you can also copy the link and send it yourself.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nino@hotel.ge" required />
          <Segmented
            size="sm"
            value={role}
            onChange={setRole}
            options={(["staff", "reception", "manager"] as Role[]).map((r) => ({ value: r, label: roleLabel[r] }))}
          />
          {role !== "manager" && (
            <div className="flex flex-wrap gap-1.5">
              {departments?.map((d) => {
                const on = selected.includes(d._id);
                return (
                  <button
                    key={d._id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected((list) => (on ? list.filter((x) => x !== d._id) : [...list, d._id]))}
                    className={cn("h-9 rounded-full px-3 text-[13px] transition", on ? "bg-ink text-white" : "bg-panel text-black/65")}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}
          <ArrowButton type="submit" className="w-full" disabled={!email.includes("@")}>
            <span className="inline-flex items-center gap-2">
              <MailPlus className="size-4" />
              Send invitation
            </span>
          </ArrowButton>
        </form>
      </Card>

      {invitations && invitations.length > 0 && (
        <Card className="p-3" delay={0.05}>
          <p className="px-2 pb-2 pt-1 text-[13px] font-medium text-black/55">Invitations</p>
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {invitations.map((inv) => (
                <motion.li
                  key={inv._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-2xl px-2 py-2 hover:bg-paper"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{inv.email}</p>
                    <p className="truncate text-[12px] text-black/45">
                      {roleLabel[inv.role as Role]}
                      {inv.error ? ` · ${inv.error}` : ""}
                    </p>
                  </div>
                  <Pill tone={STATUS_TONE[inv.status as keyof typeof STATUS_TONE]}>{inv.status}</Pill>
                  {inv.inviteUrl && (
                    <button
                      type="button"
                      aria-label={`Copy invite link for ${inv.email}`}
                      title="Copy the sign-up link to send by WhatsApp or Telegram"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inv.inviteUrl!);
                          toast("Invite link copied");
                        } catch {
                          toast("Copy blocked by the browser", "error");
                        }
                      }}
                      className="grid size-8 place-items-center rounded-full hover:bg-panel"
                    >
                      <Link2 className="size-3.5" />
                    </button>
                  )}
                  {(inv.status === "pending" || inv.status === "failed") && (
                    <>
                      <button
                        type="button"
                        aria-label={`Resend to ${inv.email}`}
                        onClick={() => run(() => resend({ invitationId: inv._id }), "Sent again")}
                        className="grid size-8 place-items-center rounded-full hover:bg-panel"
                      >
                        <RotateCw className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Revoke ${inv.email}`}
                        onClick={() => run(() => revoke({ invitationId: inv._id }), "Invitation revoked")}
                        className="grid size-8 place-items-center rounded-full text-red-600 hover:bg-red-50"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      )}
    </div>
  );
}
