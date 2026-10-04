"use client";

import { useState, useTransition } from "react";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { updateOrder } from "@/app/actions/orders";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useTimeZone } from "@/components/time-zone";
import { formatDateShort, toISODate, todayISO } from "@/lib/format";
import { STATUSES, type OrderStatus } from "@/lib/types";

function useUpdate(id: string) {
  const [pending, start] = useTransition();
  const run = (patch: Parameters<typeof updateOrder>[1]) =>
    start(async () => {
      try {
        await updateOrder(id, patch);
        toast.success("Заказ обновлён");
      } catch {
        toast.error("Не удалось обновить заказ");
      }
    });
  return [pending, run] as const;
}

export function StatusSelect({ id, status }: { id: string; status: OrderStatus }) {
  const [pending, run] = useUpdate(id);
  return (
    <Select value={status} onValueChange={(v) => run({ status: v as OrderStatus })} disabled={pending}>
      <SelectTrigger size="sm" className="h-8 w-[140px] border-none bg-transparent px-1 shadow-none">
        <StatusBadge status={status} />
      </SelectTrigger>
      <SelectContent position="popper">
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            <StatusBadge status={s.value} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DueDatePicker({ id, due, status }: { id: string; due: string | null; status: OrderStatus }) {
  const [open, setOpen] = useState(false);
  const [pending, run] = useUpdate(id);
  const timeZone = useTimeZone();
  const overdue = due && due < todayISO(timeZone) && status !== "ready" && status !== "delivered";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} className={overdue ? "text-destructive" : undefined}>
          <CalendarIcon className="size-4 opacity-60" />
          {formatDateShort(due)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ru}
          selected={due ? new Date(`${due}T00:00:00`) : undefined}
          onSelect={(d) => {
            setOpen(false);
            run({ due_date: d ? toISODate(d) : null });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
