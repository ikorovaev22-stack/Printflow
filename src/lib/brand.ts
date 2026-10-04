import type { CSSProperties } from "react";

function isLight(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

export function brandStyle(color: string): CSSProperties {
  return {
    "--brand": color,
    "--primary": color,
    "--primary-foreground": isLight(color) ? "#0a0a0a" : "#ffffff",
    "--ring": color,
  } as CSSProperties;
}

export function companyInitial(name: string) {
  const quoted = name.match(/[«"“]([^»"”]+)/)?.[1];
  return (quoted ?? name).replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase();
}

// Only logos from the company's own folder in our storage are rendered or fetched (no SSRF / tracking pixels)
export function logoSrc(company: { id: string; logo_url: string | null }) {
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/${company.id}/`;
  return company.logo_url?.startsWith(prefix) && !company.logo_url.slice(prefix.length).includes("/") ? company.logo_url : null;
}
