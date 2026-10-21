"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Star } from "lucide-react";
import { searchMessages, type MessageHit } from "@/app/actions/messages";
import { Input } from "@/components/ui/input";
import { useTimeZone } from "@/components/time-zone";
import { formatChatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Dialog = {
  clientId: string;
  name: string;
  last: string;
  lastFromClient: boolean;
  lastAi: boolean;
  at: string;
  unread: number;
  closed: boolean;
  repeat: boolean;
  // The AI assistant's pending draft, or a question it passed to a manager
  ai?: "draft" | "handoff";
};

// Folders "Активные" / "Завершённые" and search by name (here) and message text (on the server)
export function DialogList({ dialogs }: { dialogs: Dialog[] }) {
  const [folder, setFolder] = useState<"active" | "closed">("active");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; hits: MessageHit[] }>({ q: "", hits: [] });
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    let stale = false;
    const t = setTimeout(() => searchMessages(q).then((hits) => !stale && setFound({ q, hits })), 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  const active = dialogs.filter((d) => !d.closed);
  const closed = dialogs.filter((d) => d.closed);

  return (
    <>
      <div className="flex flex-col gap-3 border-b px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя или текст сообщения"
            aria-label="Поиск по чатам"
            className="rounded-full border-transparent bg-muted pl-10"
          />
        </div>
        {!q && (
          <div role="tablist" aria-label="Папки" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            <FolderTab label="Активные" count={active.length} selected={folder === "active"} onSelect={() => setFolder("active")} />
            <FolderTab label="Завершённые" count={closed.length} selected={folder === "closed"} onSelect={() => setFolder("closed")} />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {q ? (
          <SearchResults q={q} dialogs={dialogs} hits={found.q === q ? found.hits : null} />
        ) : (
          <DialogRows
            dialogs={folder === "active" ? active : closed}
            empty={
              !dialogs.length
                ? "Пока нет сообщений"
                : folder === "active"
                  ? "Активных чатов нет"
                  : "Здесь появятся чаты, которые вы завершите"
            }
          />
        )}
      </div>
    </>
  );
}

function FolderTab({ label, count, selected, onSelect }: { label: string; count: number; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
        selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}

function DialogRows({ dialogs, empty, tagClosed }: { dialogs: Dialog[]; empty: string; tagClosed?: boolean }) {
  const pathname = usePathname();
  const timeZone = useTimeZone();
  if (!dialogs.length) return <p className="p-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul>
      {dialogs.map((d) => (
        <li key={d.clientId}>
          <Link
            href={`/admin/chat/${d.clientId}`}
            className={cn("flex gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/60", pathname.endsWith(d.clientId) && "bg-muted")}
          >
            <Avatar name={d.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <Name dialog={d} bold={!!d.unread} tagClosed={tagClosed} />
                <span className="shrink-0 text-xs text-muted-foreground">{formatChatTime(d.at, timeZone)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={cn("truncate text-sm", d.unread ? "text-foreground" : "text-muted-foreground")}>
                  {!d.lastFromClient && (d.lastAi ? "ИИ: " : "Вы: ")}
                  {d.last}
                </p>
                {d.ai && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 text-[11px] font-medium",
                      d.ai === "handoff" ? "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {d.ai === "handoff" ? "Нужен менеджер" : "Черновик ИИ"}
                  </span>
                )}
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

function SearchResults({ q, dialogs, hits }: { q: string; dialogs: Dialog[]; hits: MessageHit[] | null }) {
  const timeZone = useTimeZone();
  const byId = new Map(dialogs.map((d) => [d.clientId, d]));
  const names = dialogs.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
  const messages = (hits ?? []).filter((h) => byId.has(h.clientId));
  const waiting = q.length >= 2 && !hits;

  if (!names.length && !messages.length) {
    return <p className="p-6 text-sm text-muted-foreground">{waiting ? "Ищем…" : "Ничего не найдено"}</p>;
  }
  return (
    <>
      {!!names.length && (
        <>
          <p className="px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground">Клиенты</p>
          <DialogRows dialogs={names} empty="" tagClosed />
        </>
      )}
      {!!messages.length && (
        <>
          <p className="px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground">Сообщения</p>
          <ul>
            {messages.map((h) => {
              const d = byId.get(h.clientId)!;
              const [before, match, after] = snippet(h.body, q);
              return (
                <li key={h.id}>
                  <Link href={`/admin/chat/${h.clientId}`} className="flex gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/60">
                    <Avatar name={d.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <Name dialog={d} tagClosed />
                        <span className="shrink-0 text-xs text-muted-foreground">{formatChatTime(h.at, timeZone)}</span>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {!h.fromClient && "Вы: "}
                        {before}
                        <mark className="rounded-sm bg-amber-200 px-0.5 text-foreground dark:bg-amber-400/40">{match}</mark>
                        {after}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Name({ dialog, bold, tagClosed }: { dialog: Dialog; bold?: boolean; tagClosed?: boolean }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <span className={cn("truncate", bold ? "font-semibold" : "font-medium")}>{dialog.name}</span>
      {dialog.repeat && (
        <span title="Пишет не первый раз" className="shrink-0">
          <Star aria-hidden className="size-3.5 fill-amber-400 text-amber-400" />
          <span className="sr-only">Пишет не первый раз</span>
        </span>
      )}
      {tagClosed && dialog.closed && <span className="shrink-0 rounded-full bg-muted px-2 text-[11px] text-muted-foreground">Завершён</span>}
    </p>
  );
}

// The found text with a little context before it
function snippet(body: string, q: string) {
  const i = body.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return [body, "", ""];
  const start = Math.max(0, i - 30);
  return [(start ? "…" : "") + body.slice(start, i), body.slice(i, i + q.length), body.slice(i + q.length)];
}
