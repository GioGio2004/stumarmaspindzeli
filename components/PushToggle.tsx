"use client";

import { useMutation } from "convex/react";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Toggle } from "./kit";

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

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscription(sub))
      .catch((e) => setError(String(e)));
  }, [supported]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications are blocked in this browser");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = sub.toJSON();
      await subscribe({ endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth, userAgent: navigator.userAgent });
      setSubscription(sub);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!subscription) return;
    setBusy(true);
    try {
      await unsubscribe({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      setSubscription(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-panel">
        <BellRing className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">Notifications on this phone</p>
        <p className="text-[12px] text-black/50">
          {!supported ? "Not available here. On iPhone, add to Home Screen first." : error ?? "Buzz me when my team gets a task"}
        </p>
      </div>
      {supported && (
        <Toggle label="Notifications" checked={subscription !== null} disabled={busy} onChange={(on) => (on ? turnOn() : turnOff())} />
      )}
    </div>
  );
}
