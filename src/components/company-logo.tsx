import { cn } from "@/lib/utils";
import type { Company } from "@/lib/types";

export function CompanyLogo({ company, className }: { company: Pick<Company, "name" | "logo_url">; className?: string }) {
  if (company.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={company.logo_url} alt={company.name} className={cn("size-10 rounded-xl object-cover", className)} />;
  }
  return (
    <div
      className={cn(
        "flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground",
        className,
      )}
    >
      {company.name.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase()}
    </div>
  );
}
