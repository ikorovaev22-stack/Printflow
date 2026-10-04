import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/auth";
import { companyInitial } from "@/lib/brand";

export async function GET(req: Request, { params }: RouteContext<"/c/[slug]/app-icon/[size]">) {
  const { slug, size: raw } = await params;
  const size = Math.min(Math.max(Number(raw) || 192, 32), 1024);
  const maskable = new URL(req.url).searchParams.has("maskable");
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const letter = companyInitial(company.name);
  const inner = Math.round(size * (maskable ? 0.6 : 0.78));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: company.logo_url ? "#ffffff" : company.brand_color,
          color: "#ffffff",
          fontSize: size * 0.5,
          fontWeight: 700,
        }}
      >
        {company.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logo_url} width={inner} height={inner} style={{ objectFit: "contain" }} alt="" />
        ) : (
          letter
        )}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
