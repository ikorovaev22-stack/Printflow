import { ChatShell } from "@/components/admin/chat-shell";
import { DialogList, type Dialog } from "@/components/admin/dialog-list";
import { requireStaff } from "@/lib/auth";
import type { ChatState, Message, Profile } from "@/lib/types";

export const metadata = { title: "Чат" };

export default async function ChatLayout({ children }: LayoutProps<"/admin/chat">) {
  const { supabase } = await requireStaff();
  const [{ data: messages }, { data: clients }, { data: chats }] = await Promise.all([
    supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(1000).returns<Message[]>(),
    supabase.from("profiles").select("id, full_name, email").eq("role", "client").returns<Profile[]>(),
    supabase.from("chats").select("client_id, closed_at, closed_count").returns<ChatState[]>(),
  ]);
  const names = new Map((clients ?? []).map((c) => [c.id, c.full_name || c.email || "Клиент"]));
  const states = new Map((chats ?? []).map((c) => [c.client_id, c]));
  const dialogs = new Map<string, Dialog>();
  for (const m of messages ?? []) {
    const d = dialogs.get(m.client_id);
    if (!d) {
      const state = states.get(m.client_id);
      const closed = !!state?.closed_at;
      dialogs.set(m.client_id, {
        clientId: m.client_id,
        name: names.get(m.client_id) ?? "Клиент",
        last: m.body,
        lastFromClient: m.from_client,
        at: m.created_at,
        unread: m.from_client && !m.read_at ? 1 : 0,
        closed,
        // Earlier conversations were completed: the client writes not for the first time
        repeat: (state?.closed_count ?? 0) > (closed ? 1 : 0),
      });
    } else if (m.from_client && !m.read_at) d.unread++;
  }

  return (
    <ChatShell
      list={
        <>
          <h1 className="px-5 pt-5 pb-3 text-2xl font-bold tracking-tight">Чат</h1>
          <DialogList dialogs={[...dialogs.values()]} />
        </>
      }
    >
      {children}
    </ChatShell>
  );
}
