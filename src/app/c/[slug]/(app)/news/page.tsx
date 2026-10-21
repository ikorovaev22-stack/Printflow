import { notFound } from "next/navigation";
import { Newspaper } from "lucide-react";
import { Screen } from "@/components/client/screen";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getCompanyBySlug } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Post } from "@/lib/types";

export const metadata = { title: "Новости" };

export default async function NewsScreen({ params }: PageProps<"/c/[slug]/news">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Post[]>();

  return (
    <Screen back={`/c/${slug}`} eyebrow={company.name} title="Новости">
      {posts?.length ? (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.id} id={p.id} className="scroll-mt-6">
              <article className="rounded-card bg-card p-5 md:p-6">
                <p className="text-sm text-muted-foreground">{formatDate(p.created_at, company.timezone)}</p>
                <h2 className="mt-1 text-lg leading-snug font-semibold">{p.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line">{p.body}</p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Newspaper />
            </EmptyMedia>
            <EmptyTitle>Новостей пока нет</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </Screen>
  );
}
