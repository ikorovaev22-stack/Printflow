"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "pf-install-dismissed";

export function InstallBanner() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|YaBrowser/.test(ua)) setMode("ios");
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setMode(null);
  };

  return (
    <div className="relative mb-4 flex items-center gap-3 rounded-3xl bg-primary/10 p-4 pr-10">
      <SquarePlus className="size-8 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Установите приложение</p>
        {mode === "ios" ? (
          <p className="text-muted-foreground">
            Нажмите <Share className="inline size-4 align-text-bottom" /> «Поделиться», затем «На экран Домой»
          </p>
        ) : (
          <p className="text-muted-foreground">Статус заказов всегда под рукой</p>
        )}
      </div>
      {mode === "android" && event && (
        <Button
          size="sm"
          onClick={async () => {
            await event.prompt();
            if ((await event.userChoice).outcome === "accepted") setMode(null);
          }}
        >
          Установить
        </Button>
      )}
      <button onClick={dismiss} className="absolute top-2 right-2 p-1 text-muted-foreground" aria-label="Скрыть">
        <X className="size-4" />
      </button>
    </div>
  );
}
