import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { AiTabs } from "@/components/admin/ai-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { aiConfigured } from "@/lib/assistant-server";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "ИИ-помощник" };

export default async function AiLayout({ children }: LayoutProps<"/admin/ai">) {
  const { profile, supabase, company } = await requireStaff();
  if (profile.role !== "owner") redirect("/admin/orders");
  const { count } = await supabase
    .from("ai_drafts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .in("kind", ["post", "faq"])
    .eq("status", "pending");
  return (
    <>
      <PageHeader title="ИИ-помощник" description="Отвечает клиентам в чате и пишет черновики новостей и вопросов" />
      {!aiConfigured() && (
        <div role="alert" className="mb-6 flex gap-3 rounded-card bg-amber-100 p-5 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Нейросеть не подключена: задайте переменные <code>AI_BASE_URL</code>, <code>AI_API_KEY</code> и <code>AI_MODEL</code>
            (см. README). Без неё работают шаблоны, база знаний и черновики, написанные вручную.
          </p>
        </div>
      )}
      <AiTabs drafts={count ?? 0} />
      {children}
    </>
  );
}
