"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, CheckCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { formatChatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

type Props = {
  companyId: string;
  clientId: string;
  meId: string;
  side: "client" | "staff";
  initialMessages: Message[];
  empty?: React.ReactNode;
};

export function Chat({ companyId, clientId, meId, side, initialMessages, empty }: Props) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const incomingFromClient = side === "staff";

  const upsert = (m: Message) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]));

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
    const { data, error } = await supabase
      .from("messages")
      .insert({ company_id: companyId, client_id: clientId, sender_id: meId, body })
      .select()
      .single<Message>();
    setSending(false);
    if (error) return;
    setText("");
    upsert(data);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-4">
        {!messages.length && empty}
        {messages.map((m, i) => {
          const mine = m.from_client === (side === "client");
          const prev = messages[i - 1];
          const grouped = prev && prev.from_client === m.from_client;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start", !grouped && i > 0 && "mt-2")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm",
                  mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card ring-1 ring-black/5 dark:ring-white/10",
                )}
              >
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[11px]", mine ? "opacity-75" : "text-muted-foreground")}>
                  {formatChatTime(m.created_at)}
                  {mine && (m.read_at ? <CheckCheck className="size-3.5" /> : <Check className="size-3.5" />)}
                </p>
              </div>
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
        className="flex items-end gap-2 border-t bg-background/90 p-3 backdrop-blur"
      >
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
          rows={1}
          className="max-h-32 min-h-11 resize-none rounded-3xl px-4 py-2.5 text-[15px]"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" disabled={!text.trim() || sending} aria-label="Отправить">
          <ArrowUp className="size-5" />
        </Button>
      </form>
    </div>
  );
}
