import { Check } from "lucide-react";
import { STATUS_ICONS } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { STATUSES, type OrderStatus } from "@/lib/types";

const indexOf = (status: OrderStatus) => STATUSES.findIndex((s) => s.value === status);

// Segmented progress; "light" is for dark/lime hero surfaces
export function OrderProgress({ status, tone = "brand" }: { status: OrderStatus; tone?: "brand" | "light" | "ink" }) {
  const idx = indexOf(status);
  const on = { brand: "bg-brand", light: "bg-white", ink: "bg-lime-foreground" }[tone];
  const off = { brand: "bg-muted", light: "bg-white/20", ink: "bg-black/10" }[tone];
  return (
    <div
      className="flex gap-1"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STATUSES.length}
      aria-valuenow={idx + 1}
      aria-label={`Этап ${idx + 1} из ${STATUSES.length}`}
    >
      {STATUSES.map((s, i) => (
        <span key={s.value} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= idx ? on : off)} />
      ))}
    </div>
  );
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const idx = indexOf(status);
  return (
    <ol className="flex flex-col">
      {STATUSES.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        const Icon = STATUS_ICONS[s.value];
        return (
          <li key={s.value} className="relative flex items-center gap-4 pb-5 last:pb-0" aria-current={current ? "step" : undefined}>
            {i < STATUSES.length - 1 && (
              <span
                aria-hidden
                className={cn("absolute top-10 left-5 h-[calc(100%-2.5rem)] w-0.5 -translate-x-1/2", done ? "bg-foreground" : "bg-border")}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full",
                done && "bg-foreground text-background",
                current && "bg-brand text-brand-foreground ring-4 ring-brand/15",
                !done && !current && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4.5" strokeWidth={2.5} /> : <Icon className="size-4.5" />}
            </span>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <p className={cn("font-medium", !done && !current && "text-muted-foreground")}>{s.label}</p>
              {current && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">Сейчас</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
