import { notFound } from "next/navigation";
import { ChevronRight, Clock, Mail, MapPin, MessageCircleMore, Phone, Send } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { BannerStrip } from "@/components/client/banner-strip";
import { Screen, SectionTitle } from "@/components/client/screen";
import { getCompanyBySlug } from "@/lib/auth";
import { getBanners } from "@/lib/banners";

export const metadata = { title: "О компании" };

export default async function AboutScreen({ params }: PageProps<"/c/[slug]/about">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const banners = await getBanners(company.id);
  const tel = company.phone && `tel:${company.phone.replace(/[^\d+]/g, "")}`;
  const mail = company.email && `mailto:${company.email}`;
  // Notes in brackets ("1 цоколь") confuse the map search
  const map = company.address && `https://yandex.ru/maps/?text=${encodeURIComponent(company.address.replace(/\s*\([^)]*\)/g, "").trim())}`;
  const telegram = company.telegram && `https://t.me/${company.telegram}`;
  const max = company.max_url;

  const rows = [
    { icon: MapPin, label: "Адрес", value: company.address, href: map },
    { icon: Clock, label: "Часы работы", value: company.work_hours },
    { icon: Phone, label: "Телефон", value: company.phone, href: tel },
    { icon: MessageCircleMore, label: "MAX", value: company.max_phone || (max && "Написать в MAX"), href: max },
    { icon: Send, label: "Telegram", value: company.telegram && `@${company.telegram}`, href: telegram },
    { icon: Mail, label: "Email", value: company.email, href: mail },
  ].filter((r) => r.value) as { icon: React.ElementType; label: string; value: string; href?: string | null }[];

  return (
    <Screen back={`/c/${slug}/faq`}>
      <section className="flex flex-col items-center gap-4 rounded-card bg-card px-5 py-8 text-center">
        <CompanyLogo company={company} className="size-20 rounded-full text-3xl" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
          {company.address && <p className="mt-1 text-sm text-muted-foreground">{company.address}</p>}
        </div>
      </section>

      {!!rows.length && (
        <>
          <SectionTitle>Контакты</SectionTitle>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {rows.map((r) => {
              const body = (
                <>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
                    <r.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">{r.label}</span>
                    <span className="block font-medium break-words">{r.value}</span>
                  </span>
                  {r.href && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
                </>
              );
              return (
                <li key={r.label}>
                  {r.href ? (
                    <a
                      href={r.href}
                      {...external(r.href)}
                      className="flex h-full items-center gap-4 rounded-card bg-card p-4 transition-transform active:scale-98 motion-reduce:active:scale-100"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="flex h-full items-center gap-4 rounded-card bg-card p-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!!banners.length && (
        <>
          <SectionTitle>Акции и услуги</SectionTitle>
          <BannerStrip banners={banners} />
        </>
      )}
    </Screen>
  );
}

// Web links open in a new tab; tel: and mailto: hand over to the phone
const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {});
