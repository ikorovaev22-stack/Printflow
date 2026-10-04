import Link from "next/link";
import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import { requireStaff } from "@/lib/auth";
import type { Message, Profile } from "@/lib/types";

export default async function DialogPage({ params }: PageProps<"/admin/chat/[clientId]">) {
  const { clientId } = await params;
  const { supabase, profile, company } = await requireStaff();
  const [{ data: client }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", clientId).eq("role", "client").maybeSingle<Profile>(),
    supabase.from("messages").select("*").eq("client_id", clientId).order("created_at").returns<Message[]>(),
  ]);
  if (!client) notFound();

  return (
    <>
      <header className="flex items-center justify-between border-b bg-card px-5 py-3">
        <div>
          <Link href={`/admin/clients/${client.id}`} className="font-semibold hover:underline">
            {client.full_name || client.email}
          </Link>
          <p className="text-xs text-muted-foreground">{[client.phone, client.email].filter(Boolean).join(" · ")}</p>
        </div>
      </header>
      <Chat
        key={client.id}
        companyId={company.id}
        clientId={client.id}
        meId={profile.id}
        side="staff"
        initialMessages={messages ?? []}
        empty={<p className="m-auto text-sm text-muted-foreground">Сообщений пока нет — напишите первым</p>}
      />
    </>
  );
}
