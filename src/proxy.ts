import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_CLIENT_PAGES = new Set(["login", "register", "faq", "about", "privacy", "calculator", "manifest.webmanifest", "app-icon"]);

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) return response;

  const { pathname } = request.nextUrl;
  const [, section, slug, page] = pathname.split("/");
  let target: string | null = null;
  if (section === "admin" && slug !== "login") target = "/admin/login";
  if (section === "c" && slug && !PUBLIC_CLIENT_PAGES.has(page)) target = `/c/${slug}/login`;
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: ["/admin/:path*", "/c/:path*"],
};
