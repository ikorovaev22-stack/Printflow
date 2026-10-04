import { notFound } from "next/navigation";
import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { Screen, SectionTitle } from "@/components/client/screen";
import { getCompanyBySlug } from "@/lib/auth";

export const metadata = { title: "О компании" };

export default async function AboutScreen({ params }: PageProps<"/c/[slug]/about">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const tel = company.phone && `tel:${company.phone.replace(/[^\d+]/g, "")}`;
  const mail = company.email && `mailto:${company.email}`;
  const map = company.address && `https://yandex.ru/maps/?text=${encodeURIComponent(company.address)}`;

  const actions = [
    { icon: Phone, label: "Позвонить", href: tel },
    { icon: Mail, label: "Написать", href: mail },
    { icon: Navigation, label: "Маршрут", href: map },
  ].filter((a) => a.href) as { icon: React.ElementType; label: string; href: string }[];

  const rows = [
    { icon: MapPin, label: "Адрес", value: company.address },
    { icon: Clock, label: "Часы работы", value: company.work_hours },
    { icon: Phone, label: "Телефон", value: company.phone },
    { icon: Mail, label: "Email", value: company.email },
  ].filter((r) => r.value);

  return (
    <Screen back={`/c/${slug}/faq`}>
      <section className="flex flex-col items-center gap-4 rounded-card bg-card px-5 pt-8 pb-6 text-center">
        <CompanyLogo company={company} className="size-20 rounded-full text-3xl" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
          {company.address && <p className="mt-1 text-sm text-muted-foreground">{company.address}</p>}
        </div>
        {!!actions.length && (
          <div className="mt-2 flex justify-center gap-6">
            {actions.map((a) => (
              <a
                key={a.label}
                href={a.href}
                target={a.href.startsWith("http") ? "_blank" : undefined}
                rel={a.href.startsWith("http") ? "noreferrer" : undefined}
                className="group flex flex-col items-center gap-2 text-xs font-medium"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-active:scale-95">
                  <a.icon className="size-5" />
                </span>
                {a.label}
              </a>
            ))}
          </div>
        )}
      </section>

      {!!rows.length && (
        <>
          <SectionTitle>Контакты</SectionTitle>
          <dl className="grid grid-cols-1 gap-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-4 rounded-card bg-card p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
                  <r.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{r.label}</dt>
                  <dd className="font-medium break-words">{r.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </>
      )}

    </Screen>
  );
}
