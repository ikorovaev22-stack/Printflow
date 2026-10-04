import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUSES, type OrderStatus } from "@/lib/types";

export function OrderProgress({ status }: { status: OrderStatus }) {
  const idx = STATUSES.findIndex((s) => s.value === status);
  return (
    <div className="flex gap-1">
      {STATUSES.map((s, i) => (
        <div key={s.value} className={cn("h-1.5 flex-1 rounded-full", i <= idx ? "bg-primary" : "bg-muted")} />
      ))}
    </div>
  );
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const idx = STATUSES.findIndex((s) => s.value === status);
  return (
    <ol className="flex flex-col">
      {STATUSES.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <li key={s.value} className="relative flex gap-3 pb-5 last:pb-0">
            {i < STATUSES.length - 1 && (
              <span className={cn("absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-0.5", i < idx ? "bg-primary" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                current && "border-primary bg-background text-primary ring-4 ring-primary/15",
                !done && !current && "border-border bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="pt-0.5">
              <p className={cn("font-medium", !done && !current && "text-muted-foreground")}>{s.label}</p>
              {current && <p className="text-sm text-primary">Текущий этап</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
