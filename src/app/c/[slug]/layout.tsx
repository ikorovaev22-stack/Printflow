import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/auth";
import { brandStyle } from "@/lib/brand";

export async function generateMetadata({ params }: LayoutProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return {};
  return {
    title: { default: company.name, template: `%s · ${company.name}` },
    description: `Статус заказов и чат с ${company.name}`,
    manifest: `/c/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: company.name, statusBarStyle: "default" },
    icons: { icon: `/c/${slug}/app-icon/192`, apple: `/c/${slug}/app-icon/180` },
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

export const viewport: Viewport = {
  themeColor: "#F7F7F7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function CompanyLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  return (
    <div style={brandStyle(company.brand_color)} className="min-h-dvh bg-background select-none [&_input,&_textarea,&_p]:select-text">
      {children}
    </div>
  );
}
