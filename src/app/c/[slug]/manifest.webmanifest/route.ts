import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/auth";

export async function GET(_: Request, { params }: RouteContext<"/c/[slug]/manifest.webmanifest">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const icon = (size: number, purpose: "any" | "maskable") => ({
    src: `/c/${slug}/app-icon/${size}${purpose === "maskable" ? "?maskable=1" : ""}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  return Response.json(
    {
      id: `/c/${slug}`,
      name: company.name,
      short_name: company.name.replace(/^Типография\s*/i, "").replace(/[«»"]/g, "").slice(0, 12) || company.name,
      description: `Заказы и чат с ${company.name}`,
      lang: "ru",
      start_url: `/c/${slug}`,
      scope: `/c/${slug}`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#f3f3f5",
      theme_color: "#f3f3f5",
      icons: [icon(192, "any"), icon(512, "any"), icon(192, "maskable"), icon(512, "maskable")],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } },
  );
}
