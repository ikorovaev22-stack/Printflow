// Browser side of Web Push: subscribe this device for the signed-in user, or release it
import { createClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushState = "unsupported" | "install" | "denied" | "off" | "on";

const supported = () =>
  Boolean(VAPID_PUBLIC_KEY) && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as { standalone?: boolean }).standalone);

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await createClient().rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
  });
  if (error) throw error;
}

const currentSubscription = async () => (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() ?? null;

// Current state; an existing subscription is re-attached to whoever is signed in on this device now
export async function pushState(): Promise<PushState> {
  if (!supported()) return isIOS() && !standalone() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await currentSubscription();
  if (sub && Notification.permission === "granted") {
    await save(sub).catch(() => {});
    return "on";
  }
  return "off";
}

export async function enablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return Notification.permission === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) }));
  await save(sub);
  return "on";
}

export async function disablePush(): Promise<PushState> {
  try {
    const sub = "serviceWorker" in navigator ? await currentSubscription() : null;
    if (sub) {
      await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    // Signing out must never be blocked by push cleanup
  }
  return "off";
}
