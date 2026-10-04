import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Welcome } from "@/components/client/welcome";
import { getCompanyBySlug } from "@/lib/auth";

export default async function Page({ params }: PageProps<"/c/[slug]/login">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  return (
    <Welcome company={company} title="С возвращением" subtitle="Войдите, чтобы видеть статус заказов">
      <AuthForm mode="login" slug={slug} />
    </Welcome>
  );
}
