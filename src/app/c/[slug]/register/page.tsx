import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Welcome } from "@/components/client/welcome";
import { GuestCalculatorLink } from "@/components/client/calculator-entry";
import { getCompanyBySlug } from "@/lib/auth";
import { getPriceList } from "@/lib/price-list";
import { isEnabled } from "@/lib/pricing";
import { safeNext } from "@/lib/utils";

export default async function Page({ params, searchParams }: PageProps<"/c/[slug]/register">) {
  const { slug } = await params;
  const next = safeNext(slug, ((await searchParams) as { next?: string }).next);
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const prices = await getPriceList(company.id);
  return (
    <Welcome company={company} title="Создайте аккаунт" subtitle="Следите за заказами и пишите менеджеру">
      <AuthForm mode="register" slug={slug} next={next} />
      {!next && prices && isEnabled(prices.prices) && <GuestCalculatorLink slug={slug} />}
    </Welcome>
  );
}
