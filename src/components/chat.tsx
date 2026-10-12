"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, CheckCheck, Check, Ellipsis, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearChat, deleteMessage, sendMessage } from "@/app/actions/messages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useTimeZone } from "@/components/time-zone";
import { formatChatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

type Props = {
  clientId: string;
  side: "client" | "staff";
  initialMessages: Message[];
  empty?: React.ReactNode;
  // Dialog header on the staff side; the chat adds its own thread actions to it
  header?: React.ReactNode;
};

export function Chat({ clientId, side, initialMessages, empty, header }: Props) {
  const router = useRouter();
  const timeZone = useTimeZone();
  const [supabase] = useState(createClient);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const incomingFromClient = side === "staff";

  const upsert = (m: Message) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]));
  const remove = (id: string) => setMessages((prev) => prev.filter((m) => m.id !== id));

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const markRead = () =>
      supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("from_client", incomingFromClient)
        .is("read_at", null)
        .select("id")
        .then(({ data }) => data?.length && router.refresh());

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`chat:${clientId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `client_id=eq.${clientId}` },
          (payload) => {
            const m = payload.new as Message;
            if (!m?.id) return;
            upsert(m);
            if (payload.eventType === "INSERT" && m.from_client === incomingFromClient && document.visibilityState === "visible") markRead();
          },
        )
        // Deletes carry only the id and cannot be filtered by client: drop whatever matches this thread
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
          const id = (payload.old as Partial<Message>).id;
          if (id) remove(id);
        })
        .subscribe();
    });
    markRead();
    const onVisible = () => document.visibilityState === "visible" && markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, clientId, incomingFromClient, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await sendMessage(clientId, body);
    setSending(false);
    if (res.error) return toast.error(res.error);
    setText("");
    if (res.message) upsert(res.message);
  }

  async function destroy(id: string) {
    const res = await deleteMessage(id);
    if (res.error) return toast.error(res.error);
    remove(id);
  }

  async function clear() {
    const res = await clearChat(clientId);
    if (res.error) return toast.error(res.error);
    setMessages([]);
    toast.success("Переписка очищена");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header && (
        <header className="flex items-center gap-2 border-b bg-card px-3 py-3 md:px-5">
          {header}
          {side === "staff" && messages.length > 0 && <ClearChatButton onConfirm={clear} />}
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-5" aria-live="polite">
        {!messages.length && empty}
        {messages.map((m, i) => {
          const mine = m.from_client === (side === "client");
          const prev = messages[i - 1];
          const grouped = prev && prev.from_client === m.from_client;
          return (
            <div key={m.id} className={cn("group flex items-center gap-1", mine ? "justify-end" : "justify-start", !grouped && i > 0 && "mt-3")}>
              {side === "staff" && mine && <MessageMenu onDelete={() => destroy(m.id)} />}
              <div
                className={cn(
                  "max-w-[80%] rounded-[1.375rem] px-4 py-2.5 text-[15px] leading-snug",
                  mine ? "rounded-br-md bg-primary text-primary-foreground" : cn("rounded-bl-md", side === "client" ? "bg-card" : "bg-muted"),
                )}
              >
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className={cn("mt-1 flex items-center justify-end gap-1 text-[11px] tabular-nums", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                  {formatChatTime(m.created_at, timeZone)}
                  {mine &&
                    (m.read_at ? (
                      <CheckCheck className="size-3.5" aria-label="Прочитано" />
                    ) : (
                      <Check className="size-3.5" aria-label="Отправлено" />
                    ))}
                </p>
              </div>
              {side === "staff" && !mine && <MessageMenu onDelete={() => destroy(m.id)} />}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className={cn("px-3 pb-3", side === "staff" && "border-t pt-3")}
      >
        <div className={cn("flex items-end gap-2 rounded-[1.625rem] p-1.5 pl-2", side === "client" ? "bg-card shadow-float" : "bg-muted")}>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Сообщение"
            aria-label="Сообщение"
            maxLength={4000}
            rows={1}
            className="max-h-32 min-h-10 resize-none border-none bg-transparent px-2.5 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={!text.trim() || sending} aria-label="Отправить">
            <ArrowUp />
          </Button>
        </div>
      </form>
    </div>
  );
}

// Shown on hover with a mouse; always visible on touch screens, which have no hover
function MessageMenu({ onDelete }: { onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label="Действия с сообщением"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-auto">
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Удалить сообщение
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClearChatButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto shrink-0 text-muted-foreground">
          <Trash2 /> <span className="max-md:sr-only">Очистить переписку</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Очистить переписку?</AlertDialogTitle>
          <AlertDialogDescription>Все сообщения удалятся и у вас, и у клиента. Действие нельзя отменить.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Очистить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
