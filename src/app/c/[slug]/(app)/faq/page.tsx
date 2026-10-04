import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Info } from "lucide-react";
import { Screen } from "@/components/client/screen";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getCompanyBySlug } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Faq } from "@/lib/types";

export const metadata = { title: "Вопросы и ответы" };

export default async function FaqScreen({ params }: PageProps<"/c/[slug]/faq">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const supabase = await createClient();
  const { data: faqs } = await supabase.from("faqs").select("*").eq("company_id", company.id).order("position").returns<Faq[]>();

  return (
    <Screen title="Вопросы">
      {faqs?.length ? (
        <Accordion type="single" collapsible className="rounded-2xl bg-card px-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          {faqs.map((f) => (
            <AccordionItem key={f.id} value={f.id}>
              <AccordionTrigger className="text-base">{f.question}</AccordionTrigger>
              <AccordionContent className="text-[15px] whitespace-pre-line text-muted-foreground">{f.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <p className="text-muted-foreground">Вопросов пока нет</p>
      )}
      <Link
        href={`/c/${slug}/about`}
        className="mt-4 flex items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-sm ring-1 ring-black/5 active:bg-muted dark:ring-white/10"
      >
        <Info className="size-5 text-primary" />
        <span className="flex-1">Адрес, телефон и часы работы</span>
        <ChevronRight className="size-5 text-muted-foreground/60" />
      </Link>
    </Screen>
  );
}
