import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { PricesForm } from "@/components/admin/prices-form";
import { requireStaff } from "@/lib/auth";
import { getPriceList } from "@/lib/price-list";
import { DEFAULT_PRICE_LIST } from "@/lib/pricing";

export const metadata = { title: "Цены" };

export default async function PricesPage() {
  const { profile, company } = await requireStaff();
  if (profile.role !== "owner") redirect("/admin/orders");
  const list = await getPriceList(company.id);
  return (
    <>
      <PageHeader title="Цены" description={`Калькулятор для клиентов: /c/${company.slug}/calculator`} />
      <PricesForm initial={list?.prices ?? DEFAULT_PRICE_LIST} isNew={!list} />
    </>
  );
}
