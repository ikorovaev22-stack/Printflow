import { companyInitial, logoSrc } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { Company } from "@/lib/types";

export function CompanyLogo({ company, className }: { company: Pick<Company, "id" | "name" | "logo_url">; className?: string }) {
  const src = logoSrc(company);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={company.name} className={cn("size-10 rounded-tile bg-card object-cover", className)} />;
  }
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-tile bg-brand text-lg font-semibold text-brand-foreground",
        className,
      )}
    >
      {companyInitial(company.name)}
    </div>
  );
}
