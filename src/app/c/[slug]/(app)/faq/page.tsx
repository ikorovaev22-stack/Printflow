import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, CircleHelp, Store } from "lucide-react";
import { Screen, SectionTitle } from "@/components/client/screen";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
    <Screen eyebrow="Помощь" title="Вопросы и ответы">
      {faqs?.length ? (
        <Accordion type="single" collapsible className="gap-2">
          {faqs.map((f) => (
            <AccordionItem key={f.id} value={f.id} className="rounded-card border-none bg-card px-5">
              <AccordionTrigger className="py-5 text-base font-semibold hover:no-underline">{f.question}</AccordionTrigger>
              <AccordionContent className="pb-5 text-[15px] leading-relaxed whitespace-pre-line text-muted-foreground">
                {f.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleHelp />
            </EmptyMedia>
            <EmptyTitle>Вопросов пока нет</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      <SectionTitle>Не нашли ответ?</SectionTitle>
      <Link href={`/c/${slug}/about`} className="flex items-center gap-4 rounded-card bg-card p-4 transition-colors hover:bg-card/70">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-tile bg-muted">
          <Store className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">О типографии</span>
          <span className="block text-sm text-muted-foreground">Адрес, телефон и часы работы</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
    </Screen>
  );
}
