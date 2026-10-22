import { ChatShell } from "@/components/admin/chat-shell";
import { DialogList, type Dialog } from "@/components/admin/dialog-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { aiConfigured } from "@/lib/assistant-server";
import { requireStaff } from "@/lib/auth";
import type { ChatState, Message, Profile } from "@/lib/types";

export const metadata = { title: "Чат" };

export default async function ChatLayout({ children }: LayoutProps<"/admin/chat">) {
  const { supabase, company } = await requireStaff();
  const [{ data: messages }, { data: clients }, { data: chats }, { data: drafts }] = await Promise.all([
    supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(1000).returns<Message[]>(),
    supabase.from("profiles").select("id, full_name, email").eq("role", "client").returns<Profile[]>(),
    supabase.from("chats").select("client_id, closed_at, closed_count").returns<ChatState[]>(),
    aiConfigured()
      ? supabase.from("ai_drafts").select("client_id, handoff").eq("kind", "reply").eq("status", "pending").returns<{ client_id: string; handoff: boolean }[]>()
      : { data: null },
  ]);
  const ai = new Map((drafts ?? []).map((d) => [d.client_id, d.handoff ? ("handoff" as const) : ("draft" as const)]));
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
        lastAi: m.ai,
        at: m.created_at,
        unread: m.from_client && !m.read_at ? 1 : 0,
        closed,
        // Earlier conversations were completed: the client writes not for the first time
        repeat: (state?.closed_count ?? 0) > (closed ? 1 : 0),
        ai: ai.get(m.client_id),
      });
    } else if (m.from_client && !m.read_at) d.unread++;
  }

  return (
    <ChatShell
      list={
        <>
          {/* A new draft from the AI assistant shows up in the list and in the open chat */}
          {aiConfigured() && <RealtimeRefresh table="ai_drafts" filter={`company_id=eq.${company.id}`} />}
          <h1 className="px-5 pt-5 pb-3 text-2xl font-bold tracking-tight">Чат</h1>
          <DialogList dialogs={[...dialogs.values()]} />
        </>
      }
    >
      {children}
    </ChatShell>
  );
}
