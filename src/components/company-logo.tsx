import { companyInitial, logoSrc } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { Company } from "@/lib/types";

export function CompanyLogo({ company, className }: { company: Pick<Company, "id" | "name" | "logo_url">; className?: string }) {
  const src = logoSrc(company);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={company.name} className={cn("size-10 rounded-xl object-cover", className)} />;
  }
  return (
    <div
      className={cn(
        "flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground",
        className,
      )}
    >
      {companyInitial(company.name)}
    </div>
  );
}
