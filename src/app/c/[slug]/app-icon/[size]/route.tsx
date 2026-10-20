import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/auth";
import { companyInitial, logoSrc } from "@/lib/brand";

export async function GET(req: Request, { params }: RouteContext<"/c/[slug]/app-icon/[size]">) {
  const { slug, size: raw } = await params;
  const size = Math.min(Math.max(Number(raw) || 192, 32), 1024);
  const query = new URL(req.url).searchParams;
  const maskable = query.has("maskable");
  // Android and iOS cut their own shape out of an opaque square; tabs and the rest get a round icon on transparency
  const opaque = maskable || query.has("opaque");
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const letter = companyInitial(company.name);
  const logo = logoSrc(company);
  // Maskable icons keep the circle inside the 80% safe zone
  const inner = maskable ? Math.round(size * 0.8) : size;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: opaque ? company.brand_color : "transparent",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={inner} height={inner} style={{ borderRadius: "50%", objectFit: "cover" }} alt="" />
        ) : (
          <div
            style={{
              width: inner,
              height: inner,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: company.brand_color,
              color: "#ffffff",
              fontSize: inner * 0.5,
              fontWeight: 700,
            }}
          >
            {letter}
          </div>
        )}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
