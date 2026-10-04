import { notFound } from "next/navigation";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { Screen } from "@/components/client/screen";
import { Button } from "@/components/ui/button";
import { getCompanyBySlug } from "@/lib/auth";

export const metadata = { title: "О компании" };

export default async function AboutScreen({ params }: PageProps<"/c/[slug]/about">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const rows = [
    { icon: MapPin, label: "Адрес", value: company.address, href: company.address && `https://yandex.ru/maps/?text=${encodeURIComponent(company.address)}` },
    { icon: Clock, label: "Часы работы", value: company.work_hours },
    { icon: Phone, label: "Телефон", value: company.phone, href: company.phone && `tel:${company.phone.replace(/[^\d+]/g, "")}` },
    { icon: Mail, label: "Email", value: company.email, href: company.email && `mailto:${company.email}` },
  ].filter((r) => r.value);

  return (
    <Screen title="О компании" back={`/c/${slug}/faq`}>
      <div className="mb-6 flex flex-col items-center gap-3 py-4 text-center">
        <CompanyLogo company={company} className="size-20 rounded-3xl text-3xl" />
        <h2 className="text-xl font-semibold">{company.name}</h2>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        {rows.map((r) => {
          const content = (
            <>
              <r.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className={r.href ? "text-primary" : undefined}>{r.value}</p>
              </div>
            </>
          );
          return r.href ? (
            <a key={r.label} href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} className="flex gap-3 border-b px-5 py-4 last:border-0 active:bg-muted">
              {content}
            </a>
          ) : (
            <div key={r.label} className="flex gap-3 border-b px-5 py-4 last:border-0">
              {content}
            </div>
          );
        })}
      </div>
      {company.phone && (
        <Button asChild size="lg" className="mt-6 h-12 w-full rounded-xl text-base">
          <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`}>
            <Phone /> Позвонить
          </a>
        </Button>
      )}
    </Screen>
  );
}
