import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Welcome } from "@/components/client/welcome";
import { getCompanyBySlug } from "@/lib/auth";

export default async function Page({ params }: PageProps<"/c/[slug]/register">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  return (
    <Welcome company={company} title="Создайте аккаунт" subtitle="Следите за заказами и пишите менеджеру">
      <AuthForm mode="register" slug={slug} />
    </Welcome>
  );
}
