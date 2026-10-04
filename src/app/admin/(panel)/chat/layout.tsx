import { ChatShell } from "@/components/admin/chat-shell";
import { DialogList, type Dialog } from "@/components/admin/dialog-list";
import { requireStaff } from "@/lib/auth";
import type { Message, Profile } from "@/lib/types";

export const metadata = { title: "Чат" };

export default async function ChatLayout({ children }: LayoutProps<"/admin/chat">) {
  const { supabase } = await requireStaff();
  const [{ data: messages }, { data: clients }] = await Promise.all([
    supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(1000).returns<Message[]>(),
    supabase.from("profiles").select("id, full_name, email").eq("role", "client").returns<Profile[]>(),
  ]);
  const names = new Map((clients ?? []).map((c) => [c.id, c.full_name || c.email || "Клиент"]));
  const dialogs = new Map<string, Dialog>();
  for (const m of messages ?? []) {
    const d = dialogs.get(m.client_id);
    if (!d) {
      dialogs.set(m.client_id, {
        clientId: m.client_id,
        name: names.get(m.client_id) ?? "Клиент",
        last: m.body,
        lastFromClient: m.from_client,
        at: m.created_at,
        unread: m.from_client && !m.read_at ? 1 : 0,
      });
    } else if (m.from_client && !m.read_at) d.unread++;
  }

  return (
    <ChatShell
      list={
        <>
          <h1 className="border-b px-4 py-4 text-xl font-semibold">Чат</h1>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DialogList dialogs={[...dialogs.values()]} />
          </div>
        </>
      }
    >
      {children}
    </ChatShell>
  );
}
