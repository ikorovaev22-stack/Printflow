import { redirect } from "next/navigation";
import { AiTabs } from "@/components/admin/ai-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { aiConfigured } from "@/lib/assistant-server";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "ИИ-помощник" };

export default async function AiLayout({ children }: LayoutProps<"/admin/ai">) {
  const { profile, supabase, company } = await requireStaff();
  // Without a model the whole section is hidden: AI_BASE_URL, AI_API_KEY and AI_MODEL turn it on
  if (profile.role !== "owner" || !aiConfigured()) redirect("/admin/orders");
  const { count } = await supabase
    .from("ai_drafts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .in("kind", ["post", "faq"])
    .eq("status", "pending");
  return (
    <>
      <PageHeader title="ИИ-помощник" description="Отвечает клиентам в чате и пишет черновики новостей и вопросов" />
      <AiTabs drafts={count ?? 0} />
      {children}
    </>
  );
}
