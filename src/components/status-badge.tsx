import { cn } from "@/lib/utils";
import { statusMeta, type OrderStatus } from "@/lib/types";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", meta.className, className)}>
      {meta.label}
    </span>
  );
}
