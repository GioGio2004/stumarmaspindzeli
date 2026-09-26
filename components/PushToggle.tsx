"use client";

import { useMutation, useQuery } from "convex/react";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { errorText } from "@/lib/errors";
import { Toggle } from "./kit";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Registers /sw.js and turns Web Push on or off for this device. iOS needs Home Screen install first. */
export function PushToggle() {
  const subscribe = useMutation(api.pushSubscriptions.subscribe);
  const unsubscribe = useMutation(api.pushSubscriptions.unsubscribe);
  const [supported] = useState(
    () => typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && "PushManager" in window,
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The browser can hold a subscription the server no longer has (another
  // account used this phone, or it was cleaned up). Only both together is "on".
  const known = useQuery(api.pushSubscriptions.isSubscribed, subscription ? { endpoint: subscription.endpoint } : "skip");
  const on = subscription !== null && known === true;

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscription(sub))
      .catch(() => setError("Couldn't start notifications on this device"));
  }, [supported]);

  async function turnOn() {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications are blocked in this browser's settings");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) throw new Error("This browser returned an incomplete subscription");
      await subscribe({ endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, userAgent: navigator.userAgent.slice(0, 300) });
      setSubscription(sub);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!subscription) return;
    setBusy(true);
    setError(null);
    try {
      await unsubscribe({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const hint = !supported
    ? "Not available here. On iPhone, add to Home Screen first."
    : !VAPID_PUBLIC_KEY
      ? "Notifications aren't set up for this app yet."
      : (error ?? "Buzz me when my team gets a task");

  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-panel">
        <BellRing className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">Notifications on this phone</p>
        <p className={error ? "text-[12px] text-red-600" : "text-[12px] text-black/50"}>{hint}</p>
      </div>
      {supported && VAPID_PUBLIC_KEY && (
        <Toggle label="Notifications" checked={on} disabled={busy} onChange={(next) => (next ? turnOn() : turnOff())} />
      )}
    </div>
  );
}
