import { notFound } from "next/navigation";
import { Calculator } from "@/components/client/calculator";
import { getCompanyBySlug, getSession } from "@/lib/auth";
import { getPriceList } from "@/lib/price-list";
import { inputFromSearch, isEnabled } from "@/lib/pricing";

export const metadata = { title: "Расчёт стоимости" };

// Open without signing in: guests see prices and sign in only to place the order
export default async function CalculatorScreen({ params, searchParams }: PageProps<"/c/[slug]/calculator">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const list = await getPriceList(company.id);
  if (!list || !isEnabled(list.prices)) notFound();
  const session = await getSession();
  const signedIn = session?.company.id === company.id && session.profile.role === "client";
  return <Calculator slug={slug} companyId={company.id} prices={list.prices} initial={inputFromSearch(await searchParams, list.prices)} signedIn={signedIn} />;
}
