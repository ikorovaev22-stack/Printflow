"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStatuses } from "@/components/statuses";

export function OrdersToolbar({ withStatus = true }: { withStatus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const statuses = useStatuses();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`);
  };

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <div className="relative min-w-60 flex-1">
        <Search className="absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру, названию, клиенту" aria-label="Поиск" className="rounded-full border-transparent pl-11" />
      </div>
      {withStatus && (
        <Select value={params.get("status") ?? "all"} onValueChange={(v) => update("status", v === "all" ? "" : v)}>
          <SelectTrigger className="h-11 w-48 border-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">В работе</SelectItem>
            <SelectItem value="overdue">Просроченные</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
