import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TabBar } from "@/components/client/tab-bar";
import { getSession } from "@/lib/auth";

export default async function AppLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  const { slug } = await params;
  const session = await getSession();
  let unread = 0;
  if (session?.profile.role === "client") {
    const { count } = await session.supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", session.profile.id)
      .eq("from_client", false)
      .is("read_at", null);
    unread = count ?? 0;
  }
  return (
    <>
      {session && <RealtimeRefresh table="messages" filter={`client_id=eq.${session.profile.id}`} />}
      {children}
      <TabBar slug={slug} unread={unread} />
    </>
  );
}
