import { notFound } from "next/navigation";
import { Welcome } from "@/components/client/welcome";
import { ForgotPasswordForm } from "@/components/password-forms";
import { getCompanyBySlug, getDefaultCompany } from "@/lib/auth";

export const metadata = { title: "Восстановление пароля" };

// ?slug=<company> for clients; without it, the staff variant returns to /admin/login
export default async function ForgotPage({ searchParams }: PageProps<"/auth/forgot">) {
  const { slug } = (await searchParams) as { slug?: string };
  const company = slug ? await getCompanyBySlug(slug) : await getDefaultCompany();
  if (!company) notFound();
  return (
    <Welcome company={company} title="Забыли пароль?" subtitle="Пришлём на почту ссылку, по которой можно задать новый">
      <ForgotPasswordForm backHref={slug ? `/c/${slug}/login` : "/admin/login"} />
    </Welcome>
  );
}
