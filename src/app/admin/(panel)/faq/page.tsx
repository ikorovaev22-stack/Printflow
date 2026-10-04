import { FaqManager } from "@/components/admin/faq-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/auth";
import type { Faq } from "@/lib/types";

export const metadata = { title: "FAQ" };

export default async function FaqPage() {
  const { supabase, company } = await requireStaff();
  const { data } = await supabase.from("faqs").select("*").eq("company_id", company.id).order("position").returns<Faq[]>();
  return (
    <>
      <PageHeader title="FAQ" description="Ответы на частые вопросы — клиенты видят их в приложении" />
      <FaqManager faqs={data ?? []} />
    </>
  );
}
