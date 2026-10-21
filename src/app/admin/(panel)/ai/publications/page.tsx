import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { DraftComposer, DraftQueue, PostsList } from "@/components/admin/ai-publications";
import { aiConfigured } from "@/lib/assistant-server";
import { requireStaff } from "@/lib/auth";
import type { AiDraft, Post } from "@/lib/types";

export default async function PublicationsPage() {
  const { supabase, company } = await requireStaff();
  const [{ data: drafts }, { count: replies }, { data: posts }] = await Promise.all([
    supabase
      .from("ai_drafts")
      .select("*")
      .eq("company_id", company.id)
      .in("kind", ["post", "faq"])
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .returns<AiDraft[]>(),
    supabase
      .from("ai_drafts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("kind", "reply")
      .eq("status", "pending"),
    supabase.from("posts").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(30).returns<Post[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {!!replies && (
        <Link href="/admin/chat" className="flex items-center gap-3 rounded-card bg-card p-5 transition-colors hover:bg-card/70">
          <MessagesSquare className="size-5 shrink-0" />
          <span className="flex-1 text-sm">
            <span className="font-medium">В чате ждут проверки: {replies}.</span> Черновики ответов клиентам и вопросы, переданные менеджеру.
          </span>
        </Link>
      )}
      <DraftComposer configured={aiConfigured()} />
      <DraftQueue drafts={drafts ?? []} />
      <PostsList posts={posts ?? []} slug={company.slug} />
    </div>
  );
}
