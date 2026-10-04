import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { CompanyLogo } from "@/components/company-logo";
import { getCompanyBySlug } from "@/lib/auth";

export default async function Page({ params }: PageProps<"/c/[slug]/register">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <CompanyLogo company={company} className="size-16 rounded-3xl text-2xl" />
        <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
        <p className="text-sm text-muted-foreground">
          Создайте аккаунт, чтобы следить за заказами
        </p>
      </div>
      <AuthForm mode="register" slug={slug} />
    </main>
  );
}
