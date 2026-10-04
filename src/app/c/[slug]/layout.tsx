import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/auth";
import { brandStyle } from "@/lib/brand";

export default async function CompanyLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  return (
    <div style={brandStyle(company.brand_color)} className="min-h-dvh bg-muted/40">
      {children}
    </div>
  );
}
