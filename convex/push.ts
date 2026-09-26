"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { internal } from "./_generated/api";
import { env, internalAction, type ActionCtx } from "./_generated/server";

type Sub = { endpoint: string; p256dh: string; auth: string };
type SendResult = { sent: number; failed: number };
type PushTarget = {
  title: string;
  quantity?: number;
  roomNumber: string | null;
  guestNote?: string;
  status: string;
  subs: Sub[];
};

async function sendAll(ctx: ActionCtx, subs: Sub[], payload: string): Promise<SendResult> {
  if (!env.VAPID_SUBJECT || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn("Push skipped: VAPID keys are not configured");
    return { sent: 0, failed: 0 };
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 10, urgency: "high" },
        );
        sent++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 = subscription expired or unsubscribed; drop it.
        if (status === 404 || status === 410) {
          await ctx.runMutation(internal.pushSubscriptions.removeByEndpoint, {
            endpoint: sub.endpoint,
          });
        } else {
          console.error("web-push failed", status, error);
        }
      }
    }),
  );
  return { sent, failed };
}

const resultValidator = v.object({ sent: v.number(), failed: v.number() });

/** New task: push to on-shift members of its department (fallback: managers). */
export const notifyTask = internalAction({
  args: { taskId: v.id("tasks") },
  returns: resultValidator,
  handler: async (ctx, { taskId }): Promise<SendResult> => {
    const t: PushTarget | null = await ctx.runQuery(internal.pushSubscriptions.targetsForTask, {
      taskId,
      mode: "task",
    });
    if (!t || t.subs.length === 0) return { sent: 0, failed: 0 };
    const roomPart = t.roomNumber ? `ოთახი ${t.roomNumber} — ` : "";
    const qtyPart = t.quantity ? ` ×${t.quantity}` : "";
    const payload = JSON.stringify({
      title: `${roomPart}${t.title}${qtyPart}`,
      body: t.guestNote ?? "ახალი მოთხოვნა. გახსენი ინსტრუქცია.",
      url: `/queue/${taskId}`,
      tag: `task-${taskId}`,
    });
    return await sendAll(ctx, t.subs, payload);
  },
});

/** Task still open after the department's escalation time. */
export const notifyEscalation = internalAction({
  args: { taskId: v.id("tasks") },
  returns: resultValidator,
  handler: async (ctx, { taskId }): Promise<SendResult> => {
    const t: PushTarget | null = await ctx.runQuery(internal.pushSubscriptions.targetsForTask, {
      taskId,
      mode: "escalation",
    });
    if (!t || t.status !== "open" || t.subs.length === 0) return { sent: 0, failed: 0 };
    const roomPart = t.roomNumber ? `ოთახი ${t.roomNumber} — ` : "";
    const payload = JSON.stringify({
      title: `დაგვიანებული: ${roomPart}${t.title}`,
      body: "მოთხოვნა ჯერ არავის აუღია.",
      url: `/queue/${taskId}`,
      tag: `escalation-${taskId}`,
    });
    return await sendAll(ctx, t.subs, payload);
  },
});
