import { redirect } from "next/navigation";
import { BannersManager } from "@/components/admin/banners-manager";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireStaff } from "@/lib/auth";
import { getBanners } from "@/lib/banners";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const { profile, company } = await requireStaff();
  if (profile.role !== "owner") redirect("/admin/orders");
  const banners = await getBanners(company.id);
  return (
    <>
      <PageHeader title="Настройки компании" description={`Клиентское приложение: /c/${company.slug}`} />
      <SettingsForm company={company} />
      <BannersManager companyId={company.id} banners={banners} />
    </>
  );
}
