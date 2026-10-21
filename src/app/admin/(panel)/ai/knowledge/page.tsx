import Link from "next/link";
import { KnowledgeManager } from "@/components/admin/ai-knowledge";
import { requireStaff } from "@/lib/auth";
import { getPriceList } from "@/lib/price-list";
import { productList } from "@/lib/pricing";
import type { AiKnowledge } from "@/lib/types";

export default async function KnowledgePage() {
  const { supabase, company } = await requireStaff();
  const [{ data: entries }, { count: faqs }, { count: templates }, prices] = await Promise.all([
    supabase.from("ai_knowledge").select("*").eq("company_id", company.id).order("created_at").returns<AiKnowledge[]>(),
    supabase.from("faqs").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("ai_templates").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    getPriceList(company.id),
  ]);
  const products = prices ? productList(prices.prices).map((p) => p.label) : [];
  const card = [
    ["Название", company.name],
    ["Адрес", company.address],
    ["Часы работы", company.work_hours],
    ["Телефон", company.phone],
    ["Email", company.email],
    ["Telegram", company.telegram && `@${company.telegram}`],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card bg-card p-6">
        <h2 className="text-lg font-semibold">О типографии — ИИ знает автоматически</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {card.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
          <dt className="text-muted-foreground">Калькулятор</dt>
          <dd>{products.length ? products.join(", ") : "выключен"}</dd>
          <dt className="text-muted-foreground">Вопросы и ответы</dt>
          <dd>{faqs ?? 0} из раздела «Вопросы», {templates ?? 0} шаблонов автоответчика, последние новости</dd>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Меняется в{" "}
          <Link href="/admin/settings" className="font-medium text-foreground underline underline-offset-4">
            настройках
          </Link>
          ,{" "}
          <Link href="/admin/faq" className="font-medium text-foreground underline underline-offset-4">
            вопросах
          </Link>{" "}
          и{" "}
          <Link href="/admin/prices" className="font-medium text-foreground underline underline-offset-4">
            ценах
          </Link>
          . Всё остальное — услуги, сроки, требования к макетам, доставку — добавьте ниже.
        </p>
      </section>
      <KnowledgeManager entries={entries ?? []} />
    </div>
  );
}
