import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const { profile, company } = await requireStaff();
  if (profile.role !== "owner") redirect("/admin/orders");
  return (
    <>
      <PageHeader title="Настройки компании" description={`Клиентское приложение: /c/${company.slug}`} />
      <SettingsForm company={company} />
    </>
  );
}
