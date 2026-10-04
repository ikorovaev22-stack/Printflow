import { CompanyLogo } from "@/components/company-logo";
import { Halftone } from "@/components/client/halftone";
import type { Company } from "@/lib/types";

// Welcome frame for login/register: dark hero with the company mark, form sheet below
export function Welcome({
  company,
  title,
  subtitle,
  children,
}: {
  company: Company;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh">
      <section className="relative flex min-h-[34dvh] flex-col items-center justify-end gap-4 overflow-hidden rounded-b-[2.5rem] bg-primary px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-10 text-center text-primary-foreground">
        <Halftone className="-top-16 -right-16 size-80" />
        <Halftone className="-bottom-24 -left-20 size-72" />
        <span className="relative rounded-full bg-white p-1.5">
          <CompanyLogo company={company} className="size-20 rounded-full text-3xl" />
        </span>
        <div className="relative">
          <p className="text-2xl font-bold tracking-tight">{company.name}</p>
          <p className="mt-1 text-sm text-white/60">Статус заказов и чат с типографией</p>
        </div>
      </section>
      <div className="mx-auto w-full max-w-md px-6 pt-8 pb-[max(env(safe-area-inset-bottom),2.5rem)]">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
        <p className="mt-1 mb-6 text-muted-foreground">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
