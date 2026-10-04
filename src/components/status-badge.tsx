import { ClipboardList, CircleCheck, PackageCheck, PenTool, Printer, Scissors, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusMeta, type OrderStatus } from "@/lib/types";

export const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  accepted: ClipboardList,
  design: PenTool,
  printing: Printer,
  finishing: Scissors,
  ready: PackageCheck,
  delivered: CircleCheck,
};

const tones = {
  default: "bg-muted text-foreground",
  glass: "bg-white/15 text-white backdrop-blur-md",
  ink: "bg-black/10 text-foreground",
};

// Status = label + colored dot (never color alone); "ready" is the one lime highlight
export function StatusBadge({
  status,
  tone = "default",
  className,
}: {
  status: OrderStatus;
  tone?: keyof typeof tones;
  className?: string;
}) {
  const meta = statusMeta(status);
  const lime = tone === "default" && status === "ready";
  return (
    <Badge className={cn("h-7 px-3", lime ? "bg-lime text-lime-foreground" : tones[tone], className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", lime ? "bg-lime-foreground" : meta.dot)} />
      {meta.label}
    </Badge>
  );
}
