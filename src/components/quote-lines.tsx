import { formatRub } from "@/lib/format";
import type { QuoteLine } from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Price breakdown: one row per line of the calculation, then the total
export function QuoteLines({ lines, total, className }: { lines: QuoteLine[]; total: number; className?: string }) {
  return (
    <dl className={cn("flex flex-col gap-3 text-[15px]", className)}>
      {lines.map((l) => (
        <div key={l.label} className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">{l.label}</dt>
          <dd className="shrink-0 font-medium tabular-nums">{formatRub(l.amount)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 border-t pt-3 font-semibold">
        <dt>Итого</dt>
        <dd className="tabular-nums">{formatRub(total)}</dd>
      </div>
    </dl>
  );
}
