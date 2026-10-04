import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Chat } from "@/components/chat";
import { requireStaff } from "@/lib/auth";
import type { Message, Profile } from "@/lib/types";

export default async function DialogPage({ params }: PageProps<"/admin/chat/[clientId]">) {
  const { clientId } = await params;
  const { supabase } = await requireStaff();
  const [{ data: client }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", clientId).eq("role", "client").maybeSingle<Profile>(),
    supabase.from("messages").select("*").eq("client_id", clientId).order("created_at").returns<Message[]>(),
  ]);
  if (!client) notFound();

  return (
    <>
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3 md:px-5">
        <Link href="/admin/chat" className="rounded-md p-1 text-muted-foreground hover:bg-muted md:hidden" aria-label="К диалогам">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <Link href={`/admin/clients/${client.id}`} className="font-semibold hover:underline">
            {client.full_name || client.email}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{[client.phone, client.email].filter(Boolean).join(" · ")}</p>
        </div>
      </header>
      <Chat
        key={client.id}
        clientId={client.id}
        side="staff"
        initialMessages={messages ?? []}
        empty={<p className="m-auto text-sm text-muted-foreground">Сообщений пока нет — напишите первым</p>}
      />
    </>
  );
}
