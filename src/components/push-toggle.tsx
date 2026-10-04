"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push-client";
import { cn } from "@/lib/utils";

const HINTS: Record<PushState, string> = {
  on: "Сообщим о смене статуса, новых файлах и ответах",
  off: "Сообщим о смене статуса, новых файлах и ответах",
  denied: "Уведомления запрещены в настройках браузера",
  install: "На iPhone сначала установите приложение на экран «Домой»",
  unsupported: "Этот браузер не поддерживает уведомления",
};

function usePush() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    pushState().then(setState, () => setState("unsupported"));
  }, []);
  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      setState(await (on ? enablePush() : disablePush()));
    } catch {
      toast.error("Не удалось включить уведомления");
    } finally {
      setBusy(false);
    }
  };
  return { state, busy, toggle, available: state === "on" || state === "off" };
}

// Card row for the client profile
export function PushToggle() {
  const { state, busy, toggle, available } = usePush();
  return (
    <label className={cn("flex items-center gap-4 rounded-card bg-card p-4", available && "cursor-pointer")}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
        {state === "on" ? <Bell className="size-5" /> : <BellOff className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Уведомления</span>
        <span className="block text-sm text-muted-foreground">{state ? HINTS[state] : "Проверяем…"}</span>
      </span>
      <Switch checked={state === "on"} disabled={!available || busy} onCheckedChange={toggle} aria-label="Уведомления" />
    </label>
  );
}

// Compact icon button for the admin sidebar
export function PushButton({ className }: { className?: string }) {
  const { state, busy, toggle, available } = usePush();
  if (!state || state === "unsupported") return null;
  const label = state === "on" ? "Выключить уведомления" : available ? "Включить уведомления" : HINTS[state];
  return (
    <button
      type="button"
      disabled={!available || busy}
      onClick={() => toggle(state !== "on")}
      aria-label={label}
      title={label}
      aria-pressed={state === "on"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-card disabled:opacity-50",
        state === "on" ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {state === "on" ? <Bell className="size-4" /> : <BellOff className="size-4" />}
    </button>
  );
}
