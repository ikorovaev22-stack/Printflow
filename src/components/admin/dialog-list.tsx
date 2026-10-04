"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTimeZone } from "@/components/time-zone";
import { formatChatTime } from "@/lib/format";

export type Dialog = { clientId: string; name: string; last: string; lastFromClient: boolean; at: string; unread: number };

export function DialogList({ dialogs }: { dialogs: Dialog[] }) {
  const pathname = usePathname();
  const timeZone = useTimeZone();
  if (!dialogs.length) return <p className="p-6 text-sm text-muted-foreground">Пока нет сообщений</p>;
  return (
    <ul>
      {dialogs.map((d) => (
        <li key={d.clientId}>
          <Link
            href={`/admin/chat/${d.clientId}`}
            className={cn(
              "flex gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/60",
              pathname.endsWith(d.clientId) && "bg-muted",
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
              {d.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn("truncate", d.unread ? "font-semibold" : "font-medium")}>{d.name}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatChatTime(d.at, timeZone)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={cn("truncate text-sm", d.unread ? "text-foreground" : "text-muted-foreground")}>
                  {!d.lastFromClient && "Вы: "}
                  {d.last}
                </p>
                {!!d.unread && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                    {d.unread}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
